import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        teal: 'border-cyan-200/80 bg-accent text-accent-foreground dark:border-cyan-800/60',
        outline: 'border-border bg-background text-foreground',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
