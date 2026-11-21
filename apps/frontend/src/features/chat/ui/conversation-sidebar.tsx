import type { DialogResponseDto } from '@semcache/shared-dtos';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageSquarePlus,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SheetContent,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';

export interface ConversationSidebarProps {
  dialogs: DialogResponseDto[];
  activeDialogId: string | null;
  lastMessagesByDialog?: Record<string, string>;
  isLoading: boolean;
  isBusy: boolean;
  onSelectDialog: (dialogId: string) => void;
  onNewConversation: () => void;
  onRenameDialog?: (dialogId: string, title: string) => Promise<void> | void;
  onDeleteDialog?: (dialogId: string) => Promise<void> | void;
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
  onRenameDialog,
  onDeleteDialog,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState('');
  const [renamingDialog, setRenamingDialog] = useState<DialogResponseDto | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deletingDialog, setDeletingDialog] = useState<DialogResponseDto | null>(null);

  const normalizedQuery = search.trim().toLowerCase();
  const filteredDialogs = normalizedQuery
    ? dialogs.filter((d) => d.title.toLowerCase().includes(normalizedQuery))
    : dialogs;

  const openRenameDialog = (dialog: DialogResponseDto) => {
    setRenamingDialog(dialog);
    setRenameTitle(dialog.title);
  };

  const handleRenameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = renameTitle.trim();
    if (!renamingDialog || !trimmed || !onRenameDialog) {
      return;
    }
    const targetId = renamingDialog.id;
    setRenamingDialog(null);
    await onRenameDialog(targetId, trimmed);
  };

  const handleConfirmDelete = async () => {
    if (!deletingDialog || !onDeleteDialog) {
      return;
    }
    const targetId = deletingDialog.id;
    setDeletingDialog(null);
    await onDeleteDialog(targetId);
  };

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
              <div
                key={dialog.id}
                className={cn(
                  'group relative flex w-full items-start gap-1 rounded-xl border px-3 py-2.5 transition-all',
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

                <button
                  type="button"
                  onClick={() => onSelectDialog(dialog.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-xs',
                        isSelected
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-foreground',
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

                {(onRenameDialog || onDeleteDialog) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${dialog.title}`}
                        disabled={isBusy}
                        className="size-7 shrink-0 rounded-md text-muted-foreground opacity-80 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {onRenameDialog ? (
                        <DropdownMenuItem onSelect={() => openRenameDialog(dialog)}>
                          <Pencil className="size-4 text-muted-foreground" />
                          Rename
                        </DropdownMenuItem>
                      ) : null}
                      {onDeleteDialog ? (
                        <DropdownMenuItem
                          onSelect={() => setDeletingDialog(dialog)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={Boolean(renamingDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setRenamingDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Update the title for this support conversation.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleRenameSubmit(event)} className="space-y-4">
            <Input
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              aria-label="Conversation title"
              placeholder="Enter conversation title"
              maxLength={120}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenamingDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isBusy || renameTitle.trim().length === 0}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &ldquo;{deletingDialog?.title}&rdquo; and
              all of its messages? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy}
              onClick={() => void handleConfirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
