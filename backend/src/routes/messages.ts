import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { createLlmAdapter, LlmMessage } from '../lib/llmAdapter';

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  role: z.enum(['user', 'assistant']).default('user'),
  existingMessageId: z.string().optional(), // Reason: For retries - reuse existing message if provided
});

// POST /api/conversations/:id/messages - Send message and get LLM reply
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const body = sendMessageSchema.parse(req.body);
    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Reason: Check if message already exists to prevent duplicates on retry
    // First, check by existingMessageId if provided (LLM error retry)
    // Otherwise, check by content to handle network/timeout errors where message might be saved
    let userMessage;

    if (body.existingMessageId) {
      // Reason: LLM error retry - check if message exists by ID
      const existingMessage = await prisma.message.findUnique({
        where: { id: body.existingMessageId },
      });

      if (existingMessage) {
        userMessage = existingMessage;

        logger.info(
          { conversationId, messageId: userMessage.id },
          'Reusing existing user message for LLM error retry'
        );
      }
    }

    if (!userMessage) {
      // Reason: Check for duplicate message by content to prevent duplicates on timeout retry
      // Look for a recent message (within last 5 minutes) with same content, role, and conversationId
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const duplicateMessage = await prisma.message.findFirst({
        where: {
          conversationId,
          role: body.role,
          content: body.content,
          createdAt: {
            gte: fiveMinutesAgo, // Reason: Only check recent messages to avoid false positives
          },
        },
        orderBy: {
          createdAt: 'desc', // Reason: Get the most recent duplicate if multiple exist
        },
      });

      if (duplicateMessage) {
        userMessage = duplicateMessage;
        logger.info(
          { conversationId, messageId: userMessage.id },
          'Reusing existing user message found by content (timeout retry)'
        );
      } else {
        userMessage = await prisma.message.create({
          data: {
            conversationId,
            role: body.role,
            content: body.content,
          },
        });
        logger.info(
          { conversationId, messageId: userMessage.id },
          'User message created'
        );
      }
    }

    // Reason: AbortController allows cancellation from the client
    // Note: Express doesn't have req.signal by default, but we create one for future support
    const abortController = new AbortController();
    const abortSignal = abortController.signal;

    // Fetch conversation history for LLM context
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
      },
    });

    // Prepare messages for LLM
    const llmMessages: LlmMessage[] = history.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    // Get LLM completion
    let llmResponse: string;
    try {
      const adapter = createLlmAdapter();
      const completion = await adapter.complete({
        messages: llmMessages,
        abortSignal,
      });
      llmResponse = completion.completion;
    } catch (error) {
      logger.error({ error, conversationId }, 'LLM completion failed');

      // Reason: If LLM fails, we still save the user message but return an error
      if (error instanceof Error && error.message.includes('aborted')) {
        res.status(499).json({ error: 'Request cancelled' });
        return;
      }

      res.status(502).json({
        error: 'LLM service unavailable',
        messageId: userMessage.id,
      });
      return;
    }

    // Create assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: llmResponse,
      },
    });

    // Update conversation's last message timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
      },
    });

    logger.info(
      { conversationId, messageId: assistantMessage.id },
      'Assistant message created'
    );

    res.status(201).json({
      message: userMessage,
      reply: assistantMessage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn(
        { errors: error.errors },
        'Validation error creating message'
      );
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, conversationId: req.params.id },
      'Error creating message'
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
