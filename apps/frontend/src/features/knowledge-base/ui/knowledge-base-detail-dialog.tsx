import { KnowledgeDocumentFormat, KnowledgeDocumentStatus } from '@semcache/shared-types';
import { AlertTriangle, FileText, Loader2, Pencil, RefreshCw, Save, X } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
  readUploadedFile,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import {
  useKnowledgeDocumentDetailQuery,
  useReprocessKnowledgeDocumentMutation,
} from '@/features/knowledge-base/model/use-knowledge-base';
import { getAuthServerError } from '@/shared/api/api-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';
import { Textarea } from '@/shared/ui/textarea';

export interface KnowledgeBaseDetailDialogProps {
  documentId: string | null;
  initialEditMode?: boolean;
  onOpenChange: (open: boolean) => void;
}

function isBinaryFormat(format: KnowledgeDocumentFormat): boolean {
  return format === KnowledgeDocumentFormat.PDF || format === KnowledgeDocumentFormat.DOCX;
}

export function KnowledgeBaseDetailDialog({
  documentId,
  initialEditMode = false,
  onOpenChange,
}: KnowledgeBaseDetailDialogProps) {
  const detailQuery = useKnowledgeDocumentDetailQuery(documentId);
  const reprocessMutation = useReprocessKnowledgeDocumentMutation();
  const doc = detailQuery.data;

  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [titleDraft, setTitleDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [replacementContent, setReplacementContent] = useState<string | null>(null);
  const [replacementFileName, setReplacementFileName] = useState<string | null>(null);

  useEffect(() => {
    setIsEditing(initialEditMode);
    setReplacementContent(null);
    setReplacementFileName(null);
  }, [documentId, initialEditMode]);

  useEffect(() => {
    if (doc) {
      setTitleDraft(doc.title);
      setContentDraft(doc.content);
    }
  }, [doc]);

  const handleEnterEditMode = () => {
    if (doc) {
      setTitleDraft(doc.title);
      setContentDraft(doc.content);
      setReplacementContent(null);
      setReplacementFileName(null);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (doc) {
      setTitleDraft(doc.title);
      setContentDraft(doc.content);
    }
    setReplacementContent(null);
    setReplacementFileName(null);
    setIsEditing(false);
  };

  const handleReplacementFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const parsed = await readUploadedFile(file);
      setReplacementContent(parsed.content);
      setReplacementFileName(parsed.fileName);
    } catch {
      toast.error('Failed to read replacement file.');
    }
  };

  const handleSaveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!doc) {
      return;
    }

    const trimmedTitle = titleDraft.trim();
    if (trimmedTitle.length === 0) {
      toast.error('Document title is required.');
      return;
    }

    const binary = isBinaryFormat(doc.format);
    if (!binary && contentDraft.trim().length === 0) {
      toast.error('Document content cannot be empty.');
      return;
    }

    try {
      const updated = await reprocessMutation.mutateAsync({
        documentId: doc.id,
        dto: {
          title: trimmedTitle,
          ...(binary
            ? replacementContent
              ? { content: replacementContent }
              : {}
            : { content: contentDraft }),
          includeChunks: true,
        },
      });
      toast.success(
        `Updated and reprocessed "${updated.title}". Linked semantic cache entries were invalidated.`,
      );
      setReplacementContent(null);
      setReplacementFileName(null);
      setIsEditing(false);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to update and reprocess document.'));
    }
  };

  return (
    <Dialog open={Boolean(documentId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                {doc ? doc.title : 'Document Details'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {doc?.fileName
                  ? `Source file: ${doc.fileName}`
                  : 'Extracted document metadata, processing status, and indexed chunks.'}
              </DialogDescription>
            </div>

            {doc && !isEditing ? (
              <Button type="button" variant="outline" size="sm" onClick={handleEnterEditMode}>
                <Pencil className="size-3.5" />
                Edit &amp; Reprocess
              </Button>
            ) : null}
          </div>
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

            {isEditing ? (
              <form
                onSubmit={(e) => void handleSaveEdit(e)}
                className="space-y-3 rounded-xl border bg-muted/20 p-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="kb-edit-title">Document Title</Label>
                  <Input
                    id="kb-edit-title"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    disabled={reprocessMutation.isPending}
                  />
                </div>

                {isBinaryFormat(doc.format) ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="kb-edit-replacement-file">
                      Replace {FORMAT_LABELS[doc.format]} File (optional)
                    </Label>
                    <Input
                      id="kb-edit-replacement-file"
                      type="file"
                      accept={doc.format === KnowledgeDocumentFormat.PDF ? '.pdf' : '.docx'}
                      onChange={(e) => void handleReplacementFileChange(e)}
                      disabled={reprocessMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {replacementFileName
                        ? `Selected replacement: ${replacementFileName}`
                        : 'Leave empty to reprocess the existing file with the updated title.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="kb-edit-content">Document Content</Label>
                    <Textarea
                      id="kb-edit-content"
                      rows={10}
                      value={contentDraft}
                      onChange={(e) => setContentDraft(e.target.value)}
                      disabled={reprocessMutation.isPending}
                      className="font-mono text-xs"
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Saving updates the document, regenerates vector chunks, and automatically
                  invalidates linked semantic cache entries.
                </p>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={reprocessMutation.isPending}
                  >
                    <X className="size-3.5" />
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={reprocessMutation.isPending}>
                    {reprocessMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving &amp; Reprocessing...
                      </>
                    ) : (
                      <>
                        <Save className="size-3.5" />
                        Save &amp; Reprocess
                      </>
                    )}
                  </Button>
                </div>
              </form>
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
