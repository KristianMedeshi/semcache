import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { firstValueFrom, of, toArray } from 'rxjs';
import {
  TEST_DIALOG_ID,
  TEST_USER_ID,
  createInMemoryDialogHarness,
} from '../../test/dialog-test-helpers';
import { DialogGraphService } from './dialog-graph.service';
import type { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';

describe('DialogsService', () => {
  it('executes a LangGraph dialog turn, persists user & assistant messages, and updates title', async () => {
    const completionPayload: LlmChatCompletionResponseDto = {
      content: 'You can reset your password from Account Settings.',
      model: 'openrouter/free',
      latencyMs: 142,
      usage: { promptTokens: 25, completionTokens: 11, totalTokens: 36 },
    };
    const { userId, dialogId, service, sendMock } = createInMemoryDialogHarness({
      sendImpl: jest.fn(() => of(completionPayload)),
    });

    const turn = await service.sendMessage(userId, dialogId, {
      content: 'How do I reset my password?',
      model: 'openrouter/free',
    });

    expect(sendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.LLM_CHAT, {
      messages: expect.any(Array),
      model: 'openrouter/free',
    });
    expect(turn.dialog.title).toBe('How do I reset my password?');
    expect(turn.userMessage.role).toBe(ChatMessageRole.USER);
    expect(turn.assistantMessage.role).toBe(ChatMessageRole.ASSISTANT);
    expect(turn.assistantMessage.content).toBe(
      'You can reset your password from Account Settings.',
    );
    expect(turn.assistantMessage.model).toBe('openrouter/free');
    expect(turn.assistantMessage.latencyMs).toBe(142);
    expect(turn.assistantMessage.usage).toEqual({
      promptTokens: 25,
      completionTokens: 11,
      totalTokens: 36,
    });
  });

  it('throws NotFoundException when dialog belongs to another user or does not exist', async () => {
    const mockRepo: Partial<DialogsRepository> = {
      findDialogByIdForUser: jest.fn(async () => null),
    };
    const mockLlmClient = { send: jest.fn() } as unknown as ClientProxy;
    const graphService = new DialogGraphService(mockRepo as DialogsRepository, mockLlmClient);
    const service = new DialogsService(mockRepo as DialogsRepository, graphService);

    await expect(
      service.getDialogMessages(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('streams user_message, delta chunks, and done event while persisting messages', async () => {
    const { userId, dialogId, service, sendMock } = createInMemoryDialogHarness({
      sendImpl: jest.fn(() =>
        of(
          { type: 'delta', delta: 'You can reset ' },
          { type: 'delta', delta: 'your password in Settings.' },
          {
            type: 'done',
            completion: {
              content: 'You can reset your password in Settings.',
              model: 'openrouter/free',
              latencyMs: 95,
              usage: { promptTokens: 20, completionTokens: 9, totalTokens: 29 },
            },
          },
        ),
      ),
    });

    const events = await firstValueFrom(
      service
        .streamMessage(userId, dialogId, {
          content: 'How do I reset my password?',
          model: 'openrouter/free',
        })
        .pipe(toArray()),
    );

    expect(sendMock).toHaveBeenCalledWith(SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM, {
      messages: expect.any(Array),
      model: 'openrouter/free',
    });
    expect(events).toHaveLength(4);
    expect(events[0]?.type).toBe('user_message');
    expect(events[1]).toEqual({ type: 'delta', delta: 'You can reset ' });
    expect(events[2]).toEqual({ type: 'delta', delta: 'your password in Settings.' });
    expect(events[3]).toMatchObject({
      type: 'done',
      dialog: { id: dialogId, title: 'How do I reset my password?' },
      assistantMessage: {
        content: 'You can reset your password in Settings.',
        model: 'openrouter/free',
        latencyMs: 95,
      },
    });
  });

  it('updates dialog title and deletes owned dialog', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const dialogId = '22222222-2222-4222-8222-222222222222';
    const dialog: DialogResponseDto = {
      id: dialogId,
      userId,
      title: 'Original Title',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const mockRepo: Partial<DialogsRepository> = {
      findDialogByIdForUser: jest.fn(async (id, owner) =>
        id === dialog.id && owner === userId ? dialog : null,
      ),
      updateDialogTitle: jest.fn(async (_id, _owner, title) => ({
        ...dialog,
        title,
        updatedAt: '2026-01-01T00:05:00.000Z',
      })),
      deleteDialog: jest.fn(async () => true),
    };

    const graphService = new DialogGraphService(
      mockRepo as DialogsRepository,
      { send: jest.fn() } as unknown as ClientProxy,
    );
    const service = new DialogsService(mockRepo as DialogsRepository, graphService);

    const updated = await service.updateDialogTitle(userId, dialogId, { title: 'Billing Help' });
    expect(updated.title).toBe('Billing Help');

    const deleted = await service.deleteDialog(userId, dialogId);
    expect(deleted).toEqual({ id: dialogId, deleted: true });
    expect(mockRepo.deleteDialog).toHaveBeenCalledWith(dialogId, userId);
  });

  it('creates a sibling branch when editing a user message and sends only ancestor history to LLM', async () => {
    const userId = TEST_USER_ID;
    const dialogId = TEST_DIALOG_ID;
    const storedMessages: DialogMessageResponseDto[] = [
      {
        id: 'm-1',
        dialogId,
        parentMessageId: null,
        role: ChatMessageRole.USER,
        content: 'First question',
        model: null,
        latencyMs: null,
        usage: null,
        createdAt: '2026-01-01T00:00:01.000Z',
      },
      {
        id: 'm-2',
        dialogId,
        parentMessageId: 'm-1',
        role: ChatMessageRole.ASSISTANT,
        content: 'First answer',
        model: 'openrouter/free',
        latencyMs: 50,
        usage: null,
        createdAt: '2026-01-01T00:00:02.000Z',
      },
      {
        id: 'm-3',
        dialogId,
        parentMessageId: 'm-2',
        role: ChatMessageRole.USER,
        content: 'Old follow-up',
        model: null,
        latencyMs: null,
        usage: null,
        createdAt: '2026-01-01T00:00:03.000Z',
      },
      {
        id: 'm-4',
        dialogId,
        parentMessageId: 'm-3',
        role: ChatMessageRole.ASSISTANT,
        content: 'Old follow-up answer',
        model: 'openrouter/free',
        latencyMs: 60,
        usage: null,
        createdAt: '2026-01-01T00:00:04.000Z',
      },
    ];

    const { service, sendMock } = createInMemoryDialogHarness({
      initialMessages: storedMessages,
      sendImpl: jest.fn(() =>
        of({
          content: 'Edited follow-up answer',
          model: 'openrouter/free',
          latencyMs: 75,
          usage: { promptTokens: 15, completionTokens: 8, totalTokens: 23 },
        }),
      ),
    });

    await expect(
      service.editMessage(userId, dialogId, 'm-2', { content: 'Cannot edit assistant' }),
    ).rejects.toThrow(BadRequestException);

    const turn = await service.editMessage(userId, dialogId, 'm-3', {
      content: 'Edited follow-up',
    });

    expect(turn.userMessage.parentMessageId).toBe('m-2');
    expect(turn.assistantMessage.parentMessageId).toBe(turn.userMessage.id);

    const sentPayload = sendMock.mock.calls[0] as unknown as [
      string,
      { messages: Array<{ role: ChatMessageRole; content: string }> },
    ];
    expect(sentPayload[1].messages.map((m) => m.content)).not.toContain('Old follow-up');
    expect(sentPayload[1].messages.map((m) => m.content)).not.toContain('Old follow-up answer');
    expect(sentPayload[1].messages.map((m) => m.content)).toContain('First question');
    expect(sentPayload[1].messages.map((m) => m.content)).toContain('First answer');
    expect(sentPayload[1].messages.map((m) => m.content)).toContain('Edited follow-up');
  });

  it('deletes all dialogs for the requesting user and returns deletedCount', async () => {
    const { userId, service } = createInMemoryDialogHarness();

    const result = await service.deleteAllDialogs(userId);

    expect(result).toEqual({ deletedCount: 1, deleted: true });
  });

  it('returns aggregate dialog statistics from repository', async () => {
    const { service } = createInMemoryDialogHarness();

    const stats = await service.getStats();

    expect(stats).toMatchObject({
      totalDialogs: 1,
      activeUsersCount: 1,
      totalMessages: 0,
      cacheHitRate: 0,
    });
  });
});
