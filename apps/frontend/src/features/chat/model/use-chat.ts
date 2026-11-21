import type {
  CreateDialogRequestDto,
  DialogMessageResponseDto,
  DialogResponseDto,
  EditMessageRequestDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
  UpdateDialogRequestDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type StreamDialogMessageCallbacks,
  createDialog,
  deleteDialog,
  getDialogMessages,
  listDialogs,
  sendDialogMessage,
  streamDialogMessage,
  streamEditDialogMessage,
  updateDialog,
} from '@/features/chat/api/chat.client';
import { getBranchParentKey } from '@/features/chat/model/message-graph';
import { queryKeys } from '@/shared/api/query-client';

export const STREAMING_ASSISTANT_MESSAGE_ID = 'streaming-assistant';
const OPTIMISTIC_USER_MESSAGE_PREFIX = 'optimistic-user-';

export function useDialogsQuery() {
  return useQuery({
    queryKey: queryKeys.dialogs.list(),
    queryFn: listDialogs,
  });
}

export function useDialogMessagesQuery(dialogId: string | null) {
  return useQuery({
    queryKey: queryKeys.dialogs.messages(dialogId ?? 'none'),
    queryFn: () => getDialogMessages(dialogId!),
    enabled: Boolean(dialogId),
  });
}

export function useCreateDialogMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateDialogRequestDto = {}) => createDialog(dto),
    onSuccess: (created) => {
      client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), (prev) =>
        prev ? [created, ...prev.filter((d) => d.id !== created.id)] : [created],
      );
    },
  });
}

export function useUpdateDialogMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ dialogId, dto }: { dialogId: string; dto: UpdateDialogRequestDto }) =>
      updateDialog(dialogId, dto),
    onSuccess: (updated) => {
      client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), (prev) =>
        prev ? prev.map((d) => (d.id === updated.id ? updated : d)) : [updated],
      );
    },
  });
}

export function useDeleteDialogMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (dialogId: string) => deleteDialog(dialogId),
    onSuccess: ({ id }) => {
      client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), (prev) =>
        prev ? prev.filter((d) => d.id !== id) : [],
      );
      client.removeQueries({ queryKey: queryKeys.dialogs.messages(id) });
    },
  });
}

export function useSendMessageMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ dialogId, dto }: { dialogId: string; dto: SendMessageRequestDto }) =>
      sendDialogMessage(dialogId, dto),
    onSuccess: (turn) => {
      client.setQueryData<DialogMessageResponseDto[]>(
        queryKeys.dialogs.messages(turn.dialog.id),
        (prev) =>
          prev
            ? [...prev, turn.userMessage, turn.assistantMessage]
            : [turn.userMessage, turn.assistantMessage],
      );
      client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), (prev) =>
        prev ? [turn.dialog, ...prev.filter((d) => d.id !== turn.dialog.id)] : [turn.dialog],
      );
    },
  });
}

async function runOptimisticStreamTurn(
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
        client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) => {
          const streamingMessage: DialogMessageResponseDto = {
            id: STREAMING_ASSISTANT_MESSAGE_ID,
            dialogId: options.dialogId,
            parentMessageId: persistedUserId ?? optimisticUserId,
            role: ChatMessageRole.ASSISTANT,
            content: accumulated,
            model: null,
            latencyMs: null,
            usage: null,
            createdAt: new Date().toISOString(),
          };

          if (!prev) {
            return [streamingMessage];
          }

          const existingIdx = prev.findIndex((msg) => msg.id === STREAMING_ASSISTANT_MESSAGE_ID);
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], content: accumulated };
            return next;
          }
          return [...prev, streamingMessage];
        });
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

function finalizeTurnCache(client: QueryClient, turn: SendMessageResponseDto): void {
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
  client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), (prev) =>
    prev ? [turn.dialog, ...prev.filter((d) => d.id !== turn.dialog.id)] : [turn.dialog],
  );
}

export function useStreamMessageMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ dialogId, dto }: { dialogId: string; dto: SendMessageRequestDto }) =>
      runOptimisticStreamTurn(client, {
        dialogId,
        content: dto.content,
        parentMessageId: dto.parentMessageId ?? null,
        executeStream: (callbacks) => streamDialogMessage(dialogId, dto, callbacks),
      }),
    onSuccess: (turn) => finalizeTurnCache(client, turn),
  });
}

export function useStreamEditMessageMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({
      dialogId,
      messageId,
      parentMessageId,
      dto,
      onBranchCreated,
    }: {
      dialogId: string;
      messageId: string;
      parentMessageId: string | null;
      dto: EditMessageRequestDto;
      onBranchCreated?: (parentKey: string, newMessageId: string) => void;
    }) =>
      runOptimisticStreamTurn(client, {
        dialogId,
        content: dto.content,
        parentMessageId,
        onBranchCreated,
        executeStream: (callbacks) => streamEditDialogMessage(dialogId, messageId, dto, callbacks),
      }),
    onSuccess: (turn) => finalizeTurnCache(client, turn),
  });
}
