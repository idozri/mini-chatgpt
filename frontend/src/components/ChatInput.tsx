import { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSendMessage: (message: string, abortSignal: AbortSignal) => Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
  onCancel?: () => void;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  isSending = false,
  onCancel,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevIsSendingRef = useRef(isSending);

  // Reason: Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [message]);

  // Reason: Focus input after message is sent (when isSending changes from true to false)
  useEffect(() => {
    // Only focus if isSending transitioned from true to false (message just finished sending)
    if (
      prevIsSendingRef.current &&
      !isSending &&
      textareaRef.current &&
      !disabled
    ) {
      textareaRef.current.focus();
    }
    prevIsSendingRef.current = isSending;
  }, [isSending, disabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isSending) {
      const content = message.trim();
      setMessage('');

      // Reason: Create abort controller for this request
      const abortController = new AbortController();

      try {
        await onSendMessage(content, abortController.signal);
      } catch (error) {
        // Reason: Don't restore message on error - it will remain in the message list with error state
        // Only re-throw if not cancelled (cancelled errors are handled silently)
        if (error instanceof Error && !error.message.includes('cancelled')) {
          throw error;
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Reason: Escape key cancels the current send
    if (e.key === 'Escape' && isSending && onCancel) {
      onCancel();
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-background p-4"
      aria-label="Chat input"
    >
      <div className="flex gap-3 max-w-4xl mx-auto">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isDisabled
              ? isSending
                ? 'Sending message...'
                : 'Input disabled'
              : 'Send a message... (Press Enter to send, Shift+Enter for new line)'
          }
          disabled={isDisabled}
          className="min-h-[60px] max-h-[200px] resize-none bg-input border-border focus-visible:ring-primary"
          aria-label="Message input"
          aria-describedby="input-help"
        />
        {isSending ? (
          <Button
            type="button"
            onClick={onCancel}
            variant="destructive"
            className="h-[60px] px-6"
            aria-label="Cancel sending message"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!message.trim() || isDisabled}
            className="h-[60px] px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div id="input-help" className="sr-only">
        Press Enter to send, Shift+Enter for new line, Escape to cancel
      </div>
    </form>
  );
}
