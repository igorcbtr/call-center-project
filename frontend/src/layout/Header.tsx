import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/store';
import { logout } from '../features/auth/authSlice';
import { NotificationBell } from '../components/common/NotificationBell';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import styles from './Header.module.css';

export function Header() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { fio } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const onLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const rawKnowledgeUrl = import.meta.env.VITE_KNOWLEDGE_URL as string | undefined;
  const knowledgeUrl = rawKnowledgeUrl && !rawKnowledgeUrl.includes('your-knowledge-base-url.com')
    ? rawKnowledgeUrl
    : undefined;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
  const docsPath = apiUrl.replace('/api', '/docs');

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>📞</div>
          <div>
            <p className={styles.brandName}>Колл-центр</p>
            <p className={styles.brandSub}>Управление персоналом</p>
          </div>
        </div>

        {/* Desktop actions */}
        <div className={styles.actions}>
          <a
            className={styles.docsLink}
            href={docsPath}
            target="_blank"
            rel="noreferrer"
            title="Открыть документацию"
          >
            📚 Документация
          </a>
          {knowledgeUrl && (
            <a
              className={styles.knowledgeLink}
              href={knowledgeUrl}
              target="_blank"
              rel="noreferrer"
              title="База знаний"
            >
              💡 База знаний
            </a>
          )}
          <NotificationBell />
          <span className={styles.userInfo}>
            <span className={styles.userFio}>{fio}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={onLogout}>Выход</Button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Меню"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          <a
            className={styles.mobileLink}
            href={docsPath}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            📚 Документация
          </a>
          {knowledgeUrl && (
            <a
              className={styles.mobileLink}
              href={knowledgeUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              💡 База знаний
            </a>
          )}
          <div className={styles.mobileSep} />
          <span className={styles.mobileFio}>{fio}</span>
          <button type="button" className={styles.mobileLogout} onClick={onLogout}>
            Выйти из системы
          </button>
        </div>
      )}
    </header>
  );
}
