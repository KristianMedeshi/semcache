import { Link, useNavigate } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell, PasswordInput } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSignUpMutation } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';
import { signUpSchema, type SignUpFormValues } from '@/lib/auth-schemas';
import { useZodForm } from '@/lib/forms';

export function SignUpPage() {
  const navigate = useNavigate();
  const signUpMutation = useSignUpMutation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useZodForm(signUpSchema, {
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');
  const passwordChecks = [
    { label: 'At least 8 characters', valid: passwordValue.length >= 8 },
    {
      label: 'Uppercase & lowercase letters',
      valid: /[a-z]/.test(passwordValue) && /[A-Z]/.test(passwordValue),
    },
    { label: 'Number or special character', valid: /[\d\W]/.test(passwordValue) },
  ];

  const onSubmit = async (values: SignUpFormValues) => {
    try {
      await signUpMutation.mutateAsync({
        email: values.email,
        password: values.password,
      });
      toast.success('Account created successfully');
      await navigate({ to: '/' });
    } catch {
      // Error state is rendered inline via signUpMutation.error.
    }
  };

  const serverError =
    signUpMutation.error instanceof ApiError
      ? signUpMutation.error.message
      : signUpMutation.error
        ? 'Unable to create account. Please try again.'
        : null;

  return (
    <AuthShell
      title="Create your account"
      description="Get started with SemCache customer support."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="sign-up-email">
            <Mail className="size-3.5 text-muted-foreground" />
            Email address
          </Label>
          <Input
            id="sign-up-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email) || undefined}
            {...register('email')}
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sign-up-password">
            <Lock className="size-3.5 text-muted-foreground" />
            Password
          </Label>
          <PasswordInput
            id="sign-up-password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            hasError={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
          <ul className="space-y-1 pt-1">
            {passwordChecks.map((check) => (
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="sign-up-confirm-password">
            <Lock className="size-3.5 text-muted-foreground" />
            Confirm password
          </Label>
          <PasswordInput
            id="sign-up-confirm-password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            hasError={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword ? (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={signUpMutation.isPending}>
          {signUpMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
