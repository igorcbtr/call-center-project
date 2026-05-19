import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useScanActionMutation, useLoginMutation } from '../../api/api';
import type { User } from '../../api/types';
import { useAppDispatch } from '../../store/store';
import { setCredentials } from '../auth/authSlice';
import styles from './ScanPage.module.css';

function apiMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'message' in data) return String(data.message);
  }
  return fallback;
}

export function ScanPage() {
  const [params] = useSearchParams();
  const place = params.get('place') || 'Рабочее место';
  const code  = params.get('code') || '';
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [scanAction, { isLoading: scanning }] = useScanActionMutation();
  const [loginMut,   { isLoading: logging }]  = useLoginMutation();

  const [token, setToken] = useState(() => localStorage.getItem('mvp_token'));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('mvp_user') || 'null'); } catch { return null; }
  });

  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username:'', password:'' });
  const [done, setDone] = useState<'in'|'out'|null>(null);

  const isLoggedIn = !!token && !!user;

  const doScan = async (action: 'in'|'out') => {
    if (!isLoggedIn) { setShowLogin(true); return; }
    try {
      await scanAction({ place, code, action }).unwrap();
      setDone(action);
      toast.success(action === 'in' ? '✅ Вход зафиксирован!' : '👋 Выход зафиксирован!');
      window.setTimeout(() => {
        if (user?.role === 'admin') navigate('/admin/attendance');
        else if (user?.role === 'moderator') navigate('/mod/attendance');
        else navigate('/attendance');
      }, 1200);
    } catch { toast.error('Ошибка при отметке'); }
  };

  const doLogin = async () => {
    if (!loginForm.username || !loginForm.password) { toast.error('Введите логин и пароль'); return; }
    try {
      const res = await loginMut({ username: loginForm.username, password: loginForm.password }).unwrap();
      localStorage.setItem('mvp_token', res.token);
      const u: User = { id: res.id, fio: res.fio, role: res.role, status: true, username: res.username };
      localStorage.setItem('mvp_user', JSON.stringify(u));
      dispatch(setCredentials({ token: res.token, user: u }));
      setToken(res.token);
      setUser(u);
      setShowLogin(false);
      toast.success(`Добро пожаловать, ${res.fio}!`);
    } catch (e: unknown) { toast.error(apiMessage(e, 'Неверный логин или пароль')); }
  };

  const switchAccount = () => {
    setToken(null);
    setUser(null);
    setDone(null);
    setShowLogin(true);
    setLoginForm({ username:'', password:'' });
  };

  if (done) return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.doneIcon}>{done === 'in' ? '✅' : '👋'}</div>
        <h1 className={styles.doneTitle}>{done === 'in' ? 'Вход зафиксирован' : 'Выход зафиксирован'}</h1>
        <p className={styles.doneSub}>{place}</p>
        <p className={styles.doneUser}>{user?.fio}</p>
        <p className={styles.doneTime}>{new Date().toLocaleTimeString('ru-RU')}</p>
        <div className={styles.doneActions}>
          <button className={styles.btn} onClick={() => setDone(null)}>Ещё одна отметка</button>
          <button className={styles.btnSecondary} onClick={switchAccount}>Сменить аккаунт</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>CC</div>
        <h1 className={styles.place}>{place}</h1>
        <p className={styles.sub}>Колл-центр · Отметка присутствия</p>

        {isLoggedIn && !showLogin ? (
          <>
            <div className={styles.userBadge}>
              <span className={styles.userAvatar}>{user.fio?.[0]}</span>
              <span className={styles.userName}>{user.fio}</span>
              <button className={styles.switchBtn} onClick={switchAccount}>Сменить</button>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.actionBtn} ${styles.actionIn}`} onClick={() => void doScan('in')} disabled={scanning}>
                {scanning ? '…' : '🟢 Вход'}
              </button>
              <button className={`${styles.actionBtn} ${styles.actionOut}`} onClick={() => void doScan('out')} disabled={scanning}>
                {scanning ? '…' : '🔴 Выход'}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.loginForm}>
            <p className={styles.loginHint}>Войдите для отметки</p>
            <input className={styles.loginInput} placeholder="Логин или ФИО"
              value={loginForm.username} onChange={e => setLoginForm(f=>({...f,username:e.target.value}))} />
            <input className={styles.loginInput} type="password" placeholder="Пароль"
              value={loginForm.password} onChange={e => setLoginForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e => { if (e.key==='Enter') void doLogin(); }} />
            <button className={styles.btn} onClick={() => void doLogin()} disabled={logging}>
              {logging ? 'Вход…' : 'Войти и отметиться'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
