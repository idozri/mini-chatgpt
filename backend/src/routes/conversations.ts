import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  buildPaginationQuery,
  createCursorPagination,
} from '../utils/pagination';

const router = Router();

const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

const updateConversationSchema = z.object({
  title: z.string().min(1).max(200),
});

// POST /api/conversations - Create new conversation
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = createConversationSchema.parse(req.body);

    // Reason: Calculate the next displayIndex by finding the maximum existing index
    // If no conversations exist, start at 1
    const maxConversation = await prisma.conversation.findFirst({
      orderBy: { displayIndex: 'desc' },
      select: { displayIndex: true },
    });

    const nextDisplayIndex = maxConversation
      ? maxConversation.displayIndex + 1
      : 1;
    // Reason: Always auto-generate title as "Conversation #<index>" unless explicitly provided
    const title = body.title ?? `Conversation #${nextDisplayIndex}`;

    const conversation = await prisma.conversation.create({
      data: {
        title,
        displayIndex: nextDisplayIndex,
      },
    });

    logger.info(
      { conversationId: conversation.id, displayIndex: nextDisplayIndex },
      'Conversation created'
    );
    res.status(201).json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn(
        { errors: error.errors },
        'Validation error creating conversation'
      );
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Error creating conversation');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations - List all conversations
router.get('/', async (_req: Request, res: Response) => {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    res.json(conversations);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Error listing conversations');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/conversations/:id - Get one conversation with paginated messages
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true,
      },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Reason: Fetch one extra message to determine if there are more pages
    const paginationQuery = buildPaginationQuery(cursor, limit);
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      take: paginationQuery.take,
      cursor: paginationQuery.cursor,
      orderBy: paginationQuery.orderBy,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    const paginated = createCursorPagination(messages, limit);

    res.json({
      ...conversation,
      messages: paginated,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, conversationId: req.params.id },
      'Error fetching conversation'
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/conversations/:id - Update conversation
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = updateConversationSchema.parse(req.body);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        title: body.title,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true,
      },
    });

    logger.info({ conversationId: id }, 'Conversation updated');
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn(
        { errors: error.errors, conversationId: req.params.id },
        'Validation error updating conversation'
      );
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, conversationId: req.params.id },
      'Error updating conversation'
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Reason: Cascade delete will automatically remove all messages
    await prisma.conversation.delete({
      where: { id },
    });

    logger.info({ conversationId: id }, 'Conversation deleted');
    res.status(204).send();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, conversationId: req.params.id },
      'Error deleting conversation'
    );
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
