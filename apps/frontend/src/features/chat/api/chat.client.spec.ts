import type {
  DialogMessageResponseDto,
  DialogMessageStreamEventDto,
  DialogResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamDialogMessage } from '@/features/chat/api/chat.client';
import { ApiError } from '@/shared/api/api-client';

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('streamDialogMessage', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses chunked SSE events into user_message, delta, and done callbacks', async () => {
    const dialog: DialogResponseDto = {
      id: 'dialog-1',
      userId: 'user-1',
      title: 'Hello',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    };
    const userMessage: DialogMessageResponseDto = {
      id: 'msg-1',
      dialogId: 'dialog-1',
      role: ChatMessageRole.USER,
      content: 'Hello',
      model: null,
      latencyMs: null,
      usage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const assistantMessage: DialogMessageResponseDto = {
      id: 'msg-2',
      dialogId: 'dialog-1',
      role: ChatMessageRole.ASSISTANT,
      content: 'Hi there!',
      model: 'openrouter/free',
      latencyMs: 50,
      usage: null,
      createdAt: '2026-01-01T00:00:01.000Z',
    };

    const events: DialogMessageStreamEventDto[] = [
      { type: 'user_message', userMessage },
      { type: 'delta', delta: 'Hi ' },
      { type: 'delta', delta: 'there!' },
      { type: 'done', dialog, userMessage, assistantMessage },
    ];

    const raw = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const splitAt = Math.floor(raw.length / 2);

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream([raw.slice(0, splitAt), raw.slice(splitAt)]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const receivedDeltas: string[] = [];
    const onUserMessage = vi.fn();
    const onDone = vi.fn();

    const turn = await streamDialogMessage(
      'dialog-1',
      { content: 'Hello' },
      {
        onUserMessage,
        onDelta: (_delta, accumulated) => receivedDeltas.push(accumulated),
        onDone,
      },
    );

    expect(onUserMessage).toHaveBeenCalledWith(userMessage);
    expect(receivedDeltas).toEqual(['Hi ', 'Hi there!']);
    expect(onDone).toHaveBeenCalledWith({ dialog, userMessage, assistantMessage });
    expect(turn).toEqual({ dialog, userMessage, assistantMessage });
  });

  it('throws ApiError when SSE stream emits an error event', async () => {
    const errorEvent: DialogMessageStreamEventDto = {
      type: 'error',
      statusCode: 502,
      message: 'Upstream LLM failed',
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(createSseStream([`data: ${JSON.stringify(errorEvent)}\n\n`]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    await expect(streamDialogMessage('dialog-1', { content: 'Hello' })).rejects.toThrowError(
      new ApiError(502, 'Upstream LLM failed'),
    );
  });

  it('throws ApiError on non-ok HTTP response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Dialog not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(streamDialogMessage('missing', { content: 'Hello' })).rejects.toThrowError(
      new ApiError(404, 'Dialog not found'),
    );
  });
});
