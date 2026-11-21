import { ArrowUpRight, Sparkles } from 'lucide-react';
import { TELECOM_SUGGESTIONS } from '@/features/chat/model/telecom-suggestions';
import { Badge } from '@/shared/ui/badge';

export interface ChatWelcomeStateProps {
  onSelectSuggestion: (prompt: string) => void;
  disabled?: boolean;
}

export function ChatWelcomeState({ onSelectSuggestion, disabled }: ChatWelcomeStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center py-6 sm:py-10">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-xs">
        <Sparkles className="size-6" />
      </div>

      <Badge variant="teal" className="mb-3">
        24/7 SemCache Telecom Support
      </Badge>

      <h2 className="max-w-xl text-center text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        Hello! Welcome to SemCache Support.
      </h2>

      <p className="mt-2 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
        I&apos;m your AI assistant, here to help with your mobile services. What can I help you with
        today?
      </p>

      <p className="mt-1.5 max-w-lg text-center text-xs text-muted-foreground">
        Ask about mobile plans, data usage, bill payments, international roaming, eSIM activation,
        or network troubleshooting.
      </p>

      <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TELECOM_SUGGESTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectSuggestion(item.prompt)}
              className="group flex flex-col items-start gap-2.5 rounded-xl border bg-card p-4 text-left shadow-xs transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <div className="flex w-full items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {item.category}
                </span>
                <span className="block text-sm font-medium leading-snug text-foreground">
                  {item.prompt}
                </span>
                <span className="block text-xs text-muted-foreground">{item.subtitle}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
