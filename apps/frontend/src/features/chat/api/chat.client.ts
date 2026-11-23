import type {
  CreateDialogRequestDto,
  DeleteAllDialogsResponseDto,
  DeleteDialogResponseDto,
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
  EditMessageRequestDto,
  SendMessageRequestDto,
  SendMessageResponseDto,
  UpdateDialogRequestDto,
} from '@semcache/shared-dtos';
import {
  ApiError,
  apiClient,
  extractPayloadErrorMessage,
  getApiBaseUrl,
  notifyUnauthorized,
} from '@/shared/api/api-client';

export async function listDialogs(): Promise<DialogResponseDto[]> {
  const { data } = await apiClient.get<DialogResponseDto[]>('/dialogs');
  return data;
}

export async function createDialog(dto: CreateDialogRequestDto = {}): Promise<DialogResponseDto> {
  const { data } = await apiClient.post<DialogResponseDto>('/dialogs', dto);
  return data;
}

export async function updateDialog(
  dialogId: string,
  dto: UpdateDialogRequestDto,
): Promise<DialogResponseDto> {
  const { data } = await apiClient.patch<DialogResponseDto>(
    `/dialogs/${encodeURIComponent(dialogId)}`,
    dto,
  );
  return data;
}

export async function deleteDialog(dialogId: string): Promise<DeleteDialogResponseDto> {
  const { data } = await apiClient.delete<DeleteDialogResponseDto>(
    `/dialogs/${encodeURIComponent(dialogId)}`,
  );
  return data;
}

export async function deleteAllDialogs(): Promise<DeleteAllDialogsResponseDto> {
  const { data } = await apiClient.delete<DeleteAllDialogsResponseDto>('/dialogs');
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

export async function editDialogMessage(
  dialogId: string,
  messageId: string,
  dto: EditMessageRequestDto,
): Promise<SendMessageResponseDto> {
  const { data } = await apiClient.post<SendMessageResponseDto>(
    `/dialogs/${encodeURIComponent(dialogId)}/messages/${encodeURIComponent(messageId)}/edit`,
    dto,
  );
  return data;
}

export interface StreamDialogMessageCallbacks {
  onUserMessage?: (userMessage: DialogMessageResponseDto) => void;
  onDelta?: (delta: string, accumulated: string) => void;
  onDone?: (turn: SendMessageResponseDto) => void;
  signal?: AbortSignal;
}

function parseSseDataBlocks(rawChunk: string): {
  events: DialogMessageStreamEventDto[];
  remainder: string;
} {
  const normalized = rawChunk.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const remainder = blocks.pop() ?? '';
  const events: DialogMessageStreamEventDto[] = [];

  for (const block of blocks) {
    const dataLines = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join('\n').trim();
    if (!payload) {
      continue;
    }

    events.push(JSON.parse(payload) as DialogMessageStreamEventDto);
  }

  return { events, remainder };
}

async function streamSseDialogTurn(
  url: string,
  body: SendMessageRequestDto | EditMessageRequestDto,
  callbacks: StreamDialogMessageCallbacks = {},
): Promise<SendMessageResponseDto> {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: callbacks.signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }

    let payload: { message?: string | string[] } | undefined;
    try {
      payload = (await response.json()) as { message?: string | string[] };
    } catch {
      payload = undefined;
    }

    throw new ApiError(
      response.status,
      extractPayloadErrorMessage(payload, response.statusText || 'Request failed'),
    );
  }

  if (!response.body) {
    throw new ApiError(502, 'Streaming response body is unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let finalTurn: SendMessageResponseDto | null = null;

  const handleEvent = (event: DialogMessageStreamEventDto) => {
    switch (event.type) {
      case 'user_message':
        callbacks.onUserMessage?.(event.userMessage);
        break;
      case 'delta':
        accumulated += event.delta;
        callbacks.onDelta?.(event.delta, accumulated);
        break;
      case 'done':
        finalTurn = {
          dialog: event.dialog,
          userMessage: event.userMessage,
          assistantMessage: event.assistantMessage,
        };
        callbacks.onDone?.(finalTurn);
        break;
      case 'error':
        throw new ApiError(event.statusCode, event.message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseDataBlocks(buffer);
    buffer = parsed.remainder;
    for (const event of parsed.events) {
      handleEvent(event);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    const parsed = parseSseDataBlocks(`${buffer}\n\n`);
    for (const event of parsed.events) {
      handleEvent(event);
    }
  }

  if (!finalTurn) {
    throw new ApiError(502, 'Stream ended before completion');
  }

  return finalTurn;
}

export async function streamDialogMessage(
  dialogId: string,
  dto: SendMessageRequestDto,
  callbacks: StreamDialogMessageCallbacks = {},
): Promise<SendMessageResponseDto> {
  return streamSseDialogTurn(
    `${getApiBaseUrl()}/dialogs/${encodeURIComponent(dialogId)}/messages/stream`,
    dto,
    callbacks,
  );
}

export async function streamEditDialogMessage(
  dialogId: string,
  messageId: string,
  dto: EditMessageRequestDto,
  callbacks: StreamDialogMessageCallbacks = {},
): Promise<SendMessageResponseDto> {
  return streamSseDialogTurn(
    `${getApiBaseUrl()}/dialogs/${encodeURIComponent(dialogId)}/messages/${encodeURIComponent(messageId)}/edit/stream`,
    dto,
    callbacks,
  );
}
