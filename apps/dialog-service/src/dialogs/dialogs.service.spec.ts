import { NotFoundException } from '@nestjs/common';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { DialogConfigService } from '../config/dialog-config.service';
import { DialogGraphService } from './dialog-graph.service';
import type { DialogsRepository } from './dialogs.repository';
import { DialogsService } from './dialogs.service';

describe('DialogsService & DialogGraphService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.LLM_SERVICE_URL = 'http://127.0.0.1:3004';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

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

    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify(completionPayload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch;

    const config = new DialogConfigService();
    const graphService = new DialogGraphService(mockRepo as DialogsRepository, config);
    const service = new DialogsService(mockRepo as DialogsRepository, graphService);

    const turn = await service.sendMessage(userId, dialogId, {
      content: 'How do I reset my password?',
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
    const config = new DialogConfigService();
    const graphService = new DialogGraphService(mockRepo as DialogsRepository, config);
    const service = new DialogsService(mockRepo as DialogsRepository, graphService);

    await expect(
      service.getDialogMessages(
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
