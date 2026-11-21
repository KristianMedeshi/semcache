import type { DialogMessageResponseDto } from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';

export const ROOT_BRANCH_PARENT_KEY = '__root__';

export interface ActiveGraphNode {
  message: DialogMessageResponseDto;
  parentKey: string;
  siblingIds: string[];
  siblingIndex: number;
  siblingCount: number;
}

export interface ActiveMessagePath {
  nodes: ActiveGraphNode[];
  activeLeafMessageId: string | null;
}

export function getBranchParentKey(parentMessageId?: string | null): string {
  return parentMessageId ?? ROOT_BRANCH_PARENT_KEY;
}

export function resolveActiveMessagePath(
  messages: DialogMessageResponseDto[],
  selectedBranches: Record<string, string> = {},
): ActiveMessagePath {
  if (messages.length === 0) {
    return { nodes: [], activeLeafMessageId: null };
  }

  const hasExplicitLinks = messages.some(
    (msg) => msg.parentMessageId !== undefined && msg.parentMessageId !== null,
  );
  const childrenByParent = new Map<string, DialogMessageResponseDto[]>();

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    let effectiveParentId: string | null;

    if (message.parentMessageId !== undefined && message.parentMessageId !== null) {
      effectiveParentId = message.parentMessageId;
    } else if (message.role === ChatMessageRole.ASSISTANT && i > 0) {
      effectiveParentId = messages[i - 1].id;
    } else if (!hasExplicitLinks && i > 0) {
      effectiveParentId = messages[i - 1].id;
    } else {
      effectiveParentId = null;
    }

    const key = getBranchParentKey(effectiveParentId);
    const group = childrenByParent.get(key);
    if (group) {
      group.push(message);
    } else {
      childrenByParent.set(key, [message]);
    }
  }

  const nodes: ActiveGraphNode[] = [];
  const visited = new Set<string>();
  let parentKey = ROOT_BRANCH_PARENT_KEY;

  while (true) {
    const siblings = childrenByParent.get(parentKey);
    if (!siblings || siblings.length === 0) {
      break;
    }

    const selectedId = selectedBranches[parentKey];
    const activeNode =
      (selectedId ? siblings.find((item) => item.id === selectedId) : undefined) ??
      siblings[siblings.length - 1];

    if (visited.has(activeNode.id)) {
      break;
    }
    visited.add(activeNode.id);

    const siblingIndex = siblings.indexOf(activeNode);
    nodes.push({
      message: activeNode,
      parentKey,
      siblingIds: siblings.map((item) => item.id),
      siblingIndex,
      siblingCount: siblings.length,
    });

    parentKey = activeNode.id;
  }

  return {
    nodes,
    activeLeafMessageId: nodes.length > 0 ? nodes[nodes.length - 1].message.id : null,
  };
}

export function getAdjacentBranchId(
  node: ActiveGraphNode,
  direction: 'prev' | 'next',
): string | null {
  if (node.siblingCount <= 1) {
    return null;
  }
  const targetIndex = direction === 'prev' ? node.siblingIndex - 1 : node.siblingIndex + 1;
  if (targetIndex < 0 || targetIndex >= node.siblingCount) {
    return null;
  }
  return node.siblingIds[targetIndex] ?? null;
}
