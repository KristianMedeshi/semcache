import { QueryClientProvider } from '@tanstack/react-query';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole, UserRole } from '@semcache/shared-types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chatClient from '@/features/chat/api/chat.client';
import { ChatWorkspace } from '@/features/chat/ui/chat-workspace';
import { createAppQueryClient } from '@/shared/api/query-client';

vi.mock('@/features/chat/api/chat.client', () => ({
  listDialogs: vi.fn(),
  createDialog: vi.fn(),
  getDialogMessages: vi.fn(),
  sendDialogMessage: vi.fn(),
  streamDialogMessage: vi.fn(),
}));

const testUser: UserResponseDto = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'customer@example.com',
  role: UserRole.CUSTOMER,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderChatWorkspace() {
  const client = createAppQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ChatWorkspace user={testUser} />
    </QueryClientProvider>,
  );
}

describe('ChatWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('displays Telecom Assistant welcome state and all 6 suggestion cards, sending a question without exposing internal cache/LLM metrics', async () => {
    const user = userEvent.setup();
    const createdDialog: DialogResponseDto = {
      id: '22222222-2222-4222-8222-222222222222',
      userId: testUser.id,
      title: 'New Conversation',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const userMsg: DialogMessageResponseDto = {
      id: 'm-1',
      dialogId: createdDialog.id,
      role: ChatMessageRole.USER,
      content: 'How do I activate my eSIM?',
      model: null,
      latencyMs: null,
      usage: null,
      createdAt: '2026-01-01T00:00:01.000Z',
    };
    const assistantMsg: DialogMessageResponseDto = {
      id: 'm-2',
      dialogId: createdDialog.id,
      role: ChatMessageRole.ASSISTANT,
      content:
        '### eSIM Activation Steps\n\n1. Open **Settings > Cellular**.\n2. Scan your QR code.',
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      latencyMs: 180,
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      createdAt: '2026-01-01T00:00:02.000Z',
    };

    vi.mocked(chatClient.listDialogs).mockResolvedValueOnce([]);
    vi.mocked(chatClient.createDialog).mockResolvedValueOnce(createdDialog);
    vi.mocked(chatClient.getDialogMessages).mockResolvedValue([]);
    vi.mocked(chatClient.streamDialogMessage).mockImplementationOnce(
      async (_dialogId, _dto, callbacks) => {
        callbacks?.onUserMessage?.(userMsg);
        callbacks?.onDelta?.('### eSIM Activation Steps\n\n', '### eSIM Activation Steps\n\n');
        callbacks?.onDelta?.(
          '1. Open **Settings > Cellular**.\n2. Scan your QR code.',
          assistantMsg.content,
        );
        const turn = {
          dialog: { ...createdDialog, title: 'How do I activate my eSIM?' },
          userMessage: userMsg,
          assistantMessage: assistantMsg,
        };
        callbacks?.onDone?.(turn);
        return turn;
      },
    );

    renderChatWorkspace();

    expect(await screen.findByText('Hello! Welcome to SemCache Support.')).toBeVisible();
    expect(screen.getByText('Telecom Assistant')).toBeVisible();
    expect(screen.getByText('Which mobile plan is right for me?')).toBeVisible();
    expect(screen.getByText('How much mobile data do I have left?')).toBeVisible();
    expect(screen.getByText('How can I pay my bill?')).toBeVisible();
    expect(screen.getByText('How does international roaming work?')).toBeVisible();
    expect(screen.getByText('How do I activate my eSIM?')).toBeVisible();
    expect(screen.getByText("My mobile internet isn't working.")).toBeVisible();

    await user.click(screen.getByRole('button', { name: /how do i activate my esim\?/i }));

    await waitFor(() => {
      expect(chatClient.streamDialogMessage).toHaveBeenCalledWith(
        createdDialog.id,
        { content: 'How do I activate my eSIM?' },
        expect.objectContaining({
          onUserMessage: expect.any(Function),
          onDelta: expect.any(Function),
        }),
      );
    });

    expect(await screen.findByText('eSIM Activation Steps')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Helpful response' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Not helpful response' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy response' })).toBeVisible();

    // Verify internal model/cache metadata is never exposed to the customer
    expect(screen.queryByText('nvidia/nemotron-3-ultra-550b-a55b:free')).not.toBeInTheDocument();
    expect(screen.queryByText('180 ms')).not.toBeInTheDocument();
    expect(screen.queryByText('30 tokens')).not.toBeInTheDocument();
  });

  it('supports Enter to send and Shift+Enter for newline in the composer, and opens human agent escalation dialog', async () => {
    const user = userEvent.setup();
    const existingDialog: DialogResponseDto = {
      id: '33333333-3333-4333-8333-333333333333',
      userId: testUser.id,
      title: 'Roaming Inquiry',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(chatClient.listDialogs).mockResolvedValueOnce([existingDialog]);
    vi.mocked(chatClient.getDialogMessages).mockResolvedValue([]);
    vi.mocked(chatClient.streamDialogMessage).mockResolvedValueOnce({
      dialog: existingDialog,
      userMessage: {
        id: 'm-10',
        dialogId: existingDialog.id,
        role: ChatMessageRole.USER,
        content: 'Line 1\nLine 2',
        model: null,
        latencyMs: null,
        usage: null,
        createdAt: '2026-01-01T00:00:01.000Z',
      },
      assistantMessage: {
        id: 'm-11',
        dialogId: existingDialog.id,
        role: ChatMessageRole.ASSISTANT,
        content: 'Here is your roaming information.',
        model: 'openrouter/free',
        latencyMs: 120,
        usage: null,
        createdAt: '2026-01-01T00:00:02.000Z',
      },
    });

    renderChatWorkspace();

    const input = await screen.findByLabelText('Message input');
    await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2{Enter}');

    await waitFor(() => {
      expect(chatClient.streamDialogMessage).toHaveBeenCalledWith(
        existingDialog.id,
        { content: 'Line 1\nLine 2' },
        expect.objectContaining({
          onUserMessage: expect.any(Function),
          onDelta: expect.any(Function),
        }),
      );
    });

    const escalationButtons = screen.getAllByRole('button', { name: /talk to a human agent/i });
    await user.click(escalationButtons[0]);

    expect(await screen.findByText(/specialists available/i)).toBeVisible();
    await user.click(screen.getByRole('button', { name: /request live agent/i }));

    expect(await screen.findByText(/a live telecom specialist has been notified/i)).toBeVisible();
  });
});
