import { Radio } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface BrandLogoProps {
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

export function BrandLogo({
  subtitle = 'Telecom Support',
  compact = false,
  className,
}: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
        <Radio className="size-4.5" />
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-cyan-400"
        />
      </div>
      {!compact && (
        <div className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-foreground">
            SemCache
          </span>
          {subtitle ? (
            <span className="block text-[11px] font-medium text-muted-foreground">{subtitle}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
