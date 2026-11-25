import { Link } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { isAdmin } from '@/features/auth/api/auth.client';
import { useCurrentUserQuery } from '@/features/auth/model/use-auth';
import { KnowledgeBaseWorkspace } from '@/features/knowledge-base/ui/knowledge-base-workspace';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';
import { SessionLoadingScreen } from '@/shared/ui/session-loading-screen';

export function KnowledgeBasePage() {
  const { data: user, isPending } = useCurrentUserQuery();

  if (isPending) {
    return (
      <SessionLoadingScreen
        subtitle="Operator Dashboard"
        title="Knowledge Base Management"
        description="Verifying operator permissions..."
      />
    );
  }

  if (!user || !isAdmin(user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="pt-2 text-xl font-semibold tracking-tight">
              Operator Access Required
            </CardTitle>
            <CardDescription>
              Only authorized operators and administrators can access and manage the Knowledge Base.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/">Return to Support Chat</Link>
            </Button>
            {!user ? (
              <Button asChild>
                <Link to="/sign-in" search={{ redirect: '/knowledge-base' }}>
                  Sign in
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <KnowledgeBaseWorkspace user={user} />;
}
