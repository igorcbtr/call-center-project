import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserRole } from '../../api/types';

export interface AuthState {
  token: string | null;
  role: UserRole | null;
  userId: number | null;
  fio: string | null;
  username: string | null;
}

const readLs = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  token: readLs('mvp_token'),
  role: (readLs('mvp_role') as UserRole | null) ?? null,
  userId: readLs('mvp_uid') ? Number(readLs('mvp_uid')) : null,
  fio: readLs('mvp_fio'),
  username: readLs('mvp_username'),
};

function persist(state: AuthState) {
  try {
    if (state.token) localStorage.setItem('mvp_token', state.token);
    else localStorage.removeItem('mvp_token');
    if (state.role) localStorage.setItem('mvp_role', state.role);
    else localStorage.removeItem('mvp_role');
    if (state.userId != null) localStorage.setItem('mvp_uid', String(state.userId));
    else localStorage.removeItem('mvp_uid');
    if (state.fio) localStorage.setItem('mvp_fio', state.fio);
    else localStorage.removeItem('mvp_fio');
    if (state.username) localStorage.setItem('mvp_username', state.username);
    else localStorage.removeItem('mvp_username');
  } catch {
    /* ignore */
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        token: string;
        role: UserRole;
        id: number;
        fio: string;
        username: string | null;
      }>
    ) => {
      state.token = action.payload.token;
      state.role = action.payload.role;
      state.userId = action.payload.id;
      state.fio = action.payload.fio;
      state.username = action.payload.username;
      persist(state);
    },
    logout: (state) => {
      state.token = null;
      state.role = null;
      state.userId = null;
      state.fio = null;
      state.username = null;
      persist(state);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
