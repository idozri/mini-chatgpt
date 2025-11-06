import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  ConversationWithMessages,
  Message,
  ApiRequestError,
} from '@/lib/api';

export function useSendMessage(selectedChatId: string | null) {
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const queryClient = useQueryClient();

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      abortSignal,
      conversationId,
      existingMessageId,
    }: {
      content: string;
      abortSignal: AbortSignal;
      conversationId: string;
      existingMessageId?: string; // Reason: For retries - reuse existing message if provided
    }) => {
      return api.sendMessage(
        conversationId,
        content,
        abortSignal,
        existingMessageId
      );
    },
    onMutate: async ({ content, conversationId, existingMessageId }) => {
      // Reason: If retrying with existingMessageId, message already exists in DB - skip optimistic update
      if (existingMessageId) {
        return { previousConversation: null, latestQueryKey: null };
      }

      // Reason: Optimistically add user message immediately so it appears in the UI
      const queryKeyPattern = ['conversation', conversationId];

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeyPattern });

      // Reason: Get the latest messages query (with undefined cursor) for optimistic update
      const latestQueryKey = ['conversation', conversationId, undefined];
      const previousConversation =
        queryClient.getQueryData<ConversationWithMessages>(latestQueryKey);

      const optimisticUserMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };

      // Reason: Optimistically add user message to the latest messages query
      if (previousConversation) {
        queryClient.setQueryData<ConversationWithMessages>(latestQueryKey, {
          ...previousConversation,
          messages: {
            ...previousConversation.messages,
            items: [
              ...previousConversation.messages.items,
              optimisticUserMessage,
            ],
          },
        });
      }

      return { previousConversation, latestQueryKey };
    },
    onSuccess: (data, variables, context) => {
      // Reason: Invalidate to refetch conversation with new messages (user + assistant)
      queryClient.invalidateQueries({
        queryKey: ['conversation', selectedChatId],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setAbortController(null);
    },
    onError: (error: Error, variables, context) => {
      // Reason: Keep the optimistic message but mark it as failed with error information
      if (context?.latestQueryKey) {
        const currentConversation =
          queryClient.getQueryData<ConversationWithMessages>(
            context.latestQueryKey
          );

        if (currentConversation) {
          // Reason: Extract messageId from ApiRequestError if it's an LLM error
          const apiError = error instanceof ApiRequestError ? error : null;
          const savedMessageId = apiError?.messageId;
          const isLlmError = apiError?.isLlmError;

          // Reason: Find the optimistic message that was just added and mark it as failed
          const errorMessage = error.message.includes('cancelled')
            ? 'Message was cancelled'
            : error.message.includes('timeout')
            ? 'Request timed out. Please try again.'
            : isLlmError
            ? 'LLM service unavailable. Please try again.'
            : 'Failed to send message. Please try again.';

          queryClient.setQueryData<ConversationWithMessages>(
            context.latestQueryKey,
            {
              ...currentConversation,
              messages: {
                ...currentConversation.messages,
                items: currentConversation.messages.items.map((msg) =>
                  msg.id.startsWith('temp-') &&
                  msg.content === variables.content &&
                  msg.role === 'user'
                    ? {
                        ...msg,
                        id: savedMessageId || msg.id, // Reason: Replace temp ID with real messageId if available
                        isError: true,
                        errorMessage,
                        failedUserMessageId: savedMessageId, // Reason: Store messageId for retry
                      }
                    : msg
                ),
              },
            }
          );
        }
      }

      setAbortController(null);
      // Reason: Don't show toast - error will be displayed as an alert in the conversation
    },
  });

  const handleSendMessage = async (
    content: string,
    abortSignal: AbortSignal,
    setSelectedChatId: (id: string) => void,
    existingMessageId?: string // Reason: For retries - reuse existing message if provided
  ) => {
    let conversationId = selectedChatId;

    // Reason: If no conversation selected, create one first
    if (!conversationId) {
      try {
        const newConversation = await api.createConversation();
        conversationId = newConversation.id;
        setSelectedChatId(conversationId);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });

        // Wait a bit for the conversation query to be enabled and fetch initial state
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        throw new Error('Failed to create conversation');
      }
    }

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Combine signals
    abortSignal.addEventListener('abort', () => controller.abort());

    try {
      await sendMessageMutation.mutateAsync({
        content,
        abortSignal: controller.signal,
        conversationId: conversationId!, // We know it's set at this point
        existingMessageId, // Reason: Pass existingMessageId for retries
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        // Don't show error for user-initiated cancellation
        return;
      }
      throw error;
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const isSending = sendMessageMutation.isPending;
  const isDisabled = isSending || !!abortController;

  return {
    handleSendMessage,
    handleCancel,
    isSending,
    isDisabled,
  };
}
