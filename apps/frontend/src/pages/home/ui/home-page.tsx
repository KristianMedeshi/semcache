import { Link } from '@tanstack/react-router';
import { LogIn, LogOut, Sparkles, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useCurrentUserQuery, useSignOutMutation } from '@/features/auth/model/use-auth';
import { ChatWorkspace } from '@/features/chat/ui/chat-workspace';
import { ThemeToggle } from '@/features/theme/ui/theme-toggle';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';

const radialBackdrop = (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-muted)_0%,transparent_65%)]"
  />
);

export function HomePage() {
  const { data: user, isPending } = useCurrentUserQuery();
  const signOutMutation = useSignOutMutation();

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
      toast.success('Signed out');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-background px-4 py-6 sm:px-6">
      {radialBackdrop}

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">SemCache</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signOutMutation.isPending}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main
        className={cn(
          'mx-auto my-8 flex w-full flex-col items-center',
          user ? 'max-w-5xl' : 'max-w-xl',
        )}
      >
        {isPending ? (
          <Card className="w-full shadow-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                SemCache Workspace
              </CardTitle>
              <CardDescription>
                Adaptive LLM semantic response caching for customer support.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">Checking session...</p>
            </CardContent>
          </Card>
        ) : user ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <ChatWorkspace user={user} />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <Card className="shadow-md">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  SemCache Workspace
                </CardTitle>
                <CardDescription>
                  Adaptive LLM semantic response caching for customer support.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild>
                    <Link to="/sign-in">
                      <LogIn className="size-4" />
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/sign-up">
                      <UserPlus className="size-4" />
                      Create account
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-muted-foreground">
        SemCache Customer Support Platform
      </footer>
    </div>
  );
}
