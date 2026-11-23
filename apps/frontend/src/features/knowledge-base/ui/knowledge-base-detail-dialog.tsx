import { KnowledgeDocumentStatus } from '@semcache/shared-types';
import { AlertTriangle, FileText, Loader2, RefreshCw } from 'lucide-react';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import {
  useKnowledgeDocumentDetailQuery,
  useReprocessKnowledgeDocumentMutation,
} from '@/features/knowledge-base/model/use-knowledge-base';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Separator } from '@/shared/ui/separator';

export interface KnowledgeBaseDetailDialogProps {
  documentId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeBaseDetailDialog({
  documentId,
  onOpenChange,
}: KnowledgeBaseDetailDialogProps) {
  const detailQuery = useKnowledgeDocumentDetailQuery(documentId);
  const reprocessMutation = useReprocessKnowledgeDocumentMutation();
  const doc = detailQuery.data;

  return (
    <Dialog open={Boolean(documentId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            {doc ? doc.title : 'Document Details'}
          </DialogTitle>
          <DialogDescription>
            {doc?.fileName
              ? `Source file: ${doc.fileName}`
              : 'Extracted document metadata, processing status, and indexed chunks.'}
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading document details...
          </div>
        ) : !doc ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Document details could not be loaded.
          </p>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  doc.status === KnowledgeDocumentStatus.READY
                    ? 'success'
                    : doc.status === KnowledgeDocumentStatus.FAILED
                      ? 'outline'
                      : 'teal'
                }
              >
                {STATUS_LABELS[doc.status]}
              </Badge>
              <Badge variant="secondary">{CATEGORY_LABELS[doc.category]}</Badge>
              <Badge variant="outline">{FORMAT_LABELS[doc.format]}</Badge>
              <span className="text-xs text-muted-foreground">
                {doc.chunkCount} chunk(s) • {doc.characterCount.toLocaleString()} chars
              </span>
              <span className="text-xs text-muted-foreground">
                Updated {new Date(doc.updatedAt).toLocaleString()}
              </span>
            </div>

            {doc.status === KnowledgeDocumentStatus.FAILED ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{doc.errorMessage || 'Document processing failed.'}</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => reprocessMutation.mutate(doc.id)}
                  disabled={reprocessMutation.isPending}
                >
                  <RefreshCw
                    className={`size-3.5 ${reprocessMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  Retry processing
                </Button>
              </div>
            ) : null}

            <Separator />

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Indexed Chunks ({doc.chunks?.length ?? 0})
              </h3>
              {!doc.chunks || doc.chunks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No indexed chunks available for this document yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {doc.chunks.map((chunk) => (
                    <div key={chunk.id} className="rounded-xl border bg-muted/25 p-3">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Chunk #{chunk.chunkIndex + 1}
                          {typeof chunk.metadata?.section === 'string'
                            ? ` — ${chunk.metadata.section}`
                            : ''}
                        </span>
                        <span>
                          ~{chunk.tokenCount} tokens • {chunk.characterCount} chars
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
