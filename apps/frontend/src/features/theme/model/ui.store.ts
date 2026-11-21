import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UiState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

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

export const useUiStore = create<UiState>((set) => ({
  theme: 'light',
  setTheme: (theme) => {
    applyThemeToDocument(theme);
    set({ theme });
  },
}));
