import { AdminAccessGuard } from '@/features/auth/ui/admin-access-guard';
import { KnowledgeBaseWorkspace } from '@/features/knowledge-base/ui/knowledge-base-workspace';

export function KnowledgeBasePage() {
  return (
    <AdminAccessGuard
      title="Knowledge Base Management"
      forbiddenDescription="Only authorized operators and administrators can access and manage the Knowledge Base."
      redirectTo="/knowledge-base"
    >
      {(user) => <KnowledgeBaseWorkspace user={user} />}
    </AdminAccessGuard>
  );
}
