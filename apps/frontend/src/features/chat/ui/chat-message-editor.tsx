import type { FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

export interface ChatMessageEditorProps {
  draft: string;
  isBusy: boolean;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatMessageEditor({
  draft,
  isBusy,
  onDraftChange,
  onCancel,
  onSubmit,
}: ChatMessageEditorProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="w-full min-w-[260px] rounded-2xl border bg-card p-3 text-card-foreground shadow-xs sm:min-w-[360px]"
    >
      <Textarea
        rows={3}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel();
          }
        }}
        aria-label="Edit message"
        autoFocus
        className="min-h-18 resize-y text-sm"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 rounded-lg px-3 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isBusy || draft.trim().length === 0}
          className="h-8 rounded-lg px-3 text-xs"
        >
          Save &amp; Submit
        </Button>
      </div>
    </form>
  );
}
