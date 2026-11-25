import type { KnowledgeDocumentResponseDto } from '@semcache/shared-dtos';
import { KnowledgeDocumentStatus } from '@semcache/shared-types';
import { AlertTriangle, CheckCircle2, Eye, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

export interface KnowledgeBaseDocumentRowProps {
  doc: KnowledgeDocumentResponseDto;
  isReprocessing: boolean;
  onSelect: () => void;
  onRetry: () => void;
  onDelete: () => void;
}

function DocumentStatusBadge({ status }: { status: KnowledgeDocumentStatus }) {
  if (status === KnowledgeDocumentStatus.READY) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="size-3" />
        Ready
      </Badge>
    );
  }
  if (status === KnowledgeDocumentStatus.FAILED) {
    return (
      <Badge variant="outline" className="border-destructive/50 text-destructive">
        <AlertTriangle className="size-3" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="teal">
      <Loader2 className="size-3 animate-spin" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function KnowledgeBaseDocumentRow({
  doc,
  isReprocessing,
  onSelect,
  onRetry,
  onDelete,
}: KnowledgeBaseDocumentRowProps) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-3.5 sm:flex-row sm:items-center">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{doc.title}</p>
          <DocumentStatusBadge status={doc.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[11px]">
            {CATEGORY_LABELS[doc.category]}
          </Badge>
          <span>{FORMAT_LABELS[doc.format]}</span>
          {doc.fileName ? <span>• {doc.fileName}</span> : null}
          <span>• {doc.chunkCount} chunks</span>
          <span>• {doc.characterCount.toLocaleString()} chars</span>
        </div>

        {doc.status === KnowledgeDocumentStatus.FAILED && doc.errorMessage ? (
          <p className="text-xs text-destructive">{doc.errorMessage}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={onSelect}>
          <Eye className="size-3.5" />
          Details
        </Button>

        {doc.status === KnowledgeDocumentStatus.FAILED ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isReprocessing}
          >
            <RefreshCw className={`size-3.5 ${isReprocessing ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${doc.title}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
