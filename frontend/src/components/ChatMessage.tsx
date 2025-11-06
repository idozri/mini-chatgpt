import { Bot, User, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  errorMessage?: string;
  failedUserMessageId?: string;
  onRetry?: (failedUserMessageId: string) => void;
}

export function ChatMessage({
  role,
  content,
  isError = false,
  errorMessage,
  failedUserMessageId,
  onRetry,
}: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-4 p-6 transition-colors mt-4',
        !isUser && 'bg-secondary/50',
        isError && 'bg-destructive/10 border-l-4 border-destructive'
      )}
      role="article"
      aria-label={`${isUser ? 'User' : 'Assistant'} message${
        isError ? ' (error)' : ''
      }`}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isUser
            ? 'bg-neutral-500 text-accent-foreground'
            : isError
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-primary text-primary-foreground'
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-5 w-5" />
        ) : isError ? (
          <AlertCircle className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">
          {isUser ? 'You' : isError ? 'Error' : 'Assistant'}
        </p>
        <div
          className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap',
            isError ? 'text-destructive' : 'text-foreground/90'
          )}
        >
          {content}
        </div>
        {isError && errorMessage && (
          <div className="text-xs text-muted-foreground mt-1">
            {errorMessage}
          </div>
        )}
        {isError && failedUserMessageId && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetry(failedUserMessageId)}
            className="mt-2 gap-2"
            aria-label="Retry sending message"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
