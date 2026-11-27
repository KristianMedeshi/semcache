import { OperatorAdminWorkspace } from '@/features/admin/ui/operator-admin-workspace';
import { AdminAccessGuard } from '@/features/auth/ui/admin-access-guard';

export function OperatorAdminPage() {
  return (
    <AdminAccessGuard
      title="Operator Admin Panel"
      forbiddenDescription="Only authorized operators and administrators can access Semantic Cache controls and Dialog analytics."
      redirectTo="/admin"
    >
      {(user) => <OperatorAdminWorkspace user={user} />}
    </AdminAccessGuard>
  );
}
