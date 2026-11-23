import {
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type UploadKnowledgeDocumentRequestDto,
} from '@semcache/shared-dtos';
import { KnowledgeDocumentFormat, QueryCategory } from '@semcache/shared-types';
import { FileText, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  type ParsedUploadFile,
  readUploadedFile,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import { useUploadKnowledgeDocumentsMutation } from '@/features/knowledge-base/model/use-knowledge-base';
import { getAuthServerError } from '@/shared/api/api-client';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

export interface KnowledgeBaseUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadMode = 'files' | 'manual';

export function KnowledgeBaseUploadDialog({ open, onOpenChange }: KnowledgeBaseUploadDialogProps) {
  const [mode, setMode] = useState<UploadMode>('files');
  const [queuedFiles, setQueuedFiles] = useState<ParsedUploadFile[]>([]);
  const [category, setCategory] = useState<QueryCategory>(QueryCategory.GENERAL);
  const [chunkSize, setChunkSize] = useState<number>(
    KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_SIZE,
  );
  const [chunkOverlap, setChunkOverlap] = useState<number>(
    KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_OVERLAP,
  );
  const [manualTitle, setManualTitle] = useState('');
  const [manualFileName, setManualFileName] = useState('');
  const [manualFormat, setManualFormat] = useState<KnowledgeDocumentFormat>(
    KnowledgeDocumentFormat.MARKDOWN,
  );
  const [manualContent, setManualContent] = useState('');
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

  const uploadMutation = useUploadKnowledgeDocumentsMutation();

  const resetForm = () => {
    setQueuedFiles([]);
    setManualTitle('');
    setManualFileName('');
    setManualContent('');
    setProgress(null);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    try {
      const parsed = await Promise.all(Array.from(fileList).map((file) => readUploadedFile(file)));
      const nonEmpty = parsed.filter((item) => item.content.trim().length > 0);
      if (nonEmpty.length < parsed.length) {
        toast.error('Some selected files were empty and skipped.');
      }
      setQueuedFiles((prev) => [...prev, ...nonEmpty]);
    } catch {
      toast.error('Failed to read one or more selected files.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (chunkOverlap >= chunkSize) {
      toast.error('Chunk overlap must be smaller than chunk size.');
      return;
    }

    let payloads: UploadKnowledgeDocumentRequestDto[];
    if (mode === 'files') {
      if (queuedFiles.length === 0) {
        toast.error('Select at least one document file to upload.');
        return;
      }
      payloads = queuedFiles.map((file) => ({
        title: file.title.trim() || file.fileName,
        fileName: file.fileName,
        format: file.format,
        category,
        content: file.content,
        chunkSize,
        chunkOverlap,
      }));
    } else {
      if (manualTitle.trim().length === 0 || manualContent.trim().length === 0) {
        toast.error('Document title and content are required.');
        return;
      }
      payloads = [
        {
          title: manualTitle.trim(),
          ...(manualFileName.trim() ? { fileName: manualFileName.trim() } : {}),
          format: manualFormat,
          category,
          content: manualContent,
          chunkSize,
          chunkOverlap,
        },
      ];
    }

    try {
      setProgress({ completed: 0, total: payloads.length });
      const uploaded = await uploadMutation.mutateAsync({
        documents: payloads,
        onProgress: (completed, total) => setProgress({ completed, total }),
      });

      const failedCount = uploaded.filter((doc) => doc.status === 'failed').length;
      if (failedCount > 0) {
        toast.warning(
          `Uploaded ${uploaded.length} document(s), ${failedCount} failed processing. You can retry failed documents from the list.`,
        );
      } else {
        toast.success(`Successfully uploaded and indexed ${uploaded.length} document(s).`);
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(getAuthServerError(error as Error, 'Failed to upload knowledge documents.'));
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="size-5 text-primary" />
            Upload Knowledge Documents
          </DialogTitle>
          <DialogDescription>
            Add one or multiple company documents to extract, chunk, and index for the AI Support
            Service.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-3">
          <Button
            type="button"
            variant={mode === 'files' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('files')}
          >
            Upload Files
          </Button>
          <Button
            type="button"
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('manual')}
          >
            Paste / Write Content
          </Button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {mode === 'files' ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center">
                <Label htmlFor="kb-file-upload" className="cursor-pointer space-y-1.5">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UploadCloud className="size-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Select one or multiple documents
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .txt, .md, .html, .json, .pdf, .docx
                  </p>
                </Label>
                <Input
                  id="kb-file-upload"
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.html,.htm,.json,.pdf,.docx"
                  onChange={(e) => void handleFileChange(e)}
                  className="mt-3 cursor-pointer"
                />
              </div>

              {queuedFiles.length > 0 ? (
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {queuedFiles.map((file, index) => (
                    <div
                      key={`${file.fileName}-${index}`}
                      className="flex items-center gap-2 rounded-lg border bg-background p-2.5"
                    >
                      <FileText className="size-4 shrink-0 text-primary" />
                      <Input
                        aria-label={`Title for ${file.fileName}`}
                        value={file.title}
                        onChange={(e) => {
                          const nextTitle = e.target.value;
                          setQueuedFiles((prev) =>
                            prev.map((item, idx) =>
                              idx === index ? { ...item, title: nextTitle } : item,
                            ),
                          );
                        }}
                        className="h-8 flex-1 text-sm"
                      />
                      <Badge variant="secondary" className="shrink-0">
                        {FORMAT_LABELS[file.format]}
                      </Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {file.content.length.toLocaleString()} chars
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${file.fileName}`}
                        onClick={() =>
                          setQueuedFiles((prev) => prev.filter((_, idx) => idx !== index))
                        }
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kb-manual-title">Document Title</Label>
                  <Input
                    id="kb-manual-title"
                    placeholder="e.g. 5G Unlimited Plan Policy"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kb-manual-filename">Reference Filename (optional)</Label>
                  <Input
                    id="kb-manual-filename"
                    placeholder="e.g. 5g-unlimited.md"
                    value={manualFileName}
                    onChange={(e) => setManualFileName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kb-manual-format">Content Format</Label>
                <select
                  id="kb-manual-format"
                  value={manualFormat}
                  onChange={(e) => setManualFormat(e.target.value as KnowledgeDocumentFormat)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.values(KnowledgeDocumentFormat).map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {FORMAT_LABELS[fmt]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kb-manual-content">Document Content</Label>
                <Textarea
                  id="kb-manual-content"
                  rows={6}
                  placeholder="Paste company policy, FAQ, troubleshooting steps, or tariff details..."
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="kb-upload-category">Domain Category</Label>
              <select
                id="kb-upload-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as QueryCategory)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.values(QueryCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-chunk-size">Chunk Size (chars)</Label>
              <Input
                id="kb-chunk-size"
                type="number"
                min={KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE}
                max={KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-chunk-overlap">Chunk Overlap (chars)</Label>
              <Input
                id="kb-chunk-overlap"
                type="number"
                min={0}
                max={KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_OVERLAP}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
              />
            </div>
          </div>

          {progress && uploadMutation.isPending ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border bg-accent/50 px-3 py-2 text-xs text-accent-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              <span>
                Uploading and indexing document {Math.min(progress.completed + 1, progress.total)}{' '}
                of {progress.total}...
              </span>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : mode === 'files' ? (
                `Upload ${queuedFiles.length || ''} Document${queuedFiles.length === 1 ? '' : 's'}`
              ) : (
                'Upload Document'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
