import { FileText, Trash2, UploadCloud } from 'lucide-react';
import type { ChangeEvent, DragEvent } from 'react';
import { FORMAT_LABELS, type ParsedUploadFile } from '@/features/knowledge-base/model/knowledge-base-helpers';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';

export interface UploadFilesPanelProps {
  isDragging: boolean;
  dropZoneProps: {
    onDragEnter: (event: DragEvent<HTMLElement>) => void;
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  queuedFiles: ParsedUploadFile[];
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateTitle: (index: number, title: string) => void;
  onRemoveFile: (index: number) => void;
}

export function UploadFilesPanel({
  isDragging,
  dropZoneProps,
  queuedFiles,
  onFileChange,
  onUpdateTitle,
  onRemoveFile,
}: UploadFilesPanelProps) {
  return (
    <div className="space-y-3">
      <div
        {...dropZoneProps}
        data-testid="kb-dialog-dropzone"
        className={cn(
          'rounded-xl border border-dashed p-4 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'bg-muted/30',
        )}
      >
        <Label htmlFor="kb-file-upload" className="cursor-pointer space-y-1.5">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {isDragging
              ? 'Drop documents here to add them'
              : 'Drag & drop documents here, or choose from your computer'}
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
          onChange={onFileChange}
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
                onChange={(e) => onUpdateTitle(index, e.target.value)}
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
                onClick={() => onRemoveFile(index)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
