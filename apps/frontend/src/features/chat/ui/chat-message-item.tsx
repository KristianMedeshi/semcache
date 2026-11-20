import type { DialogMessageResponseDto } from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { Bot, User } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface ChatMessageItemProps {
  message: DialogMessageResponseDto;
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isUser = message.role === ChatMessageRole.USER;

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-foreground">
          <Bot className="size-4" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] space-y-1.5 rounded-2xl px-4 py-2.5 text-sm shadow-xs',
          isUser ? 'bg-primary text-primary-foreground' : 'border bg-muted/50 text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>

        {!isUser && (message.model || message.latencyMs !== null || message.usage) && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
            {message.model && (
              <span className="rounded bg-background/80 px-1.5 py-0.5 font-mono">
                {message.model}
              </span>
            )}
            {message.latencyMs !== null && <span>{message.latencyMs} ms</span>}
            {message.usage && <span>{message.usage.totalTokens} tokens</span>}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="size-4" />
        </div>
      )}
    </div>
  );
}
