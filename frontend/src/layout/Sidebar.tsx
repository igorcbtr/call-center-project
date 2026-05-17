import { NavLink } from 'react-router-dom';
import { useChangeRequestsQuery } from '../api/api';
import { useAuth } from '../hooks/useAuth';
import styles from './Sidebar.module.css';

const adminItems = [
  { to: '/admin/employees', label: 'Сотрудники', icon: '👥' },
  { to: '/admin/schedule', label: 'График', icon: '📅' },
  { to: '/admin/requests', label: 'Заявки', icon: '📋' },
  { to: '/admin/limits', label: 'Лимиты', icon: '⚖️' },
  { to: '/admin/stats', label: 'Статистика', icon: '📊' },
];

const staffItems = [
  { to: '/dashboard', label: 'Мой график', icon: '📅' },
];

export function Sidebar() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const items = isAdmin ? adminItems : staffItems;
  const { data: crData } = useChangeRequestsQuery({ status: 'pending' }, { skip: !isAdmin });
  const pendingCount = crData?.length || 0;

  return (
    <aside className={styles.aside} aria-label="Навигация">
      <nav className={styles.nav}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}
          >
            <span className={styles.ico} aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
            {item.to === '/admin/requests' && pendingCount > 0 && (
              <span className={styles.navBadge}>{pendingCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={styles.hint}>
        <p className={styles.hintTitle}>ℹ️ Справка</p>
        <p className={styles.hintText}>
          {isAdmin
            ? 'Кликните по ячейке в графике для назначения или редактирования смены. Жёлтые ячейки — заявки на изменение.'
            : 'Запросите изменение смены через кнопку в вашем расписании.'}
        </p>
      </div>
    </aside>
  );
}
