import type { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import type { ActiveGraphNode } from '@/features/chat/model/message-graph';
import { getAdjacentBranchId } from '@/features/chat/model/message-graph';
import { getAuthServerError } from '@/shared/api/api-client';

export type BranchSelectionsByDialog = Record<string, Record<string, string>>;

export async function runWithErrorToast(
  action: () => Promise<void>,
  fallbackMessage: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    toast.error(getAuthServerError(error as Error, fallbackMessage));
  }
}

export function setBranchSelection(
  setSelectedBranchesByDialog: Dispatch<SetStateAction<BranchSelectionsByDialog>>,
  dialogId: string,
  parentKey: string,
  targetId: string,
): void {
  setSelectedBranchesByDialog((prev) => ({
    ...prev,
    [dialogId]: {
      ...(prev[dialogId] ?? {}),
      [parentKey]: targetId,
    },
  }));
}

export function applyAdjacentBranchSelection(
  setSelectedBranchesByDialog: Dispatch<SetStateAction<BranchSelectionsByDialog>>,
  activeDialogId: string | null,
  node: ActiveGraphNode,
  direction: 'prev' | 'next',
): void {
  if (!activeDialogId) {
    return;
  }
  const targetId = getAdjacentBranchId(node, direction);
  if (!targetId) {
    return;
  }
  setBranchSelection(setSelectedBranchesByDialog, activeDialogId, node.parentKey, targetId);
}

export function removeDialogBranchSelections(
  setSelectedBranchesByDialog: Dispatch<SetStateAction<BranchSelectionsByDialog>>,
  dialogId: string,
): void {
  setSelectedBranchesByDialog((prev) => {
    if (!(dialogId in prev)) {
      return prev;
    }
    const next = { ...prev };
    delete next[dialogId];
    return next;
  });
}
