import { useMemo } from 'react';
import { useAppSelector } from '../store/store';
import { useMeQuery } from '../api/api';

export function useAuth() {
  const auth = useAppSelector((s) => s.auth);
  const me = useMeQuery(undefined, { skip: !auth.token });

  return useMemo(
    () => ({
      token: auth.token,
      role: auth.role,
      userId: auth.userId,
      fio: auth.fio,
      username: auth.username,
      me: me.data,
      meLoading: me.isLoading || me.isFetching,
      isAuthenticated: Boolean(auth.token),
    }),
    [auth, me.data, me.isLoading, me.isFetching]
  );
}
