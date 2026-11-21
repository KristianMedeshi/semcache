import type { DialogResponseDto } from '@semcache/shared-dtos';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquarePlus, MessagesSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogDescription, DialogTitle, SheetContent } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

export interface ConversationSidebarProps {
  dialogs: DialogResponseDto[];
  activeDialogId: string | null;
  lastMessagesByDialog?: Record<string, string>;
  isLoading: boolean;
  isBusy: boolean;
  onSelectDialog: (dialogId: string) => void;
  onNewConversation: () => void;
}

function formatRelativeTime(isoDate: string): string {
  try {
    return formatDistanceToNow(new Date(isoDate), { addSuffix: true });
  } catch {
    return '';
  }
}

export function ConversationSidebarContent({
  dialogs,
  activeDialogId,
  lastMessagesByDialog = {},
  isLoading,
  isBusy,
  onSelectDialog,
  onNewConversation,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState('');

  const normalizedQuery = search.trim().toLowerCase();
  const filteredDialogs = normalizedQuery
    ? dialogs.filter((d) => d.title.toLowerCase().includes(normalizedQuery))
    : dialogs;

  return (
    <div className="flex h-full flex-col bg-secondary/35">
      <div className="space-y-3 border-b p-3.5">
        <Button
          type="button"
          onClick={onNewConversation}
          disabled={isBusy}
          className="w-full justify-start rounded-xl shadow-xs"
        >
          <MessageSquarePlus className="size-4" />
          New conversation
        </Button>

        {dialogs.length > 3 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
              className="h-9 rounded-lg bg-background pl-8 text-xs"
            />
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2.5">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Conversations
        </p>

        {isLoading ? (
          <p className="px-2.5 py-4 text-xs text-muted-foreground">Loading conversations...</p>
        ) : filteredDialogs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/60 px-3 py-6 text-center">
            <MessagesSquare className="mx-auto mb-2 size-5 text-muted-foreground/70" />
            <p className="text-xs font-medium text-foreground">
              {normalizedQuery ? 'No matching conversations' : 'No conversations yet'}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {normalizedQuery
                ? 'Try a different keyword.'
                : 'Select a topic or ask a question to begin.'}
            </p>
          </div>
        ) : (
          filteredDialogs.map((dialog) => {
            const isSelected = dialog.id === activeDialogId;
            const preview = lastMessagesByDialog[dialog.id] ?? 'Telecom support conversation';

            return (
              <button
                key={dialog.id}
                type="button"
                onClick={() => onSelectDialog(dialog.id)}
                aria-current={isSelected ? 'true' : undefined}
                className={cn(
                  'group relative flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-all',
                  isSelected
                    ? 'border-primary/25 bg-card text-foreground shadow-xs'
                    : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground',
                )}
              >
                {isSelected ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-2.5 bottom-2.5 left-0 w-1 rounded-r-full bg-primary"
                  />
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-xs',
                      isSelected ? 'font-semibold text-foreground' : 'font-medium text-foreground',
                    )}
                  >
                    {dialog.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatRelativeTime(dialog.updatedAt)}
                  </span>
                </div>

                <p className="truncate text-[11px] text-muted-foreground">{preview}</p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export interface MobileConversationDrawerProps extends ConversationSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileConversationDrawer({
  open,
  onOpenChange,
  onSelectDialog,
  onNewConversation,
  ...rest
}: MobileConversationDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-0">
        <div className="border-b px-4 py-3.5">
          <DialogTitle className="text-sm font-semibold">Conversation History</DialogTitle>
          <DialogDescription className="text-xs">
            Resume a previous support inquiry or start a new chat.
          </DialogDescription>
        </div>
        <ConversationSidebarContent
          {...rest}
          onSelectDialog={(id) => {
            onSelectDialog(id);
            onOpenChange(false);
          }}
          onNewConversation={() => {
            onNewConversation();
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Dialog>
  );
}
