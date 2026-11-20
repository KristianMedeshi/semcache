import { ArrowRight, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';

export interface AuthSubmitButtonProps {
  isPending: boolean;
  pendingText: string;
  children: ReactNode;
}

export function AuthSubmitButton({ isPending, pendingText, children }: AuthSubmitButtonProps) {
  return (
    <Button type="submit" className="w-full" disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="size-4" />
        </>
      )}
    </Button>
  );
}
