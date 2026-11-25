import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import type { QueryClient } from '@tanstack/react-query';
import type { StreamDialogMessageCallbacks } from '@/features/chat/api/chat.client';
import { getBranchParentKey } from '@/features/chat/model/message-graph';
import { queryKeys } from '@/shared/api/query-client';

export const STREAMING_ASSISTANT_MESSAGE_ID = 'streaming-assistant';
export const OPTIMISTIC_USER_MESSAGE_PREFIX = 'optimistic-user-';

export function upsertDialogInListCache(client: QueryClient, dialog: DialogResponseDto): void {
  client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), (prev) =>
    prev ? [dialog, ...prev.filter((d) => d.id !== dialog.id)] : [dialog],
  );
}

function buildStreamingAssistantMessage(
  dialogId: string,
  parentMessageId: string,
  content: string,
): DialogMessageResponseDto {
  return {
    id: STREAMING_ASSISTANT_MESSAGE_ID,
    dialogId,
    parentMessageId,
    role: ChatMessageRole.ASSISTANT,
    content,
    model: null,
    latencyMs: null,
    usage: null,
    createdAt: new Date().toISOString(),
  };
}

function applyStreamingDeltaToCache(
  client: QueryClient,
  messagesKey: ReturnType<typeof queryKeys.dialogs.messages>,
  dialogId: string,
  parentMessageId: string,
  accumulated: string,
): void {
  client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) => {
    if (!prev) {
      return [buildStreamingAssistantMessage(dialogId, parentMessageId, accumulated)];
    }

    const existingIdx = prev.findIndex((msg) => msg.id === STREAMING_ASSISTANT_MESSAGE_ID);
    if (existingIdx >= 0) {
      const next = [...prev];
      next[existingIdx] = { ...next[existingIdx], content: accumulated };
      return next;
    }
    return [...prev, buildStreamingAssistantMessage(dialogId, parentMessageId, accumulated)];
  });
}

export async function runOptimisticStreamTurn(
  client: QueryClient,
  options: {
    dialogId: string;
    content: string;
    parentMessageId: string | null;
    onBranchCreated?: (parentKey: string, messageId: string) => void;
    executeStream: (callbacks: StreamDialogMessageCallbacks) => Promise<SendMessageResponseDto>;
  },
): Promise<SendMessageResponseDto> {
  const optimisticUserId = `${OPTIMISTIC_USER_MESSAGE_PREFIX}${Date.now()}`;
  const messagesKey = queryKeys.dialogs.messages(options.dialogId);
  const parentKey = getBranchParentKey(options.parentMessageId);
  let persistedUserId: string | null = null;

  const optimisticUserMessage: DialogMessageResponseDto = {
    id: optimisticUserId,
    dialogId: options.dialogId,
    parentMessageId: options.parentMessageId,
    role: ChatMessageRole.USER,
    content: options.content,
    model: null,
    latencyMs: null,
    usage: null,
    createdAt: new Date().toISOString(),
  };

  client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) =>
    prev ? [...prev, optimisticUserMessage] : [optimisticUserMessage],
  );
  options.onBranchCreated?.(parentKey, optimisticUserId);

  try {
    return await options.executeStream({
      onUserMessage: (userMessage) => {
        persistedUserId = userMessage.id;
        client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) => {
          if (!prev) {
            return [userMessage];
          }
          const withoutTemp = prev.filter(
            (msg) => msg.id !== optimisticUserId && msg.id !== userMessage.id,
          );
          return [...withoutTemp, userMessage];
        });
        options.onBranchCreated?.(parentKey, userMessage.id);
      },
      onDelta: (_delta, accumulated) => {
        applyStreamingDeltaToCache(
          client,
          messagesKey,
          options.dialogId,
          persistedUserId ?? optimisticUserId,
          accumulated,
        );
      },
    });
  } catch (error) {
    client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) =>
      prev
        ? prev.filter(
            (msg) =>
              msg.id !== STREAMING_ASSISTANT_MESSAGE_ID &&
              (persistedUserId ? true : msg.id !== optimisticUserId),
          )
        : prev,
    );
    throw error;
  }
}

export function finalizeTurnCache(client: QueryClient, turn: SendMessageResponseDto): void {
  client.setQueryData<DialogMessageResponseDto[]>(
    queryKeys.dialogs.messages(turn.dialog.id),
    (prev) => {
      const base = (prev ?? []).filter(
        (msg) =>
          !msg.id.startsWith(OPTIMISTIC_USER_MESSAGE_PREFIX) &&
          msg.id !== STREAMING_ASSISTANT_MESSAGE_ID &&
          msg.id !== turn.userMessage.id &&
          msg.id !== turn.assistantMessage.id,
      );
      return [...base, turn.userMessage, turn.assistantMessage];
    },
  );
  upsertDialogInListCache(client, turn.dialog);
}
