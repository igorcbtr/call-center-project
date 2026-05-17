import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/store';
import { logout } from '../features/auth/authSlice';
import { Button } from '../components/common/Button';
import { NotificationBell } from '../components/common/NotificationBell';
import styles from './Header.module.css';
import { useAuth } from '../hooks/useAuth';

const knowledgeUrl = import.meta.env.VITE_KNOWLEDGE_URL || 'https://example.com';

const roleLabels: Record<string, string> = {
  admin: 'Администратор', moderator: 'Модератор', operator: 'Оператор', stajer: 'Стажёр', uchenik: 'Ученик',
};

export function Header() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { fio, role } = useAuth();

  const onLogout = () => {
    dispatch(logout());
    localStorage.removeItem('mvp_user');
    navigate('/login', { replace: true });
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>CC</div>
          <div>
            <p className={styles.title}>Колл-центр</p>
            <p className={styles.sub}>Управление персоналом</p>
          </div>
        </div>

        <div className={styles.actions}>
          {fio ? (
            <div className={styles.user}>
              <div className={styles.userAvatar}>{fio.charAt(0).toUpperCase()}</div>
              <div className={styles.userInfo}>
                <span className={styles.name}>{fio}</span>
                <span className={styles.role}>{roleLabels[role || ''] || role}</span>
              </div>
            </div>
          ) : null}

          <NotificationBell />

          <a className={styles.link} href={knowledgeUrl} target="_blank" rel="noreferrer">
            📚 База знаний
          </a>

          <a className={styles.link} href="http://localhost:3002/docs" target="_blank" rel="noreferrer">
            📖 Документация
          </a>

          <Button variant="secondary" onClick={onLogout}>Выход</Button>
        </div>
      </div>
    </header>
  );
}
