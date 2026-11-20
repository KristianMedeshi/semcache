import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/features/theme/ui/theme-toggle';
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

const radialBackdrop = (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-muted)_0%,transparent_65%)]"
  />
);

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-background px-4 py-6 sm:px-6">
      {radialBackdrop}

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="size-4" />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">SemCache</span>
            <span className="block text-xs text-muted-foreground">Semantic Support Platform</span>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto my-8 flex w-full max-w-md flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full"
        >
          <Card className="border-border/80 shadow-lg">
            <CardHeader className="space-y-1.5 text-center">
              <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>{children}</CardContent>
            <CardFooter className="justify-center border-t pt-6 text-sm text-muted-foreground">
              {footer}
            </CardFooter>
          </Card>
        </motion.div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-muted-foreground">
        Protected by HttpOnly session cookies &amp; role-based access control.
      </footer>
    </div>
  );
}
