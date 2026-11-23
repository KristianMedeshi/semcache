import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { BrandLogo } from '@/shared/ui/brand-logo';
import { Separator } from '@/shared/ui/separator';

export interface AppHeaderProps {
  children: ReactNode;
  containerClassName?: string;
  className?: string;
}

export interface AppHeaderGroupProps {
  children: ReactNode;
  className?: string;
}

export interface AppHeaderBrandProps {
  subtitle?: string;
  to?: '/';
  children?: ReactNode;
  className?: string;
}

export interface AppHeaderTitleProps {
  title: string;
  badge?: ReactNode;
  subtitle?: string;
  className?: string;
}

export interface AppHeaderDividerProps {
  className?: string;
}

function AppHeaderRoot({
  children,
  containerClassName = 'px-4 sm:px-6',
  className,
}: AppHeaderProps) {
  return (
    <header className={cn('shrink-0 border-b bg-card', className)}>
      <div
        className={cn(
          'flex h-16 w-full items-center justify-between gap-3',
          containerClassName,
        )}
      >
        {children}
      </div>
    </header>
  );
}

export function AppHeaderLeft({ children, className }: AppHeaderGroupProps) {
  return <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>{children}</div>;
}

export function AppHeaderRight({ children, className }: AppHeaderGroupProps) {
  return <div className={cn('flex shrink-0 items-center gap-1.5 sm:gap-2', className)}>{children}</div>;
}

export function AppHeaderBrand({
  subtitle = 'Telecom Support',
  to,
  children,
  className,
}: AppHeaderBrandProps) {
  const content = children ?? <BrandLogo subtitle={subtitle} />;

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          'shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn('shrink-0', className)}>{content}</div>;
}

export function AppHeaderDivider({ className }: AppHeaderDividerProps) {
  return <Separator orientation="vertical" className={cn('mx-1 hidden h-7 sm:block', className)} />;
}

export function AppHeaderTitle({ title, badge, subtitle, className }: AppHeaderTitleProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-2">
        <h1 className="truncate text-sm font-semibold text-foreground sm:text-[15px]">{title}</h1>
        {badge}
      </div>
      {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export const AppHeader = Object.assign(AppHeaderRoot, {
  Left: AppHeaderLeft,
  Right: AppHeaderRight,
  Brand: AppHeaderBrand,
  Divider: AppHeaderDivider,
  Title: AppHeaderTitle,
});
