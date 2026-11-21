import { NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { firstValueFrom, of, toArray } from 'rxjs';
import { DialogGraphService } from './dialog-graph.service';
import type { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';

describe('DialogsService & DialogGraphService', () => {
  it('executes a LangGraph dialog turn, persists user & assistant messages, and updates title', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const dialogId = '22222222-2222-4222-8222-222222222222';
    let dialog: DialogResponseDto = {
      id: dialogId,
      userId,
      title: 'New Conversation',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const storedMessages: DialogMessageResponseDto[] = [];

    const mockRepo: Partial<DialogsRepository> = {
      findDialogByIdForUser: jest.fn(async (id, owner) =>
        id === dialog.id && owner === userId ? dialog : null,
      ),
      insertMessage: jest.fn(async (input) => {
        const msg: DialogMessageResponseDto = {
          id: `msg-${storedMessages.length + 1}`,
          dialogId: input.dialogId,
          role: input.role,
          content: input.content,
          model: input.model ?? null,
          latencyMs: input.latencyMs ?? null,
          usage: input.usage ?? null,
          createdAt: '2026-01-01T00:00:01.000Z',
        };
        storedMessages.push(msg);
        return msg;
      }),
      findMessagesByDialog: jest.fn(async () => [...storedMessages]),
      touchDialog: jest.fn(async (_id, title) => {
        dialog = {
          ...dialog,
          title: title ?? dialog.title,
          updatedAt: '2026-01-01T00:00:02.000Z',
        };
        return dialog;
      }),
    };

    const completionPayload: LlmChatCompletionResponseDto = {
      content: 'You can reset your password from Account Settings.',
      model: 'openrouter/free',
      latencyMs: 142,
      usage: { promptTokens: 25, completionTokens: 11, totalTokens: 36 },
    };

    const sendMock = jest.fn(() => of(completionPayload));
    const mockLlmClient = { send: sendMock } as unknown as ClientProxy;

    const graphService = new DialogGraphService(mockRepo as DialogsRepository, mockLlmClient);
    const service = new DialogsService(mockRepo as DialogsRepository, graphService);

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
    const userId = '11111111-1111-4111-8111-111111111111';
    const dialogId = '22222222-2222-4222-8222-222222222222';
    let dialog: DialogResponseDto = {
      id: dialogId,
      userId,
      title: 'New Conversation',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const storedMessages: DialogMessageResponseDto[] = [];

    const mockRepo: Partial<DialogsRepository> = {
      findDialogByIdForUser: jest.fn(async (id, owner) =>
        id === dialog.id && owner === userId ? dialog : null,
      ),
      insertMessage: jest.fn(async (input) => {
        const msg: DialogMessageResponseDto = {
          id: `msg-${storedMessages.length + 1}`,
          dialogId: input.dialogId,
          role: input.role,
          content: input.content,
          model: input.model ?? null,
          latencyMs: input.latencyMs ?? null,
          usage: input.usage ?? null,
          createdAt: '2026-01-01T00:00:01.000Z',
        };
        storedMessages.push(msg);
        return msg;
      }),
      findMessagesByDialog: jest.fn(async () => [...storedMessages]),
      touchDialog: jest.fn(async (_id, title) => {
        dialog = {
          ...dialog,
          title: title ?? dialog.title,
          updatedAt: '2026-01-01T00:00:02.000Z',
        };
        return dialog;
      }),
    };

    const sendMock = jest.fn(() =>
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
    );
    const mockLlmClient = { send: sendMock } as unknown as ClientProxy;

    const graphService = new DialogGraphService(mockRepo as DialogsRepository, mockLlmClient);
    const service = new DialogsService(mockRepo as DialogsRepository, graphService);

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
});
