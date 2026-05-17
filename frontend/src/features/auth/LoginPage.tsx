import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useLoginMutation } from '../../api/api';
import { useAppDispatch } from '../../store/store';
import { setCredentials } from './authSlice';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import styles from './LoginPage.module.css';

const schema = z.object({
  login: z.string().min(1, 'Введите пользователя'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, role } = useAuth();
  const [login, { isLoading }] = useLoginMutation();

  if (isAuthenticated) {
    return <Navigate to={role === 'admin' ? '/admin/employees' : '/dashboard'} replace />;
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await login(values).unwrap();

      dispatch(
        setCredentials({
          token: res.token,
          role: res.role,
          id: res.id,
          fio: res.fio,
          username: res.username,
        })
      );

      toast.success('Успешная авторизация');

      if (res.role === 'admin') navigate('/admin/employees', { replace: true });
      else navigate('/dashboard', { replace: true });
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Ошибка авторизации')
          : 'Ошибка авторизации';

      toast.error(msg);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.kicker}>MVP презентация</p>

            <h1 className={styles.heroTitle}>
              Полный контроль над расписанием команды
            </h1>

            <p className={styles.heroLead}>
              Современная панель для администраторов и быстрый self-service для операторов —
              графики, доступность и лимиты в одном месте.
            </p>

            <ul className={styles.list}>
              <li>Недельные графики и подтверждение смен</li>
              <li>Доступность и простые запросы на изменения</li>
              <li>Роли и базовая статистика</li>
            </ul>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Авторизация</h2>

            <p className={styles.formHint}>
              Демо-аккаунт: admin / admin123 или operator / op123
            </p>

            <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
              <Input
                label="Пользователь"
                autoComplete="username"
                error={errors.login?.message}
                {...register('login')}
              />

              <Input
                label="Пароль"
                type="password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />

              <Button type="submit" className={styles.submit} loading={isLoading}>
                Войти
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}