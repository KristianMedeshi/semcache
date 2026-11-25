import { KnowledgeDocumentStatus } from '@semcache/shared-types';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import type { KnowledgeDocumentResponseDto } from '@semcache/shared-dtos';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';

export function KnowledgeBaseStats({ documents }: { documents: KnowledgeDocumentResponseDto[] }) {
  const stats = useMemo(() => {
    let readyCount = 0;
    let processingCount = 0;
    let failedCount = 0;
    let totalChunks = 0;

    for (const doc of documents) {
      if (doc.status === KnowledgeDocumentStatus.READY) {
        readyCount += 1;
        totalChunks += doc.chunkCount;
      } else if (
        doc.status === KnowledgeDocumentStatus.PROCESSING ||
        doc.status === KnowledgeDocumentStatus.PENDING
      ) {
        processingCount += 1;
      } else if (doc.status === KnowledgeDocumentStatus.FAILED) {
        failedCount += 1;
      }
    }
    return { total: documents.length, readyCount, processingCount, failedCount, totalChunks };
  }, [documents]);

  return (
    <section aria-label="Knowledge Base Processing Summary" className="grid gap-3 sm:grid-cols-4">
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground">Total Documents</p>
        <p className="mt-1 text-2xl font-bold">{stats.total}</p>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground">Ready & Indexed</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats.readyCount}
          </p>
          <span className="text-xs text-muted-foreground">({stats.totalChunks} chunks)</span>
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground">Processing Queue</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-2xl font-bold text-primary">{stats.processingCount}</p>
          {stats.processingCount > 0 ? (
            <Badge variant="teal" className="text-[11px]">
              <Loader2 className="size-3 animate-spin" />
              Live polling
            </Badge>
          ) : null}
        </div>
      </Card>
      <Card className="p-4">
        <p className="text-xs font-medium text-muted-foreground">Failed Processing</p>
        <p className="mt-1 text-2xl font-bold text-destructive">{stats.failedCount}</p>
      </Card>
    </section>
  );
}
