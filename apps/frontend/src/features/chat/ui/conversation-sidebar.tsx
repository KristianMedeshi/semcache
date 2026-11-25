import type { DialogResponseDto } from '@semcache/shared-dtos';
import { MessageSquarePlus, MessagesSquare, Search } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { ConversationActionDialogs } from '@/features/chat/ui/conversation-action-dialogs';
import { ConversationListItem } from '@/features/chat/ui/conversation-list-item';
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
  onRenameDialog?: (dialogId: string, title: string) => Promise<void> | void;
  onDeleteDialog?: (dialogId: string) => Promise<void> | void;
  footer?: ReactNode;
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
  footer,
}: ConversationSidebarProps) {
  const [search, setSearch] = useState('');
  const [renamingDialog, setRenamingDialog] = useState<DialogResponseDto | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deletingDialog, setDeletingDialog] = useState<DialogResponseDto | null>(null);

  const normalizedQuery = search.trim().toLowerCase();
  const filteredDialogs = normalizedQuery
    ? dialogs.filter((d) => d.title.toLowerCase().includes(normalizedQuery))
    : dialogs;

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    <div className="flex min-h-0 flex-1 flex-col bg-secondary/35">
      <div className="shrink-0 space-y-3 border-b p-3.5">
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

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5">
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
          filteredDialogs.map((dialog) => (
            <ConversationListItem
              key={dialog.id}
              dialog={dialog}
              isSelected={dialog.id === activeDialogId}
              preview={lastMessagesByDialog[dialog.id] ?? 'Telecom support conversation'}
              isBusy={isBusy}
              onSelect={() => onSelectDialog(dialog.id)}
              onStartRename={
                onRenameDialog
                  ? () => {
                      setRenamingDialog(dialog);
                      setRenameTitle(dialog.title);
                    }
                  : undefined
              }
              onStartDelete={onDeleteDialog ? () => setDeletingDialog(dialog) : undefined}
            />
          ))
        )}
      </div>

      {footer}

      <ConversationActionDialogs
        renamingDialog={renamingDialog}
        renameTitle={renameTitle}
        onRenameTitleChange={setRenameTitle}
        onCloseRename={() => setRenamingDialog(null)}
        onRenameSubmit={(event) => void handleRenameSubmit(event)}
        deletingDialog={deletingDialog}
        onCloseDelete={() => setDeletingDialog(null)}
        onConfirmDelete={() => void handleConfirmDelete()}
        isBusy={isBusy}
      />
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
