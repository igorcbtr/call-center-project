import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useRegisterMutation, useLoginMutation } from '../../api/api';
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

export function RegisterPage() {
  const [form, setForm] = useState({ login: '', password: '', confirm: '' });
  const [register, { isLoading }] = useRegisterMutation();
  const [loginMut, { isLoading: logging }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.login.trim() || !form.password) { toast.error('Заполните все поля'); return; }
    if (form.password !== form.confirm) { toast.error('Пароли не совпадают'); return; }
    if (form.password.length < 6) { toast.error('Пароль минимум 6 символов'); return; }
    try {
      await register({ login: form.login.trim(), password: form.password }).unwrap();
      toast.success('Пароль установлен! Выполняем вход…');

      // Auto-login after registration
      try {
        const res = await loginMut({ username: form.login.trim(), password: form.password }).unwrap();
        const user = res.user || { id: res.id, fio: res.fio, role: res.role, status: true, username: res.username };
        dispatch(setCredentials({ token: res.token, user }));
        toast.success(`Добро пожаловать, ${user.fio}!`);
        if (res.role === 'admin') navigate('/admin/employees');
        else if (res.role === 'moderator') navigate('/mod/schedule');
        else navigate('/dashboard');
      } catch {
        // If auto-login fails, redirect to login page
        navigate('/login');
      }
    } catch (e: unknown) {
      toast.error(apiMessage(e, 'Ошибка регистрации'));
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <div className={styles.logo}>📞</div>
          <div className={styles.badge}>РЕГИСТРАЦИЯ СОТРУДНИКА</div>
          <h1 className={styles.hero}>Добро пожаловать в команду!</h1>
          <p className={styles.heroSub}>
            Если администратор уже создал ваш аккаунт — введите ваш логин или ФИО и установите пароль для входа в систему.
          </p>
          <ul className={styles.features}>
            <li>Просмотр своего графика смен</li>
            <li>Запросы на изменение расписания</li>
            <li>Уведомления о сменах</li>
            <li>Хранение рабочих документов</li>
          </ul>
        </div>
      </div>
      <div className={styles.right}>
        <form className={styles.card} onSubmit={submit}>
          <h2 className={styles.title}>Регистрация</h2>
          <p className={styles.sub}>Установите пароль для вашего аккаунта</p>

          <div className={styles.field}>
            <label className={styles.label}>Логин или ФИО</label>
            <input
              className={styles.input}
              placeholder="ivanov или Иванов Иван Иванович"
              value={form.login}
              onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
              autoComplete="username"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Пароль</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Минимум 6 символов"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Подтверждение пароля</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Повторите пароль"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <button className={styles.btn} type="submit" disabled={isLoading || logging}>
            {isLoading ? 'Сохраняем…' : logging ? 'Входим…' : 'Зарегистрироваться'}
          </button>

          <div className={styles.infoBox}>
            <p className={styles.infoText}>
              ℹ️ Ваш аккаунт должен быть предварительно создан администратором. Если вы не можете зарегистрироваться — обратитесь к администратору.
            </p>
          </div>

          <p className={styles.hint}>
            Уже есть пароль? <Link to="/login" className={styles.link}>Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
