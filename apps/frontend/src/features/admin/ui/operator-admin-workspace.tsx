import { Link } from '@tanstack/react-router';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { ArrowLeft, BookOpen, RefreshCw, SlidersHorizontal, Users } from 'lucide-react';
import { useState } from 'react';
import {
  useAdminDialogStatsQuery,
  useSemanticCacheSettingsQuery,
  useSemanticCacheStatsQuery,
} from '@/features/admin/model/use-admin';
import { DialogStatsPanel } from '@/features/admin/ui/dialog-stats-panel';
import { SemanticCacheSettingsPanel } from '@/features/admin/ui/semantic-cache-settings-panel';
import { SemanticCacheStatsPanel } from '@/features/admin/ui/semantic-cache-stats-panel';
import { AdminOperatorDialog } from '@/features/auth/ui/admin-operator-dialog';
import { useKnowledgeDocumentsQuery } from '@/features/knowledge-base/model/use-knowledge-base';
import { Badge } from '@/shared/ui/badge';
import { BrandLogo } from '@/shared/ui/brand-logo';
import { Button } from '@/shared/ui/button';
import { AppHeader } from '@/widgets/app-header/ui/app-header';

export interface OperatorAdminWorkspaceProps {
  user: UserResponseDto;
}

export function OperatorAdminWorkspace({ user }: OperatorAdminWorkspaceProps) {
  const [subscribersOpen, setSubscribersOpen] = useState(false);

  const dialogStatsQuery = useAdminDialogStatsQuery();
  const cacheSettingsQuery = useSemanticCacheSettingsQuery();
  const cacheStatsQuery = useSemanticCacheStatsQuery();
  const documentsQuery = useKnowledgeDocumentsQuery();

  const isRefreshing =
    dialogStatsQuery.isFetching ||
    cacheSettingsQuery.isFetching ||
    cacheStatsQuery.isFetching ||
    documentsQuery.isFetching;

  const handleRefreshAll = () => {
    void dialogStatsQuery.refetch();
    void cacheSettingsQuery.refetch();
    void cacheStatsQuery.refetch();
    void documentsQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader containerClassName="mx-auto max-w-7xl px-4 sm:px-6">
        <AppHeader.Left>
          <AppHeader.Brand to="/">
            <BrandLogo compact className="sm:hidden" />
            <BrandLogo subtitle="Operator Dashboard" className="hidden sm:flex" />
          </AppHeader.Brand>
          <AppHeader.Divider />
          <AppHeader.Title
            title="Operator Admin Panel"
            badge={
              <Badge variant="teal" className="hidden sm:inline-flex">
                <SlidersHorizontal className="size-3" />
                Admin
              </Badge>
            }
            subtitle={`Signed in as ${user.email}`}
          />
        </AppHeader.Left>
      </AppHeader>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-4" />
                <span>Support Chat</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/knowledge-base">
                <BookOpen className="size-4 text-primary" />
                <span>Knowledge Base</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSubscribersOpen(true)}
            >
              <Users className="size-4 text-primary" />
              <span>Subscribers</span>
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        <DialogStatsPanel
          stats={dialogStatsQuery.data}
          isPending={dialogStatsQuery.isPending}
          isError={dialogStatsQuery.isError}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SemanticCacheSettingsPanel
              settings={cacheSettingsQuery.data}
              isPending={cacheSettingsQuery.isPending}
            />
          </div>
          <div className="lg:col-span-5">
            <SemanticCacheStatsPanel
              stats={cacheStatsQuery.data}
              documents={documentsQuery.data ?? []}
              isPending={cacheStatsQuery.isPending}
            />
          </div>
        </div>
      </main>

      <AdminOperatorDialog open={subscribersOpen} onOpenChange={setSubscribersOpen} />
    </div>
  );
}
