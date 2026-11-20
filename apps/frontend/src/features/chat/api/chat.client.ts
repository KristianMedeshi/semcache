import type {
  CreateDialogRequestDto,
  DialogMessageResponseDto,
  DialogResponseDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
} from '@semcache/shared-dtos';
import { apiClient } from '@/shared/api/api-client';

export async function listDialogs(): Promise<DialogResponseDto[]> {
  const { data } = await apiClient.get<DialogResponseDto[]>('/dialogs');
  return data;
}

export async function createDialog(dto: CreateDialogRequestDto = {}): Promise<DialogResponseDto> {
  const { data } = await apiClient.post<DialogResponseDto>('/dialogs', dto);
  return data;
}

export async function getDialogMessages(dialogId: string): Promise<DialogMessageResponseDto[]> {
  const { data } = await apiClient.get<DialogMessageResponseDto[]>(
    `/dialogs/${encodeURIComponent(dialogId)}/messages`,
  );
  return data;
}

export async function sendDialogMessage(
  dialogId: string,
  dto: SendMessageRequestDto,
): Promise<SendMessageResponseDto> {
  const { data } = await apiClient.post<SendMessageResponseDto>(
    `/dialogs/${encodeURIComponent(dialogId)}/messages`,
    dto,
  );
  return data;
}
