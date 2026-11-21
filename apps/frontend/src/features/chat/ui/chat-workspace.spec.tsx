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
  updateDialog: vi.fn(),
  deleteDialog: vi.fn(),
  getDialogMessages: vi.fn(),
  sendDialogMessage: vi.fn(),
  editDialogMessage: vi.fn(),
  streamDialogMessage: vi.fn(),
  streamEditDialogMessage: vi.fn(),
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

  it('renames a conversation title and deletes a conversation from the sidebar', async () => {
    const user = userEvent.setup();
    const dialog: DialogResponseDto = {
      id: '44444444-4444-4444-8444-444444444444',
      userId: testUser.id,
      title: 'Billing Question',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(chatClient.listDialogs).mockResolvedValueOnce([dialog]);
    vi.mocked(chatClient.getDialogMessages).mockResolvedValue([]);
    vi.mocked(chatClient.updateDialog).mockResolvedValueOnce({
      ...dialog,
      title: 'Invoice Support',
    });
    vi.mocked(chatClient.deleteDialog).mockResolvedValueOnce({
      id: dialog.id,
      deleted: true,
    });

    renderChatWorkspace();

    expect(await screen.findByText('Billing Question')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Rename Billing Question' }));
    const titleInput = screen.getByLabelText('Edit conversation title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Invoice Support');
    await user.click(screen.getByRole('button', { name: 'Save conversation title' }));

    await waitFor(() => {
      expect(chatClient.updateDialog).toHaveBeenCalledWith(dialog.id, { title: 'Invoice Support' });
    });
    expect(await screen.findByText('Invoice Support')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete Invoice Support' }));
    await waitFor(() => {
      expect(chatClient.deleteDialog).toHaveBeenCalledWith(dialog.id);
    });
    expect(screen.queryByText('Invoice Support')).not.toBeInTheDocument();
  });

  it('edits a user message to create a new branch and toggles between branches in the message graph', async () => {
    const user = userEvent.setup();
    const dialog: DialogResponseDto = {
      id: '55555555-5555-4555-8555-555555555555',
      userId: testUser.id,
      title: 'Plan Inquiry',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const originalUserMsg: DialogMessageResponseDto = {
      id: 'm-1',
      dialogId: dialog.id,
      parentMessageId: null,
      role: ChatMessageRole.USER,
      content: 'Tell me about 5G plans',
      model: null,
      latencyMs: null,
      usage: null,
      createdAt: '2026-01-01T00:00:01.000Z',
    };
    const originalAssistantMsg: DialogMessageResponseDto = {
      id: 'm-2',
      dialogId: dialog.id,
      parentMessageId: 'm-1',
      role: ChatMessageRole.ASSISTANT,
      content: 'Our 5G Unlimited plan starts at $40/month.',
      model: 'openrouter/free',
      latencyMs: 100,
      usage: null,
      createdAt: '2026-01-01T00:00:02.000Z',
    };
    const editedUserMsg: DialogMessageResponseDto = {
      id: 'm-3',
      dialogId: dialog.id,
      parentMessageId: null,
      role: ChatMessageRole.USER,
      content: 'Tell me about prepaid plans',
      model: null,
      latencyMs: null,
      usage: null,
      createdAt: '2026-01-01T00:00:03.000Z',
    };
    const editedAssistantMsg: DialogMessageResponseDto = {
      id: 'm-4',
      dialogId: dialog.id,
      parentMessageId: 'm-3',
      role: ChatMessageRole.ASSISTANT,
      content: 'Our Prepaid Starter plan is $25/month.',
      model: 'openrouter/free',
      latencyMs: 110,
      usage: null,
      createdAt: '2026-01-01T00:00:04.000Z',
    };

    vi.mocked(chatClient.listDialogs).mockResolvedValueOnce([dialog]);
    vi.mocked(chatClient.getDialogMessages).mockResolvedValueOnce([
      originalUserMsg,
      originalAssistantMsg,
    ]);
    vi.mocked(chatClient.streamEditDialogMessage).mockImplementationOnce(
      async (_dialogId, _messageId, _dto, callbacks) => {
        callbacks?.onUserMessage?.(editedUserMsg);
        callbacks?.onDelta?.(editedAssistantMsg.content, editedAssistantMsg.content);
        const turn = {
          dialog,
          userMessage: editedUserMsg,
          assistantMessage: editedAssistantMsg,
        };
        callbacks?.onDone?.(turn);
        return turn;
      },
    );

    renderChatWorkspace();

    expect(await screen.findByText('Tell me about 5G plans')).toBeVisible();
    expect(
      screen.getAllByText('Our 5G Unlimited plan starts at $40/month.').length,
    ).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Edit message' }));
    const editTextarea = screen.getByLabelText('Edit message');
    await user.clear(editTextarea);
    await user.type(editTextarea, 'Tell me about prepaid plans');
    await user.click(screen.getByRole('button', { name: 'Save & Submit' }));

    await waitFor(() => {
      expect(chatClient.streamEditDialogMessage).toHaveBeenCalledWith(
        dialog.id,
        'm-1',
        { content: 'Tell me about prepaid plans' },
        expect.any(Object),
      );
    });

    expect(
      (await screen.findAllByText('Our Prepaid Starter plan is $25/month.')).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 / 2')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Previous branch' }));
    expect(await screen.findByText('1 / 2')).toBeVisible();
    expect(screen.getByText('Tell me about 5G plans')).toBeVisible();
    expect(
      screen.getAllByText('Our 5G Unlimited plan starts at $40/month.').length,
    ).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Next branch' }));
    expect(await screen.findByText('2 / 2')).toBeVisible();
    expect(screen.getByText('Tell me about prepaid plans')).toBeVisible();
    expect(
      screen.getAllByText('Our Prepaid Starter plan is $25/month.').length,
    ).toBeGreaterThanOrEqual(1);
  });
});
