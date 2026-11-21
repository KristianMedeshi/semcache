import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';

vi.mock('@/features/auth/api/auth.client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api/auth.client')>()),
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

describe('App', () => {
  it('renders the SemCache Telecom portal in light mode by default and toggles dark mode', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Instant support for your mobile services')).toBeVisible();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    const toggleButton = screen.getByRole('button', { name: /switch to dark theme/i });
    await user.click(toggleButton);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
