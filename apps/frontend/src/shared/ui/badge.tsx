import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { badgeVariants } from '@/shared/ui/badge-variants';

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
