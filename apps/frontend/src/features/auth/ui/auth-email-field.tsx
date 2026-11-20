import { Mail } from 'lucide-react';
import { AuthField } from '@/features/auth/ui/auth-field';
import { Input } from '@/shared/ui/input';

export interface AuthEmailFieldProps extends Omit<React.ComponentProps<'input'>, 'id' | 'type'> {
  id: string;
  error?: string;
}

const emailIcon = <Mail className="size-3.5 text-muted-foreground" />;

export function AuthEmailField({ id, error, ...inputProps }: AuthEmailFieldProps) {
  return (
    <AuthField id={id} label="Email address" icon={emailIcon} error={error}>
      <Input
        id={id}
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        aria-invalid={Boolean(error) || undefined}
        {...inputProps}
      />
    </AuthField>
  );
}
