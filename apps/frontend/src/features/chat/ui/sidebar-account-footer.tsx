import { Link } from '@tanstack/react-router';
import type { UserResponseDto } from '@semcache/shared-dtos';
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { isAdmin } from '@/features/auth/api/auth.client';
import { type ThemeMode, useTheme } from '@/features/theme/model/ui.store';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export interface SidebarAccountFooterProps {
  user: UserResponseDto;
  onOpenProfileSettings: () => void;
  onOpenAdminDirectory: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
  onDeleteAllActivity?: () => Promise<void> | void;
  hasDialogs?: boolean;
  isDeletingAllActivity?: boolean;
}

function getUserInitials(email: string): string {
  const local = email.split('@')[0] ?? 'SC';
  return local.slice(0, 2).toUpperCase();
}

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SidebarAccountFooter({
  user,
  onOpenProfileSettings,
  onOpenAdminDirectory,
  onSignOut,
  isSigningOut,
  onDeleteAllActivity,
  hasDialogs = false,
  isDeletingAllActivity = false,
}: SidebarAccountFooterProps) {
  const adminUser = isAdmin(user);
  const { theme, setTheme } = useTheme();
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);

  const handleConfirmDeleteAll = async () => {
    if (!onDeleteAllActivity) {
      return;
    }
    setConfirmDeleteAllOpen(false);
    await onDeleteAllActivity();
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {(() => {
                const ActiveThemeIcon =
                  THEME_OPTIONS.find((option) => option.value === theme)?.icon ?? Monitor;
                return <ActiveThemeIcon className="size-4 text-muted-foreground" />;
              })()}
              <span>Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{label}</span>
                  {theme === value ? <Check className="size-4 text-primary" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {onDeleteAllActivity ? (
            <DropdownMenuItem
              onSelect={() => setConfirmDeleteAllOpen(true)}
              disabled={!hasDialogs || isDeletingAllActivity}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete all activity
            </DropdownMenuItem>
          ) : null}
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

      <Dialog open={confirmDeleteAllOpen} onOpenChange={setConfirmDeleteAllOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete All Activity</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete all conversations and their messages? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteAllOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingAllActivity}
              onClick={() => void handleConfirmDeleteAll()}
            >
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
