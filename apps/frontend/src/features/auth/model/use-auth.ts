import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, login, logout, registerCustomer } from '@/features/auth/api/auth.client';
import { queryKeys } from '@/shared/api/query-client';

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: getCurrentUser,
  });
}

export function useSignInMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      client.setQueryData(queryKeys.auth.me(), user);
    },
  });
}

export function useSignUpMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: registerCustomer,
    onSuccess: (user) => {
      client.setQueryData(queryKeys.auth.me(), user);
    },
  });
}

export function useSignOutMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      client.setQueryData(queryKeys.auth.me(), null);
      client.removeQueries({ queryKey: queryKeys.users.all });
      client.removeQueries({ queryKey: queryKeys.dialogs.all });
    },
  });
}
