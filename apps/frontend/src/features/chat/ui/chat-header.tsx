import { Link } from '@tanstack/react-router';
import type { UserResponseDto } from '@semcache/shared-dtos';
import {
  BookOpen,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { isAdmin } from '@/features/auth/api/auth.client';
import { ThemeToggle } from '@/features/theme/ui/theme-toggle';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { BrandLogo } from '@/shared/ui/brand-logo';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { AppHeader } from '@/widgets/app-header/ui/app-header';

export interface ChatHeaderProps {
  user: UserResponseDto;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileHistory: () => void;
  onOpenProfileSettings: () => void;
  onOpenAdminDirectory: () => void;
  onSignOut: () => void;
  isSigningOut?: boolean;
}

function getUserInitials(email: string): string {
  const local = email.split('@')[0] ?? 'SC';
  return local.slice(0, 2).toUpperCase();
}

export function ChatHeader({
  user,
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileHistory,
  onOpenProfileSettings,
  onOpenAdminDirectory,
  onSignOut,
  isSigningOut,
}: ChatHeaderProps) {
  const adminUser = isAdmin(user);

  return (
    <AppHeader containerClassName="px-3 sm:px-5">
      <AppHeader.Left>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onOpenMobileHistory}
          aria-label="Open conversation history"
          className="md:hidden"
        >
          <Menu className="size-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label={
            isSidebarOpen ? 'Collapse conversation sidebar' : 'Expand conversation sidebar'
          }
          className="hidden md:inline-flex"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="size-4.5" />
          ) : (
            <PanelLeftOpen className="size-4.5" />
          )}
        </Button>

        <AppHeader.Brand>
          <BrandLogo compact className="sm:hidden" />
          <BrandLogo subtitle="Customer Support" className="hidden sm:flex" />
        </AppHeader.Brand>

        <AppHeader.Divider />

        <AppHeader.Title
          title="Telecom Assistant"
          badge={
            <Badge variant="success" className="hidden px-2 py-0.5 text-[11px] sm:inline-flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Online
            </Badge>
          }
          subtitle="Your personal support assistant"
        />
      </AppHeader.Left>

      <AppHeader.Right>
        {adminUser ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden rounded-lg border-border/90 text-xs font-medium md:inline-flex"
          >
            <Link to="/knowledge-base">
              <BookOpen className="size-3.5 text-primary" />
              <span>Knowledge Base</span>
            </Link>
          </Button>
        ) : null}

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Customer account menu"
              className="gap-2 rounded-full px-1.5 sm:px-2"
            >
              <Avatar className="size-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getUserInitials(user.email)}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
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
      </AppHeader.Right>
    </AppHeader>
  );
}
