import type { DialogResponseDto } from '@semcache/shared-dtos';
import type { FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

export interface ConversationActionDialogsProps {
  renamingDialog: DialogResponseDto | null;
  renameTitle: string;
  onRenameTitleChange: (value: string) => void;
  onCloseRename: () => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  deletingDialog: DialogResponseDto | null;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  isBusy: boolean;
}

export function ConversationActionDialogs({
  renamingDialog,
  renameTitle,
  onRenameTitleChange,
  onCloseRename,
  onRenameSubmit,
  deletingDialog,
  onCloseDelete,
  onConfirmDelete,
  isBusy,
}: ConversationActionDialogsProps) {
  return (
    <>
      <Dialog
        open={Boolean(renamingDialog)}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRename();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Update the title for this support conversation.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onRenameSubmit} className="space-y-4">
            <Input
              value={renameTitle}
              onChange={(event) => onRenameTitleChange(event.target.value)}
              aria-label="Conversation title"
              placeholder="Enter conversation title"
              maxLength={120}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCloseRename}>
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
            onCloseDelete();
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
            <Button type="button" variant="outline" onClick={onCloseDelete}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={isBusy} onClick={onConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
