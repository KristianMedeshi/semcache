import type {
  CreateDialogRequestDto,
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageRequestDto,
} from '@semcache/shared-dtos';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDialog,
  getDialogMessages,
  listDialogs,
  sendDialogMessage,
} from '@/features/chat/api/chat.client';
import { queryKeys } from '@/shared/api/query-client';

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
