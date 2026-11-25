import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { KnowledgeDocumentFormat, QueryCategory } from '@semcache/shared-types';
import { Loader2, UploadCloud } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  type ParsedUploadFile,
  buildUploadPayloads,
  readUploadedFile,
} from '@/features/knowledge-base/model/knowledge-base-helpers';
import { useUploadKnowledgeDocumentsMutation } from '@/features/knowledge-base/model/use-knowledge-base';
import { ManualDocumentForm } from '@/features/knowledge-base/ui/manual-document-form';
import { QueryCategorySelect } from '@/features/knowledge-base/ui/query-category-select';
import { UploadFilesPanel } from '@/features/knowledge-base/ui/upload-files-panel';
import { getAuthServerError } from '@/shared/api/api-client';
import { useFileDropZone } from '@/shared/lib/use-file-drop-zone';
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

function UploadChunkingSettings({
  category,
  onCategoryChange,
  chunkSize,
  onChunkSizeChange,
  chunkOverlap,
  onChunkOverlapChange,
}: {
  category: QueryCategory;
  onCategoryChange: (value: QueryCategory) => void;
  chunkSize: number;
  onChunkSizeChange: (value: number) => void;
  chunkOverlap: number;
  onChunkOverlapChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="kb-upload-category">Domain Category</Label>
        <QueryCategorySelect
          id="kb-upload-category"
          value={category}
          onChange={(val) => onCategoryChange(val as QueryCategory)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kb-chunk-size">Chunk Size (chars)</Label>
        <Input
          id="kb-chunk-size"
          type="number"
          min={KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE}
          max={KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE}
          value={chunkSize}
          onChange={(e) => onChunkSizeChange(Number(e.target.value))}
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
          onChange={(e) => onChunkOverlapChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export interface KnowledgeBaseUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingFiles?: File[];
  onPendingFilesConsumed?: () => void;
}

type UploadMode = 'files' | 'manual';

export function KnowledgeBaseUploadDialog({
  open,
  onOpenChange,
  pendingFiles,
  onPendingFilesConsumed,
}: KnowledgeBaseUploadDialogProps) {
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

  const enqueueFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    try {
      const parsed = await Promise.all(files.map((file) => readUploadedFile(file)));
      const nonEmpty = parsed.filter((item) => item.content.trim().length > 0);
      if (nonEmpty.length < parsed.length) {
        toast.error('Some selected files were empty and skipped.');
      }
      if (nonEmpty.length > 0) {
        setQueuedFiles((prev) => [...prev, ...nonEmpty]);
      }
    } catch {
      toast.error('Failed to read one or more selected files.');
    }
  }, []);

  useEffect(() => {
    if (open && pendingFiles && pendingFiles.length > 0) {
      void enqueueFiles(pendingFiles);
      onPendingFilesConsumed?.();
    }
  }, [open, pendingFiles, enqueueFiles, onPendingFilesConsumed]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMode('files');
    }
    onOpenChange(nextOpen);
  };

  const { isDragging, dropZoneProps } = useFileDropZone({
    disabled: mode !== 'files' || uploadMutation.isPending,
    onDropFiles: (files) => {
      void enqueueFiles(files);
    },
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    try {
      await enqueueFiles(Array.from(fileList));
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { payloads, error } = buildUploadPayloads({
      mode,
      queuedFiles,
      manualTitle,
      manualFileName,
      manualFormat,
      manualContent,
      category,
      chunkSize,
      chunkOverlap,
    });
    if (error || !payloads) {
      toast.error(error ?? 'Invalid upload input.');
      return;
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
    } catch (err) {
      toast.error(getAuthServerError(err as Error, 'Failed to upload knowledge documents.'));
      setProgress(null);
    }
  };

  const submitLabel =
    mode === 'files'
      ? `Upload ${queuedFiles.length || ''} Document${queuedFiles.length === 1 ? '' : 's'}`
      : 'Upload Document';

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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
            <UploadFilesPanel
              isDragging={isDragging}
              dropZoneProps={dropZoneProps}
              queuedFiles={queuedFiles}
              onFileChange={(e) => void handleFileChange(e)}
              onUpdateTitle={(index, title) =>
                setQueuedFiles((prev) =>
                  prev.map((item, idx) => (idx === index ? { ...item, title } : item)),
                )
              }
              onRemoveFile={(index) =>
                setQueuedFiles((prev) => prev.filter((_, idx) => idx !== index))
              }
            />
          ) : (
            <ManualDocumentForm
              title={manualTitle}
              onTitleChange={setManualTitle}
              fileName={manualFileName}
              onFileNameChange={setManualFileName}
              format={manualFormat}
              onFormatChange={setManualFormat}
              content={manualContent}
              onContentChange={setManualContent}
            />
          )}

          <UploadChunkingSettings
            category={category}
            onCategoryChange={setCategory}
            chunkSize={chunkSize}
            onChunkSizeChange={setChunkSize}
            chunkOverlap={chunkOverlap}
            onChunkOverlapChange={setChunkOverlap}
          />

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
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
