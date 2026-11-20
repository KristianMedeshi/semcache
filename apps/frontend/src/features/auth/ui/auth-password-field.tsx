import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuthField } from '@/features/auth/ui/auth-field';
import { PasswordInput } from '@/features/auth/ui/password-input';

export interface AuthPasswordFieldProps extends Omit<React.ComponentProps<'input'>, 'id' | 'type'> {
  id: string;
  label?: string;
  error?: string;
  children?: ReactNode;
}

const lockIcon = <Lock className="size-3.5 text-muted-foreground" />;

export function AuthPasswordField({
  id,
  label = 'Password',
  error,
  children,
  ...inputProps
}: AuthPasswordFieldProps) {
  return (
    <div className="space-y-2">
      <AuthField id={id} label={label} icon={lockIcon} error={error}>
        <PasswordInput id={id} aria-invalid={Boolean(error) || undefined} {...inputProps} />
      </AuthField>
      {children}
    </div>
  );
}
