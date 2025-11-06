import { Loader2, AlertCircle, ChevronUp } from 'lucide-react';
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useChatConversation } from '@/hooks/use-chat-conversation';
import { useSendMessage } from '@/hooks/use-send-message';
import { useMessageScroll } from '@/hooks/use-message-scroll';
import { useQueryClient } from '@tanstack/react-query';
import { ConversationWithMessages } from '@/lib/api';

function ChatContent() {
  const { open, isMobile } = useSidebar();
  const queryClient = useQueryClient();

  const {
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
  } = useChatConversation();

  const { handleSendMessage, handleCancel, isSending, isDisabled } =
    useSendMessage(selectedChatId);

  const messagesEndRef = useMessageScroll(messages, isLoadingMore);

  const onSendMessage = async (content: string, abortSignal: AbortSignal) => {
    await handleSendMessage(content, abortSignal, setSelectedChatId);
  };

  // Reason: Retry handler for failed messages - removes failed message and resends
  const handleRetryMessage = async (
    messageContent: string,
    failedMessageId: string
  ) => {
    if (!selectedChatId) return;

    // Reason: Get the failed message to check if it has a saved messageId
    const latestQueryKey = ['conversation', selectedChatId, undefined];
    const currentConversation =
      queryClient.getQueryData<ConversationWithMessages>(latestQueryKey);

    let existingMessageId: string | undefined;
    if (currentConversation) {
      // Reason: Find the failed message and extract its saved messageId if available
      const failedMessage = currentConversation.messages.items.find(
        (msg) => msg.id === failedMessageId
      );
      existingMessageId = failedMessage?.failedUserMessageId;

      // Reason: Remove the failed message from the cache before retrying
      queryClient.setQueryData<ConversationWithMessages>(latestQueryKey, {
        ...currentConversation,
        messages: {
          ...currentConversation.messages,
          items: currentConversation.messages.items.filter(
            (msg) => msg.id !== failedMessageId
          ),
        },
      });
    }

    // Reason: Create a new abort controller for the retry
    const abortController = new AbortController();
    try {
      await handleSendMessage(
        messageContent,
        abortController.signal,
        setSelectedChatId,
        existingMessageId // Reason: Pass existingMessageId if available (LLM error retry)
      );
    } catch (error) {
      // Error handling is done in useSendMessage hook
    }
  };

  return (
    <div className="flex h-screen w-full bg-background">
      <ChatSidebar
        selectedChatId={selectedChatId || undefined}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
      />

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4">
          <SidebarTrigger className="md:hidden" />
          <img src="/logo.png" alt="Logo" className="h-8 w-8" />
          <h1 className="text-lg font-semibold text-foreground">
            {conversation?.title || 'Mini ChatGPT'}
          </h1>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 my-4">
          <div className="mx-auto max-w-4xl">
            {/* Load older messages button */}
            {hasMoreMessages && messages.length > 0 && (
              <div className="flex justify-center p-4">
                <Button
                  variant="outline"
                  onClick={handleLoadOlder}
                  disabled={isLoadingMore}
                  className="gap-2"
                  aria-label="Load older messages"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Load older messages
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Error state */}
            {conversationError && (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center">
                    {conversationError instanceof Error
                      ? conversationError.message
                      : 'Failed to load conversation'}
                    <Button
                      variant="link"
                      onClick={() => refetchConversation()}
                      className="ml-2 h-auto p-0"
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Loading state */}
            {isLoadingConversation && !conversation && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Loading conversation...
                </span>
              </div>
            )}

            {/* Empty state */}
            {!isLoadingConversation &&
              !conversationError &&
              messages.length === 0 &&
              !selectedChatId && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="mb-4 text-muted-foreground">
                    <p className="text-lg font-medium mb-2">
                      Welcome to Mini ChatGPT
                    </p>
                    <p className="text-sm">
                      Start a new conversation to begin chatting with the AI
                      assistant.
                    </p>
                  </div>
                </div>
              )}

            {/* Empty conversation state */}
            {messages.length === 0 &&
              !isLoadingConversation &&
              selectedChatId &&
              !conversationError && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-muted-foreground">
                    No messages yet. Send a message to start the conversation!
                  </p>
                </div>
              )}

            {messages.map((message) => (
              <div key={message.id}>
                <ChatMessage role={message.role} content={message.content} />
                {/* Reason: Show error alert after failed user messages */}
                {message.isError &&
                  message.role === 'user' &&
                  message.errorMessage && (
                    <div className="p-4">
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="flex items-center">
                          {message.errorMessage}
                          <Button
                            variant="link"
                            onClick={() =>
                              handleRetryMessage(message.content, message.id)
                            }
                            className="ml-2 h-auto p-0"
                            disabled={isSending}
                          >
                            Retry
                          </Button>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
              </div>
            ))}

            {/* Loading indicator for sending */}
            {isSending && (
              <div className="flex gap-4 p-6 mt-4 bg-secondary/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Assistant
                  </p>
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput
          onSendMessage={onSendMessage}
          disabled={isDisabled}
          isSending={isSending}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

const Index = () => {
  return (
    <SidebarProvider defaultOpen={true}>
      <ChatContent />
    </SidebarProvider>
  );
};

export default Index;
