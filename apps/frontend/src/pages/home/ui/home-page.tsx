import { Link } from '@tanstack/react-router';
import { ArrowRight, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { useCurrentUserQuery } from '@/features/auth/model/use-auth';
import { TELECOM_SUGGESTIONS } from '@/features/chat/model/telecom-suggestions';
import { ChatWorkspace } from '@/features/chat/ui/chat-workspace';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { SessionLoadingScreen } from '@/shared/ui/session-loading-screen';
import { AppHeader } from '@/widgets/app-header/ui/app-header';

export function HomePage() {
  const { data: user, isPending } = useCurrentUserQuery();

  if (isPending) {
    return (
      <SessionLoadingScreen
        subtitle="Telecom Customer Support"
        title="SemCache Telecom Support"
        description="Connecting to your support workspace..."
      />
    );
  }

  if (user) {
    return <ChatWorkspace user={user} />;
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background">
      <AppHeader containerClassName="mx-auto max-w-6xl px-4 sm:px-6">
        <AppHeader.Left>
          <AppHeader.Brand subtitle="Telecom Customer Support" />
        </AppHeader.Left>
        <AppHeader.Right>
          <Button asChild variant="ghost" size="sm">
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/sign-up">Sign up</Link>
          </Button>
        </AppHeader.Right>
      </AppHeader>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 lg:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="teal" className="mb-4">
            <span className="size-1.5 rounded-full bg-cyan-500" />
            24/7 Telecom Assistant Online
          </Badge>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Instant support for your mobile services
          </h1>

          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Get clear answers about mobile plans, data usage, billing, international roaming, eSIM
            activation, and network troubleshooting anytime.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/sign-in">
                <LogIn className="size-4" />
                Sign in to Support Chat
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl">
              <Link to="/sign-up">
                <UserPlus className="size-4" />
                Create account
              </Link>
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-cyan-600 dark:text-cyan-400" />
              Encrypted subscriber session
            </span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {TELECOM_SUGGESTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.id} className="gap-3 p-4 shadow-xs transition-shadow hover:shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {item.category}
                    </p>
                    <p className="text-sm font-medium text-foreground">{item.prompt}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </Card>
            );
          })}
        </div>
      </main>

      <footer className="border-t bg-card py-4 text-center text-xs text-muted-foreground">
        SemCache Telecom Customer Support Platform
      </footer>
    </div>
  );
}
