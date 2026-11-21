import type { DialogMessageResponseDto } from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { format } from 'date-fns';
import { Check, Copy, Headset, ThumbsDown, ThumbsUp, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { MarkdownContent } from '@/shared/ui/markdown-content';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip';

export interface ChatMessageItemProps {
  message: DialogMessageResponseDto;
}

function formatMessageTime(isoDate: string): string {
  try {
    return format(new Date(isoDate), 'HH:mm');
  } catch {
    return '';
  }
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const isUser = message.role === ChatMessageRole.USER;
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message.content);
      }
      setCopied(true);
      toast.success('Response copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Unable to copy response');
    }
  };

  const handleFeedback = (type: 'up' | 'down') => {
    const next = feedback === type ? null : type;
    setFeedback(next);
    if (next === 'up') {
      toast.success('Thanks for your feedback!');
    } else if (next === 'down') {
      toast('Feedback recorded. You can also talk to a human agent anytime.');
    }
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser ? (
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary"
        >
          <Headset className="size-4" />
        </div>
      ) : null}

      <div className={cn('flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]', isUser && 'items-end')}>
        <div
          className={cn(
            'flex items-center gap-2 px-1 text-[11px] text-muted-foreground',
            isUser && 'flex-row-reverse',
          )}
        >
          <span className="font-medium text-foreground/80">
            {isUser ? 'You' : 'Telecom Assistant'}
          </span>
          <span>{formatMessageTime(message.createdAt)}</span>
        </div>

        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm shadow-xs',
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm border bg-card text-card-foreground',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )}
        </div>

        {!isUser ? (
          <TooltipProvider>
            <div className="flex items-center gap-1 px-1 pt-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Helpful response"
                    aria-pressed={feedback === 'up'}
                    onClick={() => handleFeedback('up')}
                    className={cn(
                      'size-7 rounded-lg text-muted-foreground hover:text-foreground',
                      feedback === 'up' && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <ThumbsUp className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Helpful</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Not helpful response"
                    aria-pressed={feedback === 'down'}
                    onClick={() => handleFeedback('down')}
                    className={cn(
                      'size-7 rounded-lg text-muted-foreground hover:text-foreground',
                      feedback === 'down' && 'bg-destructive/10 text-destructive',
                    )}
                  >
                    <ThumbsDown className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Not helpful</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Copy response"
                    onClick={handleCopy}
                    className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{copied ? 'Copied' : 'Copy response'}</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ) : null}
      </div>

      {isUser ? (
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <User className="size-4" />
        </div>
      ) : null}
    </div>
  );
}
