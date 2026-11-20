import type { ReactNode } from 'react';
import { Label } from '@/shared/ui/label';

export interface AuthFieldProps {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  error?: string;
  children: ReactNode;
}

export function AuthField({ id, label, icon, error, children }: AuthFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {icon}
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
