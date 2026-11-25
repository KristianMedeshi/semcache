import type { ClientProxy } from '@nestjs/microservices';
import type { DialogMessageResponseDto, DialogResponseDto } from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { of } from 'rxjs';
import { DialogGraphService } from '../src/dialogs/dialog-graph.service';
import type { DialogsRepository } from '../src/dialogs/dialogs.repository';
import { DialogsService } from '../src/dialogs/dialogs.service';

export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_DIALOG_ID = '22222222-2222-4222-8222-222222222222';

export function createInMemoryDialogHarness(options?: {
  initialMessages?: DialogMessageResponseDto[];
  sendImpl?: jest.Mock;
  kbSendImpl?: jest.Mock;
  cacheSendImpl?: jest.Mock;
}) {
  let dialog: DialogResponseDto = {
    id: TEST_DIALOG_ID,
    userId: TEST_USER_ID,
    title: 'New Conversation',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const storedMessages: DialogMessageResponseDto[] = [...(options?.initialMessages ?? [])];

  const mockRepo: Partial<DialogsRepository> = {
    findDialogByIdForUser: jest.fn(async (id, owner) =>
      id === dialog.id && owner === TEST_USER_ID ? dialog : null,
    ),
    findMessageByIdForDialog: jest.fn(
      async (_dId, mId) => storedMessages.find((m) => m.id === mId) ?? null,
    ),
    insertMessage: jest.fn(async (input) => {
      const msg: DialogMessageResponseDto = {
        id: `msg-${storedMessages.length + 1}`,
        dialogId: input.dialogId,
        parentMessageId: input.parentMessageId ?? null,
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
    deleteAllDialogsByUser: jest.fn(async (owner) => (owner === TEST_USER_ID ? 1 : 0)),
    touchDialog: jest.fn(async (_id, title) => {
      dialog = {
        ...dialog,
        title: title ?? dialog.title,
        updatedAt: '2026-01-01T00:00:02.000Z',
      };
      return dialog;
    }),
  };

  const sendMock = options?.sendImpl ?? jest.fn();
  const mockLlmClient = { send: sendMock } as unknown as ClientProxy;
  const kbSendMock = options?.kbSendImpl;
  const mockKbClient = kbSendMock ? ({ send: kbSendMock } as unknown as ClientProxy) : undefined;
  const cacheSendMock = options?.cacheSendImpl;
  const mockCacheClient = cacheSendMock
    ? ({ send: cacheSendMock } as unknown as ClientProxy)
    : undefined;
  const graphService = new DialogGraphService(
    mockRepo as DialogsRepository,
    mockLlmClient,
    mockKbClient,
    undefined,
    mockCacheClient,
  );
  const service = new DialogsService(mockRepo as DialogsRepository, graphService);

  return {
    userId: TEST_USER_ID,
    dialogId: TEST_DIALOG_ID,
    service,
    sendMock,
    kbSendMock,
    cacheSendMock,
  };
}

export function extractSentSystemPrompt(sendMock: jest.Mock, callIndex = 0): string {
  const sentPayload = sendMock.mock.calls[callIndex] as unknown as [
    string,
    { messages: Array<{ role: ChatMessageRole; content: string }> },
  ];
  return sentPayload[1].messages.find((m) => m.role === ChatMessageRole.SYSTEM)?.content ?? '';
}

export function createMockEmbeddingResponse(embedding: number[] = Array(384).fill(0.05)) {
  return of({
    embeddings: [embedding],
    model: 'local',
    dimensions: 384,
    latencyMs: 5,
    usage: { totalTokens: 4 },
  });
}
