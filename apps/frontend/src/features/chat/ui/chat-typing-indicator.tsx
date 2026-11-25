import { Headset } from 'lucide-react';

export function ChatTypingIndicator() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
        <Headset className="size-4" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-xs text-muted-foreground shadow-xs">
        <span className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-primary" />
        </span>
        <span>Telecom Assistant is typing...</span>
      </div>
    </div>
  );
}
