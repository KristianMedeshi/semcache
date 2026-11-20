import { AlertCircle } from 'lucide-react';

export interface AuthErrorAlertProps {
  message: string | null;
}

export function AuthErrorAlert({ message }: AuthErrorAlertProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
