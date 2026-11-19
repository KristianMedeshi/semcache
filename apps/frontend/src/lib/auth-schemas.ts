import { z } from 'zod';
import { authFieldSchemas } from '@/lib/forms';

export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,128}$/;

export const signInSchema = z.object({
  email: authFieldSchemas.email.max(255, 'Email must be at most 255 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password must be at most 128 characters'),
});

export const signUpSchema = z
  .object({
    email: authFieldSchemas.email.max(255, 'Email must be at most 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be at most 128 characters')
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
