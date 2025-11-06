import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ConversationWithMessages } from '@/lib/api';

export function useChatConversation() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messagesCursor, setMessagesCursor] = useState<string | undefined>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const queryClient = useQueryClient();

  // Fetch conversation with messages
  const {
    data: conversation,
    isLoading: isLoadingConversation,
    error: conversationError,
    refetch: refetchConversation,
  } = useQuery({
    queryKey: ['conversation', selectedChatId, messagesCursor],
    queryFn: () => {
      if (!selectedChatId) return null;
      return api.getConversation(selectedChatId, messagesCursor, 20);
    },
    enabled: !!selectedChatId,
  });

  const handleNewChat = () => {
    setSelectedChatId(null);
    setMessagesCursor(undefined);
    queryClient.removeQueries({ queryKey: ['conversation'] });
  };

  const handleChatSelect = (chatId: string) => {
    // Reason: Remove all cached queries for the previous conversation to prevent message leakage
    if (selectedChatId && selectedChatId !== chatId) {
      queryClient.removeQueries({ queryKey: ['conversation', selectedChatId] });
    }
    setSelectedChatId(chatId);
    setMessagesCursor(undefined); // Reset pagination when switching conversations
    // Reason: Invalidate queries for the new conversation to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['conversation', chatId] });
  };

  // Reason: Load older messages when scrolling to top
  const handleLoadOlder = async () => {
    // Reason: Capture current values to avoid stale closures
    const currentChatId = selectedChatId;
    const currentCursor = conversation?.messages?.nextCursor;
    const currentMessagesCursor = messagesCursor;

    if (!currentChatId || !currentCursor || isLoadingMore || !conversation) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const olderData = await api.getConversation(
        currentChatId,
        currentCursor, // Reason: Use nextCursor to load older messages
        20
      );

      // Reason: Verify we're still on the same conversation before updating cache
      // This prevents updating cache for a conversation that was switched away from
      if (selectedChatId !== currentChatId) {
        return;
      }

      // Reason: Update the current query's cache entry (using current messagesCursor)
      // This ensures we merge older messages into the currently displayed data
      queryClient.setQueryData<ConversationWithMessages>(
        ['conversation', currentChatId, currentMessagesCursor],
        (old) => {
          // Reason: Safety check - ensure we're merging into the correct conversation
          if (!old || old.id !== currentChatId) {
            return olderData;
          }
          // Reason: Prepend older messages to current messages
          return {
            ...old,
            messages: {
              items: [...olderData.messages.items, ...old.messages.items],
              nextCursor: olderData.messages.nextCursor,
              prevCursor: olderData.messages.prevCursor,
              hasMore: olderData.messages.hasMore,
            },
          };
        }
      );

      // Reason: Don't update messagesCursor - keep using the same query key
      // so the merged data persists. The nextCursor in the messages object
      // will be used for the next loadOlder call.
    } catch (error) {
      toast.error('Failed to load older messages', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Reason: Sort messages by createdAt to ensure correct chronological order
  const messages = conversation?.messages?.items
    ? [...conversation.messages.items].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    : [];
  const hasMoreMessages = conversation?.messages?.hasMore || false;

  return {
    selectedChatId,
    setSelectedChatId,
    conversation,
    messages,
    hasMoreMessages,
    isLoadingConversation,
    conversationError,
    refetchConversation,
    isLoadingMore,
    handleNewChat,
    handleChatSelect,
    handleLoadOlder,
  };
}
