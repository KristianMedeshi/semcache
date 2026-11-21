import {
  AUTH_VALIDATION_LIMITS,
  PASSWORD_COMPLEXITY_REGEX,
  type UserResponseDto,
} from '@semcache/shared-dtos';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { updateUserProfile } from '@/features/auth/api/auth.client';
import { AuthEmailField } from '@/features/auth/ui/auth-email-field';
import { AuthErrorAlert } from '@/features/auth/ui/auth-error-alert';
import { AuthPasswordField } from '@/features/auth/ui/auth-password-field';
import { PasswordChecklist } from '@/features/auth/ui/password-checklist';
import { getAuthServerError } from '@/shared/api/api-client';
import { queryKeys } from '@/shared/api/query-client';
import { authFieldSchemas, useZodForm } from '@/shared/lib/forms';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

const profileSchema = z.object({
  email: authFieldSchemas.email.max(AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH),
  password: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.length === 0 || PASSWORD_COMPLEXITY_REGEX.test(val),
      'Include 8+ characters with uppercase, lowercase, and a number or special character',
    ),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export interface ProfileSettingsDialogProps {
  user: UserResponseDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({ user, open, onOpenChange }: ProfileSettingsDialogProps) {
  const client = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateUserProfile(user.id, {
        email: values.email !== user.email ? values.email : undefined,
        password: values.password && values.password.length > 0 ? values.password : undefined,
      }),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.auth.me(), updated);
      toast.success('Account settings updated');
      onOpenChange(false);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useZodForm(profileSchema, {
    defaultValues: {
      email: user.email,
      password: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({ email: user.email, password: '' });
      updateMutation.reset();
    }
  }, [open, user.email, reset]);

  const passwordValue = watch('password') ?? '';
  const serverError = getAuthServerError(
    updateMutation.error,
    'Unable to update your account settings.',
  );

  const onSubmit = async (values: ProfileFormValues) => {
    const emailChanged = values.email !== user.email;
    const passwordProvided = Boolean(values.password && values.password.length > 0);
    if (!emailChanged && !passwordProvided) {
      onOpenChange(false);
      return;
    }
    await updateMutation.mutateAsync(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Update your SemCache Telecom subscriber email or security password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <AuthErrorAlert message={serverError} />

          <AuthEmailField id="profile-email" error={errors.email?.message} {...register('email')} />

          <AuthPasswordField
            id="profile-password"
            label="New password (optional)"
            autoComplete="new-password"
            placeholder="Leave blank to keep current password"
            error={errors.password?.message}
            {...register('password')}
          >
            {passwordValue.length > 0 ? <PasswordChecklist password={passwordValue} /> : null}
          </AuthPasswordField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
