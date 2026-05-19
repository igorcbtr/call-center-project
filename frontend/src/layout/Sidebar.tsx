import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useChangeRequestsQuery } from '../api/api';
import { useAuth } from '../hooks/useAuth';
import styles from './Sidebar.module.css';

type NavItem = { to: string; label: string; icon: string; badge?: number };

const roleLabels: Record<string,string> = {
  admin:'Администратор', moderator:'Модератор', operator:'Оператор', stajer:'Стажёр', uchenik:'Ученик',
};

export function Sidebar() {
  const { role, fio } = useAuth();
  const location = useLocation();
  const isAdmin = role === 'admin';
  const isMod   = role === 'moderator';
  const [collapsed, setCollapsed] = useState(false);

  const { data: crData } = useChangeRequestsQuery(
    { status:'pending' },
    { skip: !isAdmin && !isMod, pollingInterval: 5000, refetchOnFocus: true, refetchOnReconnect: true }
  );
  const pendingCount = crData?.length || 0;

  const adminItems: NavItem[] = [
    { to:'/admin/employees', label:'Сотрудники',    icon:'👥' },
    { to:'/admin/schedule',  label:'График',         icon:'📅' },
    { to:'/admin/requests',  label:'Заявки',         icon:'📋', badge: pendingCount },
    { to:'/admin/limits',    label:'Лимиты / Типы',  icon:'⚖️' },
    { to:'/admin/qr',        label:'QR-коды',        icon:'📱' },
    { to:'/admin/stats',     label:'Статистика',     icon:'📊' },
    { to:'/admin/attendance', label:'Посещения',      icon:'🕐' },
    { to:'/admin/documents', label:'Документы',       icon:'📁' },
    { to:'/admin/tasks',     label:'Задания',        icon:'📝' },
  ];

  const modItems: NavItem[] = [
    { to:'/mod/schedule',   label:'График',         icon:'📅' },
    { to:'/mod/employees',  label:'Сотрудники',     icon:'👥' },
    { to:'/mod/requests',   label:'Заявки',         icon:'📋', badge: pendingCount },
    { to:'/mod/attendance', label:'Посещения',      icon:'🕐' },
    { to:'/mod/documents',  label:'Документы',      icon:'📁' },
    { to:'/mod/tasks',      label:'Задания',        icon:'📝' },
  ];

  const staffItems: NavItem[] = [
    { to:'/dashboard',  label:'Мой график',  icon:'📅' },
    { to:'/attendance', label:'Посещения',   icon:'🕐' },
    { to:'/documents',  label:'Документы',   icon:'📁' },
    { to:'/tasks',      label:'Задания',     icon:'📝' },
  ];

  const items = isAdmin ? adminItems : isMod ? modItems : staffItems;

  return (
    <aside className={[styles.aside, collapsed ? styles.collapsed : ''].join(' ')}>
      {/* Collapse toggle */}
      <button
        type="button"
        className={styles.collapseBtn}
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Развернуть' : 'Свернуть'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {/* User badge */}
      <div className={styles.userBadge}>
        <div className={styles.userAvatar}>{(fio||'?')[0]}</div>
        {!collapsed && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{fio}</span>
            <span className={styles.userRole}>{roleLabels[role||'']||role}</span>
          </div>
        )}
      </div>

      <nav className={styles.nav}>
        {items.map(item => {
          const isActive = location.pathname === item.to ||
            (item.to.includes('employees') && location.pathname.startsWith(item.to + '/'));
          return (
            <NavLink key={item.to} to={item.to} end={!item.to.includes('employees')}
              className={({ isActive: a }) => [styles.link, (a || isActive) ? styles.active : ''].join(' ')}
              title={collapsed ? item.label : undefined}
            >
              <span className={styles.ico}>{item.icon}</span>
              {!collapsed && <span className={styles.linkLabel}>{item.label}</span>}
              {!collapsed && item.badge ? <span className={styles.badge}>{item.badge > 99 ? '99+' : item.badge}</span> : null}
              {collapsed && item.badge ? <span className={styles.badgeDot} /> : null}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className={styles.hint}>
          <p className={styles.hintTitle}>ℹ️ Подсказка</p>
          <p className={styles.hintText}>
            {isAdmin
              ? 'Кликните по дню в графике. Жёлтый фон = заявка на изменение.'
              : isMod
              ? 'Вы управляете своими прикреплёнными сотрудниками.'
              : 'Нажмите на день в календаре для просмотра смены.'}
          </p>
        </div>
      )}
    </aside>
  );
}
