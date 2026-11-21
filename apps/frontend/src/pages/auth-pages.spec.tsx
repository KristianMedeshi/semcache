import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '@/app/router';
import * as authClient from '@/features/auth/api/auth.client';
import { createAppQueryClient } from '@/shared/api/query-client';

vi.mock('@/features/auth/api/auth.client', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  logout: vi.fn(),
  registerCustomer: vi.fn(),
}));

function renderAtRoute(initialPath: string) {
  const client = createAppQueryClient();
  const router = createAppRouter({
    queryClient: client,
    getAuthUser: async () => null,
  });
  router.update({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: router.options.context,
  });

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Auth Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates and submits Sign In form via TanStack Query mutation', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.login).mockResolvedValueOnce({
      id: 'u-1',
      email: 'customer@example.com',
      role: 'customer' as never,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderAtRoute('/sign-in');

    expect(await screen.findByText('Welcome back')).toBeVisible();
    expect(screen.getByRole('link', { name: /forgot password\?/i })).toBeVisible();

    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('Please enter a valid email address')).toBeVisible();
    expect(screen.getByText('Password is required')).toBeVisible();

    await user.type(screen.getByLabelText(/email address/i), 'customer@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'Secret123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authClient.login).toHaveBeenCalledWith(
        { email: 'customer@example.com', password: 'Secret123!' },
        expect.anything(),
      );
    });
  });

  it('validates password complexity and confirmation on Sign Up page', async () => {
    const user = userEvent.setup();
    vi.mocked(authClient.registerCustomer).mockResolvedValueOnce({
      id: 'u-2',
      email: 'new@example.com',
      role: 'customer' as never,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    renderAtRoute('/sign-up');

    expect(await screen.findByText('Create your account')).toBeVisible();

    await user.type(screen.getByLabelText(/email address/i), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!');
    await user.type(screen.getByPlaceholderText('Re-enter your password'), 'Mismatch1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Passwords do not match')).toBeVisible();
    expect(authClient.registerCustomer).not.toHaveBeenCalled();

    const confirmInput = screen.getByPlaceholderText('Re-enter your password');
    await user.clear(confirmInput);
    await user.type(confirmInput, 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authClient.registerCustomer).toHaveBeenCalledWith(
        { email: 'new@example.com', password: 'StrongPass1!' },
        expect.anything(),
      );
    });
  });

  it('validates email and displays recovery confirmation on Forgot Password page', async () => {
    const user = userEvent.setup();
    renderAtRoute('/forgot-password');

    expect(await screen.findByText('Reset your password')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /send recovery link/i }));
    expect(await screen.findByText('Please enter a valid email address')).toBeVisible();

    await user.type(screen.getByLabelText(/email address/i), 'subscriber@telecom.com');
    await user.click(screen.getByRole('button', { name: /send recovery link/i }));

    expect(await screen.findByText('Check your inbox')).toBeVisible();
    expect(screen.getByText('subscriber@telecom.com')).toBeVisible();
  });
});
