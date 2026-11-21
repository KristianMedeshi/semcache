import { Paperclip, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

export interface ChatComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onOpenEscalation: () => void;
  isSending: boolean;
}

export function ChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  onOpenEscalation,
  isSending,
}: ChatComposerProps) {
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isSending && draft.trim().length > 0) {
        onSubmit();
        setAttachmentName(null);
      }
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSending && draft.trim().length > 0) {
      onSubmit();
      setAttachmentName(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachmentName(file.name);
    }
    event.target.value = '';
  };

  return (
    <div className="shrink-0 border-t bg-card px-3 pt-3 pb-3 sm:px-6">
      <form
        onSubmit={handleFormSubmit}
        className="mx-auto max-w-3xl rounded-xl border bg-background p-2 shadow-xs transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25"
      >
        {attachmentName ? (
          <div className="mb-2 flex items-center gap-2 px-2">
            <Badge variant="secondary" className="gap-1.5 rounded-lg py-1">
              <Paperclip className="size-3" />
              <span className="max-w-48 truncate">{attachmentName}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => setAttachmentName(null)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.txt"
            onChange={handleFileChange}
            aria-label="File attachment input"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            disabled={isSending}
            onClick={() => fileInputRef.current?.click()}
            className="size-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="size-4" />
          </Button>

          <Textarea
            rows={1}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your mobile services..."
            aria-label="Message input"
            disabled={isSending}
            className="max-h-36 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0"
          />

          <Button
            type="submit"
            size="sm"
            aria-label="Send message"
            disabled={isSending || draft.trim().length === 0}
            className="h-9 shrink-0 rounded-lg px-3.5"
          >
            <Send className="size-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
      </form>

      <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>Enter to send · Shift + Enter for a new line</span>
        <button
          type="button"
          onClick={onOpenEscalation}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Talk to a human agent
        </button>
      </div>
    </div>
  );
}
