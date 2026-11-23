import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';

vi.mock('@/features/auth/api/auth.client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/api/auth.client')>()),
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

describe('App', () => {
  it('renders the SemCache Telecom portal in light mode by default', async () => {
    render(<App />);

    expect(await screen.findByText('Instant support for your mobile services')).toBeVisible();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
