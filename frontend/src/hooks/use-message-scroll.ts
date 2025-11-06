import { useRef, useEffect } from 'react';
import { Message } from '@/lib/api';

/**
 * Hook to handle auto-scrolling to the bottom when new messages arrive
 * Reason: Only scrolls when new messages are added at the end, not when older messages are prepended
 */
export function useMessageScroll(
  messages: Message[],
  isLoadingOlder: boolean = false
) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousLastMessageId = useRef<string | undefined>();
  const previousFirstMessageId = useRef<string | undefined>();

  // Reason: Scroll to bottom only when new messages are added at the end
  useEffect(() => {
    if (!messagesEndRef.current || messages.length === 0) {
      // Reason: Update refs even if we don't scroll
      if (messages.length > 0) {
        previousLastMessageId.current = messages[messages.length - 1]?.id;
        previousFirstMessageId.current = messages[0]?.id;
      }
      return;
    }

    const firstMessageId = messages[0]?.id;
    const lastMessageId = messages[messages.length - 1]?.id;
    const firstMessageChanged = firstMessageId !== previousFirstMessageId.current;
    const lastMessageChanged = lastMessageId !== previousLastMessageId.current;
    const isFirstRender = previousLastMessageId.current === undefined;

    // Reason: If loading older messages, don't scroll - preserve position
    // Also, if the first message changed but the last didn't, older messages were prepended
    if (isLoadingOlder || (firstMessageChanged && !lastMessageChanged)) {
      // Reason: Still update refs to track state, but don't scroll
      previousLastMessageId.current = lastMessageId;
      previousFirstMessageId.current = firstMessageId;
      return;
    }

    // Reason: Only scroll if the last message ID changed (new messages added at end)
    // This means messages were appended, not prepended
    if (isFirstRender || lastMessageChanged) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    // Reason: Update the refs to track state for next comparison
    previousLastMessageId.current = lastMessageId;
    previousFirstMessageId.current = firstMessageId;
  }, [messages, isLoadingOlder]);

  return messagesEndRef;
}

