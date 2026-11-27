import type {
  KnowledgeDocumentResponseDto,
  SemanticCacheStatsResponseDto,
} from '@semcache/shared-dtos';
import { QueryCategory } from '@semcache/shared-types';
import { Database, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CACHE_MODE_SHORT_LABELS } from '@/features/admin/model/admin-helpers';
import {
  useClearAllSemanticCacheMutation,
  useInvalidateCacheByCategoryMutation,
  useInvalidateCacheBySourcesMutation,
} from '@/features/admin/model/use-admin';
import { CATEGORY_LABELS } from '@/features/knowledge-base/model/knowledge-base-helpers';
import { getAuthServerError } from '@/shared/api/api-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { CardContent } from '@/shared/ui/card-content';
import { CardDescription } from '@/shared/ui/card-description';
import { CardHeader } from '@/shared/ui/card-header';
import { CardTitle } from '@/shared/ui/card-title';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';

export interface SemanticCacheStatsPanelProps {
  stats?: SemanticCacheStatsResponseDto;
  documents: KnowledgeDocumentResponseDto[];
  isPending: boolean;
}

export function SemanticCacheStatsPanel({
  stats,
  documents,
  isPending,
}: SemanticCacheStatsPanelProps) {
  const [selectedDocId, setSelectedDocId] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const invalidateSourcesMutation = useInvalidateCacheBySourcesMutation();
  const invalidateCategoryMutation = useInvalidateCacheByCategoryMutation();
  const clearAllMutation = useClearAllSemanticCacheMutation();

  const isMutating =
    invalidateSourcesMutation.isPending ||
    invalidateCategoryMutation.isPending ||
    clearAllMutation.isPending;

  const handleInvalidateCategory = async (category: QueryCategory) => {
    try {
      const result = await invalidateCategoryMutation.mutateAsync(category);
      toast.success(
        `Invalidated ${result.invalidatedCount} cache entry(s) in ${CATEGORY_LABELS[category]}.`,
      );
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to invalidate category cache.'));
    }
  };

  const handleInvalidateSource = async () => {
    if (!selectedDocId) {
      toast.error('Select a Knowledge Base document first.');
      return;
    }
    try {
      const result = await invalidateSourcesMutation.mutateAsync({ documentIds: [selectedDocId] });
      toast.success(`Invalidated ${result.invalidatedCount} cache entry(s) linked to document.`);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to invalidate source entries.'));
    }
  };

  const handleConfirmClearAll = async () => {
    try {
      const result = await clearAllMutation.mutateAsync();
      toast.success(`Cleared ${result.invalidatedCount} semantic cache entry(s).`);
      setConfirmClearOpen(false);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to clear semantic cache.'));
    }
  };

  const avgHitsPerEntry =
    stats && stats.totalEntries > 0 ? (stats.totalHits / stats.totalEntries).toFixed(2) : '0.00';

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="size-4 text-primary" />
          Cache Inventory &amp; Invalidation
        </CardTitle>
        <CardDescription>
          Inspect cached entries by category and manually invalidate stale or linked responses.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isPending || !stats ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading cache statistics...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Entries</p>
                <p className="mt-1 text-lg font-bold">{stats.totalEntries.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Total Hits</p>
                <p className="mt-1 text-lg font-bold">{stats.totalHits.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Hits / Entry</p>
                <p className="mt-1 text-lg font-bold">{avgHitsPerEntry}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Current Mode</span>
              <Badge variant="teal">{CACHE_MODE_SHORT_LABELS[stats.mode]}</Badge>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">By Query Category</p>
              <div className="space-y-2">
                {stats.byCategory.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {CATEGORY_LABELS[item.category]}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.entryCount} entries • {item.totalHits} hits
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isMutating || item.entryCount === 0}
                      aria-label={`Invalidate ${CATEGORY_LABELS[item.category]}`}
                      onClick={() => void handleInvalidateCategory(item.category)}
                    >
                      Invalidate
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="cache-invalidate-source-select" className="text-xs">
                Invalidate by Knowledge Base Source
              </Label>
              <div className="flex gap-2">
                <select
                  id="cache-invalidate-source-select"
                  aria-label="Select Knowledge Base document"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="">Select a document...</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isMutating || !selectedDocId}
                  onClick={() => void handleInvalidateSource()}
                >
                  Invalidate Linked
                </Button>
              </div>
            </div>

            <Separator />

            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="w-full"
              disabled={isMutating || stats.totalEntries === 0}
              onClick={() => setConfirmClearOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Clear All Cache Entries
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clear Semantic Cache</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {stats?.totalEntries ?? 0} cached entries?
              Subsequent queries will fall back to RAG and LLM generation until the cache warms up
              again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmClearOpen(false)}
              disabled={clearAllMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmClearAll()}
              disabled={clearAllMutation.isPending}
            >
              {clearAllMutation.isPending ? 'Clearing...' : 'Confirm Clear All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
