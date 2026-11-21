import type { DialogMessageResponseDto } from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { describe, expect, it } from 'vitest';
import {
  ROOT_BRANCH_PARENT_KEY,
  getAdjacentBranchId,
  resolveActiveMessagePath,
} from '@/features/chat/model/message-graph';

function makeMessage(
  overrides: Partial<DialogMessageResponseDto> & {
    id: string;
    role: ChatMessageRole;
    content: string;
  },
): DialogMessageResponseDto {
  return {
    dialogId: 'dialog-1',
    parentMessageId: null,
    model: null,
    latencyMs: null,
    usage: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('message-graph', () => {
  it('resolves legacy linear messages without parentMessageId as a single path', () => {
    const messages: DialogMessageResponseDto[] = [
      makeMessage({ id: 'm1', role: ChatMessageRole.USER, content: 'Q1' }),
      makeMessage({ id: 'm2', role: ChatMessageRole.ASSISTANT, content: 'A1' }),
      makeMessage({ id: 'm3', role: ChatMessageRole.USER, content: 'Q2' }),
      makeMessage({ id: 'm4', role: ChatMessageRole.ASSISTANT, content: 'A2' }),
    ];

    const result = resolveActiveMessagePath(messages);
    expect(result.nodes.map((n) => n.message.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(result.activeLeafMessageId).toBe('m4');
  });

  it('defaults to the latest branch and switches downstream paths when selecting an earlier branch', () => {
    const messages: DialogMessageResponseDto[] = [
      makeMessage({ id: 'u1', parentMessageId: null, role: ChatMessageRole.USER, content: 'Hi' }),
      makeMessage({
        id: 'a1',
        parentMessageId: 'u1',
        role: ChatMessageRole.ASSISTANT,
        content: 'Hello',
      }),
      makeMessage({
        id: 'u2-v1',
        parentMessageId: 'a1',
        role: ChatMessageRole.USER,
        content: 'Plan A',
      }),
      makeMessage({
        id: 'a2-v1',
        parentMessageId: 'u2-v1',
        role: ChatMessageRole.ASSISTANT,
        content: 'Ans A',
      }),
      makeMessage({
        id: 'u2-v2',
        parentMessageId: 'a1',
        role: ChatMessageRole.USER,
        content: 'Plan B',
      }),
      makeMessage({
        id: 'a2-v2',
        parentMessageId: 'u2-v2',
        role: ChatMessageRole.ASSISTANT,
        content: 'Ans B',
      }),
    ];

    const latest = resolveActiveMessagePath(messages);
    expect(latest.nodes.map((n) => n.message.id)).toEqual(['u1', 'a1', 'u2-v2', 'a2-v2']);
    expect(latest.nodes[2]?.siblingCount).toBe(2);
    expect(latest.nodes[2]?.siblingIndex).toBe(1);
    expect(getAdjacentBranchId(latest.nodes[2]!, 'prev')).toBe('u2-v1');
    expect(getAdjacentBranchId(latest.nodes[2]!, 'next')).toBeNull();

    const firstBranch = resolveActiveMessagePath(messages, { a1: 'u2-v1' });
    expect(firstBranch.nodes.map((n) => n.message.id)).toEqual(['u1', 'a1', 'u2-v1', 'a2-v1']);
    expect(firstBranch.activeLeafMessageId).toBe('a2-v1');

    const rootBranch = resolveActiveMessagePath(messages, { [ROOT_BRANCH_PARENT_KEY]: 'u1' });
    expect(rootBranch.nodes[0]?.message.id).toBe('u1');
  });
});
