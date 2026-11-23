import { Link, useNavigate } from '@tanstack/react-router';
import { signUpSchema, type SignUpFormValues } from '@/features/auth/model/auth-schemas';
import { useSignUpMutation } from '@/features/auth/model/use-auth';
import { AuthEmailField } from '@/features/auth/ui/auth-email-field';
import { AuthErrorAlert } from '@/features/auth/ui/auth-error-alert';
import { AuthPasswordField } from '@/features/auth/ui/auth-password-field';
import { AuthSubmitButton } from '@/features/auth/ui/auth-submit-button';
import { PasswordChecklist } from '@/features/auth/ui/password-checklist';
import { getAuthServerError } from '@/shared/api/api-client';
import { useZodForm } from '@/shared/lib/forms';
import { AuthShell } from '@/widgets/auth-shell/ui/auth-shell';

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

  const onSubmit = async (values: SignUpFormValues) => {
    try {
      await signUpMutation.mutateAsync({
        email: values.email,
        password: values.password,
      });
      await navigate({ to: '/' });
    } catch {
      // Error state is rendered inline via signUpMutation.error.
    }
  };

  const serverError = getAuthServerError(
    signUpMutation.error,
    'Unable to create account. Please try again.',
  );

  return (
    <AuthShell
      title="Create your account"
      description="Get started with SemCache Telecom customer support."
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
        <AuthErrorAlert message={serverError} />

        <AuthEmailField id="sign-up-email" error={errors.email?.message} {...register('email')} />

        <AuthPasswordField
          id="sign-up-password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          error={errors.password?.message}
          {...register('password')}
        >
          <PasswordChecklist password={passwordValue} />
        </AuthPasswordField>

        <AuthPasswordField
          id="sign-up-confirm-password"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <AuthSubmitButton isPending={signUpMutation.isPending} pendingText="Creating account...">
          Create account
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
}
