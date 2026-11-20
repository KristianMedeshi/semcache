import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type UseFormProps, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

/**
 * Shared form field schemas ready for future Sign In / Sign Up forms.
 */
export const authFieldSchemas = {
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
};

/**
 * Typed helper around React Hook Form's `useForm` pre-wired with `zodResolver`.
 */
export function useZodForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, 'resolver'>,
): UseFormReturn<z.input<TSchema>, unknown, z.output<TSchema>> {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    ...options,
    resolver: zodResolver(schema),
  });
}
