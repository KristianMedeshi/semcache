import { Link } from '@tanstack/react-router';
import type { UserResponseDto } from '@semcache/shared-dtos';
import {
  BookOpen,
  ChevronsUpDown,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import { isAdmin } from '@/features/auth/api/auth.client';
import { resolveTheme, useTheme } from '@/features/theme/model/ui.store';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export interface SidebarAccountFooterProps {
  user: UserResponseDto;
  onOpenProfileSettings: () => void;
  onOpenAdminDirectory: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

function getUserInitials(email: string): string {
  const local = email.split('@')[0] ?? 'SC';
  return local.slice(0, 2).toUpperCase();
}

export function SidebarAccountFooter({
  user,
  onOpenProfileSettings,
  onOpenAdminDirectory,
  onSignOut,
  isSigningOut,
}: SidebarAccountFooterProps) {
  const adminUser = isAdmin(user);
  const { theme, setTheme } = useTheme();
  const activeTheme = resolveTheme(theme);

  const handleToggleTheme = () => {
    setTheme(activeTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="shrink-0 border-t bg-card/70 px-3 py-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Customer account menu"
            className="h-auto w-full justify-between gap-2 rounded-xl px-2 py-1.5"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-8 shrink-0 border border-border">
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {getUserInitials(user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 text-left">
                <span className="block truncate text-xs font-medium text-foreground">
                  {user.email}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {adminUser ? 'Operator' : 'Subscriber'}
                </span>
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
              <div className="flex items-center gap-1.5">
                <Badge variant="teal" className="text-[10px] uppercase">
                  {adminUser ? 'Operator' : 'Subscriber'}
                </Badge>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  Verified
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenProfileSettings}>
            <Settings className="size-4 text-muted-foreground" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleToggleTheme}>
            {activeTheme === 'dark' ? (
              <Sun className="size-4 text-muted-foreground" />
            ) : (
              <Moon className="size-4 text-muted-foreground" />
            )}
            {activeTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          </DropdownMenuItem>
          {adminUser ? (
            <>
              <DropdownMenuItem onSelect={onOpenAdminDirectory}>
                <Users className="size-4 text-muted-foreground" />
                Operator directory
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/knowledge-base">
                  <BookOpen className="size-4 text-muted-foreground" />
                  Knowledge Base
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onSignOut}
            disabled={isSigningOut}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
