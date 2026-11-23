import { Moon, Sun } from 'lucide-react';
import { resolveTheme, useUiStore } from '@/features/theme/model/ui.store';
import { Button } from '@/shared/ui/button';

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const activeTheme = resolveTheme(theme);

  const handleToggle = () => {
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={`Switch to ${activeTheme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {activeTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
