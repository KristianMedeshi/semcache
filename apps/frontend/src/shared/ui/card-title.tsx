import type * as React from 'react';
import { cn } from '@/shared/lib/utils';

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold tracking-tight', className)}
      {...props}
    />
  );
}
