import { Link } from '@tanstack/react-router';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { BookOpen, Menu, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';
import { isAdmin } from '@/features/auth/api/auth.client';
import { Badge } from '@/shared/ui/badge';
import { BrandLogo } from '@/shared/ui/brand-logo';
import { Button } from '@/shared/ui/button';
import { AppHeader } from '@/widgets/app-header/ui/app-header';

export interface ChatHeaderProps {
  user: UserResponseDto;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileHistory: () => void;
}

export function ChatHeader({
  user,
  isSidebarOpen,
  onToggleSidebar,
  onOpenMobileHistory,
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

      {adminUser ? (
        <AppHeader.Right>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden rounded-lg border-border/90 text-xs font-medium md:inline-flex"
          >
            <Link to="/admin">
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>Admin Panel</span>
            </Link>
          </Button>
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
        </AppHeader.Right>
      ) : null}
    </AppHeader>
  );
}
