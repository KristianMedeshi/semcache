import { CheckCircle2 } from 'lucide-react';
import { AUTH_VALIDATION_LIMITS } from '@/features/auth/model/auth-schemas';

const LOWERCASE_REGEX = /[a-z]/;
const UPPERCASE_REGEX = /[A-Z]/;
const NUMBER_OR_SYMBOL_REGEX = /[\d\W]/;

export interface PasswordChecklistProps {
  password: string;
}

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const checks = [
    {
      label: `At least ${AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH} characters`,
      valid: password.length >= AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH,
    },
    {
      label: 'Uppercase & lowercase letters',
      valid: LOWERCASE_REGEX.test(password) && UPPERCASE_REGEX.test(password),
    },
    {
      label: 'Number or special character',
      valid: NUMBER_OR_SYMBOL_REGEX.test(password),
    },
  ];

  return (
    <ul className="space-y-1 pt-1">
      {checks.map((check) => (
        <li
          key={check.label}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            check.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          }`}
        >
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span>{check.label}</span>
        </li>
      ))}
    </ul>
  );
}
