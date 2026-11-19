import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell, PasswordInput } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSignInMutation } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';
import { signInSchema, type SignInFormValues } from '@/lib/auth-schemas';
import { useZodForm } from '@/lib/forms';

export function SignInPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/sign-in' });
  const signInMutation = useSignInMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useZodForm(signInSchema, {
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignInFormValues) => {
    try {
      await signInMutation.mutateAsync(values);
      toast.success('Welcome back');
      const target = search.redirect && search.redirect.startsWith('/') ? search.redirect : '/';
      await navigate({ to: target as '/' });
    } catch {
      // Error state is rendered inline via signInMutation.error.
    }
  };

  const serverError =
    signInMutation.error instanceof ApiError
      ? signInMutation.error.message
      : signInMutation.error
        ? 'Unable to sign in. Please try again.'
        : null;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your SemCache account to continue."
      footer={
        <span>
          Don&apos;t have an account?{' '}
          <Link
            to="/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
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
          <Label htmlFor="sign-in-email">
            <Mail className="size-3.5 text-muted-foreground" />
            Email address
          </Label>
          <Input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email) || undefined}
            {...register('email')}
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sign-in-password">
            <Lock className="size-3.5 text-muted-foreground" />
            Password
          </Label>
          <PasswordInput
            id="sign-in-password"
            autoComplete="current-password"
            placeholder="Enter your password"
            hasError={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={signInMutation.isPending}>
          {signInMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
