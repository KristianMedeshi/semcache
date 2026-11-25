import type {
  CreateDialogRequestDto,
  DialogMessageResponseDto,
  DialogResponseDto,
  EditMessageRequestDto,
  SendMessageRequestDto,
  UpdateDialogRequestDto,
} from '@semcache/shared-dtos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDialog,
  deleteAllDialogs,
  deleteDialog,
  getDialogMessages,
  listDialogs,
  sendDialogMessage,
  streamDialogMessage,
  streamEditDialogMessage,
  updateDialog,
} from '@/features/chat/api/chat.client';
import {
  STREAMING_ASSISTANT_MESSAGE_ID,
  finalizeTurnCache,
  runOptimisticStreamTurn,
  upsertDialogInListCache,
} from '@/features/chat/model/chat-stream-cache';
import { queryKeys } from '@/shared/api/query-client';

export { STREAMING_ASSISTANT_MESSAGE_ID };

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
    onSuccess: (created) => upsertDialogInListCache(client, created),
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

export function useDeleteAllDialogsMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => deleteAllDialogs(),
    onSuccess: () => {
      client.setQueryData<DialogResponseDto[]>(queryKeys.dialogs.list(), []);
      client.removeQueries({
        queryKey: queryKeys.dialogs.all,
        predicate: (query) => query.queryKey[1] === 'messages',
      });
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
      upsertDialogInListCache(client, turn.dialog);
    },
  });
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
