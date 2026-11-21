import { Link } from '@tanstack/react-router';
import { Headset, ShieldCheck, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/features/theme/ui/theme-toggle';
import { BrandLogo } from '@/shared/ui/brand-logo';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardFooter } from '@/shared/ui/card-footer';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link
          to="/"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <BrandLogo subtitle="Telecom Customer Support" />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-8 flex w-full max-w-md flex-col items-center">
        <Card className="w-full border-border/90 shadow-md">
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
          <CardFooter className="justify-center border-t pt-6 text-sm text-muted-foreground">
            {footer}
          </CardFooter>
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Headset className="size-3.5 text-primary" />
            24/7 Telecom Assistant
          </span>
          <span className="flex items-center gap-1.5">
            <Smartphone className="size-3.5 text-cyan-600 dark:text-cyan-400" />
            Plans, eSIM &amp; Billing
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Encrypted Session
          </span>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-muted-foreground">
        SemCache Telecom Support · Protected by HttpOnly session cookies
      </footer>
    </div>
  );
}
