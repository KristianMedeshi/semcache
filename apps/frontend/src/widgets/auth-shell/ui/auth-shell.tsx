import { Headset, ShieldCheck, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardFooter } from '@/shared/ui/card-footer';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';
import { AppHeader } from '@/widgets/app-header/ui/app-header';

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-background">
      <AppHeader containerClassName="mx-auto max-w-5xl px-4 sm:px-6">
        <AppHeader.Left>
          <AppHeader.Brand subtitle="Telecom Customer Support" to="/" />
        </AppHeader.Left>
      </AppHeader>

      <main className="mx-auto my-8 flex w-full max-w-md flex-col items-center px-4 sm:px-6">
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

      <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-center text-xs text-muted-foreground sm:px-6">
        SemCache Telecom Support · Protected by HttpOnly session cookies
      </footer>
    </div>
  );
}
