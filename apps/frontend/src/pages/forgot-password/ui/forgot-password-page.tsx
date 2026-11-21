import { AUTH_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { AuthEmailField } from '@/features/auth/ui/auth-email-field';
import { AuthSubmitButton } from '@/features/auth/ui/auth-submit-button';
import { authFieldSchemas, useZodForm } from '@/shared/lib/forms';
import { Button } from '@/shared/ui/button';
import { AuthShell } from '@/widgets/auth-shell/ui/auth-shell';

const forgotPasswordSchema = z.object({
  email: authFieldSchemas.email.max(
    AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH,
    `Email must be at most ${AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH} characters`,
  ),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useZodForm(forgotPasswordSchema, {
    defaultValues: { email: '' },
  });

  const onSubmit = (values: ForgotPasswordFormValues) => {
    setSubmittedEmail(values.email);
  };

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your subscriber email address to receive password recovery instructions."
      footer={
        <Link
          to="/sign-in"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      }
    >
      {submittedEmail ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">Check your inbox</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If an account exists for{' '}
              <span className="font-medium text-foreground">{submittedEmail}</span>, we&apos;ve sent
              instructions to reset your SemCache Telecom password.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/sign-in">Return to Sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <AuthEmailField
            id="forgot-password-email"
            error={errors.email?.message}
            {...register('email')}
          />

          <AuthSubmitButton isPending={isSubmitting} pendingText="Sending instructions...">
            Send recovery link
          </AuthSubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
