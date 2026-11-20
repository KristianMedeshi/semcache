import type * as React from 'react';
import { cn } from '@/shared/lib/utils';

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6', className)}
      {...props}
    />
  );
}
