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
  });

  it('creates a conversation on first message and renders free OpenRouter model response', async () => {
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
      content: 'How do I check my order?',
      model: null,
      latencyMs: null,
      usage: null,
      createdAt: '2026-01-01T00:00:01.000Z',
    };
    const assistantMsg: DialogMessageResponseDto = {
      id: 'm-2',
      dialogId: createdDialog.id,
      role: ChatMessageRole.ASSISTANT,
      content: 'Visit Orders in your account dashboard.',
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      latencyMs: 180,
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
      createdAt: '2026-01-01T00:00:02.000Z',
    };

    vi.mocked(chatClient.listDialogs).mockResolvedValueOnce([]);
    vi.mocked(chatClient.createDialog).mockResolvedValueOnce(createdDialog);
    vi.mocked(chatClient.getDialogMessages).mockResolvedValue([]);
    vi.mocked(chatClient.sendDialogMessage).mockResolvedValueOnce({
      dialog: { ...createdDialog, title: 'How do I check my order?' },
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    });

    renderChatWorkspace();

    expect(await screen.findByText('Start a free OpenRouter conversation')).toBeVisible();

    await user.selectOptions(
      screen.getByLabelText('Free Model'),
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    );
    await user.type(screen.getByLabelText('Message input'), 'How do I check my order?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(chatClient.sendDialogMessage).toHaveBeenCalledWith(createdDialog.id, {
        content: 'How do I check my order?',
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      });
    });

    expect(await screen.findByText('Visit Orders in your account dashboard.')).toBeVisible();
    expect(screen.getByText('180 ms')).toBeVisible();
    expect(screen.getByText('30 tokens')).toBeVisible();
  });
});
