import { AUTH_VALIDATION_LIMITS, PASSWORD_COMPLEXITY_REGEX } from '@semcache/shared-dtos';
import { z } from 'zod';
import { authFieldSchemas } from '@/shared/lib/forms';

export { AUTH_VALIDATION_LIMITS, PASSWORD_COMPLEXITY_REGEX };

export const signInSchema = z.object({
  email: authFieldSchemas.email.max(
    AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH,
    `Email must be at most ${AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH} characters`,
  ),
  password: z
    .string()
    .min(AUTH_VALIDATION_LIMITS.PASSWORD_LOGIN_MIN_LENGTH, 'Password is required')
    .max(
      AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
      `Password must be at most ${AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH} characters`,
    ),
});

export const signUpSchema = z
  .object({
    email: authFieldSchemas.email.max(
      AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH,
      `Email must be at most ${AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH} characters`,
    ),
    password: z
      .string()
      .min(
        AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH,
        `Password must be at least ${AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH} characters`,
      )
      .max(
        AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
        `Password must be at most ${AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH} characters`,
      )
      .regex(
        PASSWORD_COMPLEXITY_REGEX,
        'Include uppercase, lowercase, and a number or special character',
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type SignInFormValues = z.infer<typeof signInSchema>;
export type SignUpFormValues = z.infer<typeof signUpSchema>;
