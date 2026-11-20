import { describe, expect, it } from 'vitest';
import { cn } from '@/shared/lib/utils';

describe('cn', () => {
  it('merges conditional classes and resolves Tailwind conflicts', () => {
    const isHidden = false as boolean;
    expect(cn('px-2 py-1', isHidden && 'hidden', 'px-4')).toBe('py-1 px-4');
  });
});
