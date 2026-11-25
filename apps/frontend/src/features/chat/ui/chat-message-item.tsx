import type { DialogMessageResponseDto } from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { format } from 'date-fns';
import { Headset, Pencil, User } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { AssistantMessageActions, BranchControls } from '@/features/chat/ui/chat-message-actions';
import { ChatMessageEditor } from '@/features/chat/ui/chat-message-editor';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { MarkdownContent } from '@/shared/ui/markdown-content';

export interface ChatMessageItemProps {
  message: DialogMessageResponseDto;
  siblingIndex?: number;
  siblingCount?: number;
  onSelectBranch?: (direction: 'prev' | 'next') => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void> | void;
  isBusy?: boolean;
}

function formatMessageTime(isoDate: string): string {
  try {
    return format(new Date(isoDate), 'HH:mm');
  } catch {
    return '';
  }
}

export function ChatMessageItem({
  message,
  siblingIndex = 0,
  siblingCount = 1,
  onSelectBranch,
  onEditMessage,
  isBusy = false,
}: ChatMessageItemProps) {
  const isUser = message.role === ChatMessageRole.USER;
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);

  const canEdit =
    isUser &&
    Boolean(onEditMessage) &&
    !message.id.startsWith('optimistic-user-') &&
    message.id !== 'streaming-assistant';

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
      toast('Feedback recorded.');
    }
  };

  const handleSubmitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = editDraft.trim();
    if (!trimmed || !onEditMessage) {
      return;
    }
    setIsEditing(false);
    await onEditMessage(message.id, trimmed);
  };

  const branchProps = { siblingIndex, siblingCount, isBusy, onSelectBranch };

  return (
    <div className={cn('group flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
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

        {isEditing ? (
          <ChatMessageEditor
            draft={editDraft}
            isBusy={isBusy}
            onDraftChange={setEditDraft}
            onCancel={() => {
              setEditDraft(message.content);
              setIsEditing(false);
            }}
            onSubmit={(event) => void handleSubmitEdit(event)}
          />
        ) : (
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
        )}

        {isUser ? (
          <div className="flex items-center gap-1 px-1 pt-0.5">
            <BranchControls {...branchProps} />
            {canEdit && !isEditing ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Edit message"
                disabled={isBusy}
                onClick={() => {
                  setEditDraft(message.content);
                  setIsEditing(true);
                }}
                className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ) : (
          <AssistantMessageActions
            {...branchProps}
            feedback={feedback}
            copied={copied}
            onFeedback={handleFeedback}
            onCopy={() => void handleCopy()}
          />
        )}
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
