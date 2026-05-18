import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../api/types';

export interface AuthState {
  token: string | null;
  user:  User | null;
}

const stored = (() => {
  try {
    const t = localStorage.getItem('mvp_token');
    const u = localStorage.getItem('mvp_user');
    if (t && u) return { token: t, user: JSON.parse(u) as User };
  } catch {
    localStorage.removeItem('mvp_token');
    localStorage.removeItem('mvp_user');
  }
  return { token: null, user: null };
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: stored as AuthState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user  = action.payload.user;
      localStorage.setItem('mvp_token', action.payload.token);
      localStorage.setItem('mvp_user',  JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.token = null;
      state.user  = null;
      localStorage.removeItem('mvp_token');
      localStorage.removeItem('mvp_user');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
