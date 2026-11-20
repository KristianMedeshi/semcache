import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { signInSchema, type SignInFormValues } from '@/features/auth/model/auth-schemas';
import { useSignInMutation } from '@/features/auth/model/use-auth';
import { AuthEmailField } from '@/features/auth/ui/auth-email-field';
import { AuthErrorAlert } from '@/features/auth/ui/auth-error-alert';
import { AuthPasswordField } from '@/features/auth/ui/auth-password-field';
import { AuthSubmitButton } from '@/features/auth/ui/auth-submit-button';
import { getAuthServerError } from '@/shared/api/api-client';
import { useZodForm } from '@/shared/lib/forms';
import { AuthShell } from '@/widgets/auth-shell/ui/auth-shell';

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

  const serverError = getAuthServerError(
    signInMutation.error,
    'Unable to sign in. Please try again.',
  );

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
        <AuthErrorAlert message={serverError} />

        <AuthEmailField id="sign-in-email" error={errors.email?.message} {...register('email')} />

        <AuthPasswordField
          id="sign-in-password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <AuthSubmitButton isPending={signInMutation.isPending} pendingText="Signing in...">
          Sign in
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
}
