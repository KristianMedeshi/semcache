import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, ShieldAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { listUsers, revokeUserSessions } from '@/features/auth/api/auth.client';
import { queryKeys } from '@/shared/api/query-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

export interface AdminOperatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminOperatorDialog({ open, onOpenChange }: AdminOperatorDialogProps) {
  const client = useQueryClient();

  const usersQuery = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: listUsers,
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeUserSessions,
    onSuccess: (result) => {
      toast.success(`Revoked ${result.revokedCount} active session(s)`);
      void client.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
    onError: () => {
      toast.error('Failed to revoke user sessions');
    },
  });

  const users = usersQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Operator Subscriber Directory
          </DialogTitle>
          <DialogDescription>
            Manage active telecom customer accounts, revoke compromised sessions, or open Knowledge
            Base management.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border bg-accent/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Manage RAG documents used by the AI Support Service
          </span>
          <Button asChild variant="outline" size="sm">
            <a href="/knowledge-base">
              <BookOpen className="size-3.5 text-primary" />
              Knowledge Base
            </a>
          </Button>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {usersQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading subscribers...
            </div>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No subscriber accounts found.
            </p>
          ) : (
            users.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{account.email}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={account.role === 'admin' ? 'teal' : 'secondary'}>
                      {account.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Joined {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => revokeMutation.mutate(account.id)}
                  disabled={revokeMutation.isPending}
                >
                  <ShieldAlert className="size-3.5" />
                  Revoke sessions
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
