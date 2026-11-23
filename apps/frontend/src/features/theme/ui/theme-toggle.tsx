import { Monitor, Moon, Sun } from 'lucide-react';
import { type ThemeMode, useTheme } from '@/features/theme/model/ui.store';
import { Button } from '@/shared/ui/button';

const THEME_CYCLE: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = THEME_CYCLE[theme];

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
    >
      {theme === 'dark' ? (
        <Moon className="size-4" />
      ) : theme === 'light' ? (
        <Sun className="size-4" />
      ) : (
        <Monitor className="size-4" />
      )}
    </Button>
  );
}
