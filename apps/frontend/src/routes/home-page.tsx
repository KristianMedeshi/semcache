import { Link } from '@tanstack/react-router';
import { LogIn, LogOut, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery, useSignOutMutation } from '@/hooks/use-auth';

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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-muted)_0%,transparent_65%)]"
      />

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

      <main className="mx-auto my-12 flex w-full max-w-xl flex-col items-center">
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
              {isPending ? (
                <p className="text-sm text-muted-foreground">Checking session...</p>
              ) : user ? (
                <div className="w-full space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
                  <div className="flex items-center justify-center gap-2 font-medium">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Signed in as {user.email}</span>
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Role: {user.role}
                  </p>
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-muted-foreground">
        SemCache Customer Support Platform
      </footer>
    </div>
  );
}
