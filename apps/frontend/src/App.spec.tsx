import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';

vi.mock('@/api/auth.client', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  logout: vi.fn(),
  registerCustomer: vi.fn(),
}));

describe('App', () => {
  it('renders the workspace home page and toggles dark mode', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('SemCache Workspace')).toBeVisible();

    const toggleButton = screen.getByRole('button', { name: /switch to/i });
    await user.click(toggleButton);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
