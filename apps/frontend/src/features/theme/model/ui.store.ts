import { useCallback } from 'react';
import { useLocalStorage } from '@/hookas/use-local-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'semcache-theme';

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme !== 'system') {
    return theme;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme() {
  const [theme, setStoredTheme] = useLocalStorage<ThemeMode>(THEME_STORAGE_KEY, 'system');

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      applyThemeToDocument(nextTheme);
      setStoredTheme(nextTheme);
    },
    [setStoredTheme],
  );

  return { theme, setTheme } as const;
}
