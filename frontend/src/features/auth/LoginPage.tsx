import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../api/api';
import { useAppDispatch } from '../../store/store';
import { setCredentials } from './authSlice';
import { toast } from 'react-toastify';
import styles from './LoginPage.module.css';

function apiMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'message' in data) return String(data.message);
  }
  return fallback;
}

export function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Введите логин и пароль'); return; }
    try {
      // Send both 'username' and 'login' to support both field names
      const res = await login({ username: form.username, password: form.password }).unwrap();
      const user = res.user || { id: res.id, fio: res.fio, role: res.role, status: true, username: res.username };
      dispatch(setCredentials({ token: res.token, user }));
      toast.success(`Добро пожаловать, ${user.fio}!`);
      if (res.role === 'admin') navigate('/admin/employees');
      else if (res.role === 'moderator') navigate('/mod/schedule');
      else navigate('/dashboard');
    } catch (e: unknown) {
      toast.error(apiMessage(e, 'Ошибка входа'));
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <div className={styles.logo}>CC</div>
          <div className={styles.badge}>МВП ПРЕЗЕНТАЦИЯ</div>
          <h1 className={styles.hero}>Полный контроль над расписанием команды</h1>
          <p className={styles.heroSub}>Современная панель для администраторов и быстрый self-service для сотрудников — графики и заявки в одном месте.</p>
          <ul className={styles.features}>
            <li>Недельные и месячные графики</li>
            <li>Заявки на изменение смен</li>
            <li>QR-коды для отметки присутствия</li>
            <li>Роли: Администратор, Модератор, Оператор</li>
          </ul>
        </div>
      </div>
      <div className={styles.right}>
        <form className={styles.card} onSubmit={submit}>
          <h2 className={styles.title}>Авторизация</h2>
          <p className={styles.sub}>Вход по логину или ФИО</p>
          <div className={styles.field}>
            <label className={styles.label}>Пользователь</label>
            <input className={styles.input} autoComplete="username" placeholder="Логин или ФИО"
              value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input className={styles.input} type="password" autoComplete="current-password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <button className={styles.btn} type="submit" disabled={isLoading}>
            {isLoading ? 'Вход…' : 'Войти'}
          </button>
          <p className={styles.hint}>Нет пароля? Обратитесь к администратору или <a href="/register" className={styles.link}>зарегистрируйтесь</a>.</p>
        </form>
      </div>
    </div>
  );
}
