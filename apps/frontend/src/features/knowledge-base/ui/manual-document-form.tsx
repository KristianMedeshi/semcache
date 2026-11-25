import { KnowledgeDocumentFormat } from '@semcache/shared-types';
import { FORMAT_LABELS } from '@/features/knowledge-base/model/knowledge-base-helpers';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

export interface ManualDocumentFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  fileName: string;
  onFileNameChange: (value: string) => void;
  format: KnowledgeDocumentFormat;
  onFormatChange: (value: KnowledgeDocumentFormat) => void;
  content: string;
  onContentChange: (value: string) => void;
}

export function ManualDocumentForm({
  title,
  onTitleChange,
  fileName,
  onFileNameChange,
  format,
  onFormatChange,
  content,
  onContentChange,
}: ManualDocumentFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kb-manual-title">Document Title</Label>
          <Input
            id="kb-manual-title"
            placeholder="e.g. 5G Unlimited Plan Policy"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kb-manual-filename">Reference Filename (optional)</Label>
          <Input
            id="kb-manual-filename"
            placeholder="e.g. 5g-unlimited.md"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kb-manual-format">Content Format</Label>
        <select
          id="kb-manual-format"
          value={format}
          onChange={(e) => onFormatChange(e.target.value as KnowledgeDocumentFormat)}
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
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          required
        />
      </div>
    </div>
  );
}
