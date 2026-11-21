import type {
  CreateDialogRequestDto,
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageRequestDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDialog,
  getDialogMessages,
  listDialogs,
  sendDialogMessage,
  streamDialogMessage,
} from '@/features/chat/api/chat.client';
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

export function useStreamMessageMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ dialogId, dto }: { dialogId: string; dto: SendMessageRequestDto }) => {
      const optimisticUserId = `${OPTIMISTIC_USER_MESSAGE_PREFIX}${Date.now()}`;
      const messagesKey = queryKeys.dialogs.messages(dialogId);
      let persistedUserId: string | null = null;

      const optimisticUserMessage: DialogMessageResponseDto = {
        id: optimisticUserId,
        dialogId,
        role: ChatMessageRole.USER,
        content: dto.content,
        model: null,
        latencyMs: null,
        usage: null,
        createdAt: new Date().toISOString(),
      };

      client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) =>
        prev ? [...prev, optimisticUserMessage] : [optimisticUserMessage],
      );

      try {
        return await streamDialogMessage(dialogId, dto, {
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
          },
          onDelta: (_delta, accumulated) => {
            client.setQueryData<DialogMessageResponseDto[]>(messagesKey, (prev) => {
              const streamingMessage: DialogMessageResponseDto = {
                id: STREAMING_ASSISTANT_MESSAGE_ID,
                dialogId,
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

              const existingIdx = prev.findIndex(
                (msg) => msg.id === STREAMING_ASSISTANT_MESSAGE_ID,
              );
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
    },
    onSuccess: (turn) => {
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
    },
  });
}
