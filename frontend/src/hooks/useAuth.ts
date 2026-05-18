import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

export function useAuth() {
  const { token, user } = useSelector((s: RootState) => s.auth);
  return {
    isAuthenticated: !!token && !!user,
    token,
    user,
    userId: user?.id   ?? null,
    fio:    user?.fio  ?? '',
    role:   user?.role ?? null,
  };
}
