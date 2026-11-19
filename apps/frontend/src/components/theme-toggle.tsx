import { Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { resolveTheme, useUiStore } from '@/stores/ui.store';

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const activeTheme = resolveTheme(theme);

  const handleToggle = () => {
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    toast.success(`Switched to ${nextTheme} theme`);
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
