import { useState, useRef, useEffect } from 'react';
import { useChangeRequestsQuery, useNotificationsQuery, useMarkNotificationsReadMutation } from '../../api/api';
import { useAuth } from '../../hooks/useAuth';
import styles from './NotificationBell.module.css';

const kindIcons: Record<string, string> = {
  info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌', shift: '📅',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { role } = useAuth();
  const canSeeRequests = role === 'admin' || role === 'moderator';
  const { data, refetch } = useNotificationsQuery(undefined, {
    pollingInterval: 5000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const { data: pendingRequests = [] } = useChangeRequestsQuery(
    { status: 'pending' },
    { skip: !canSeeRequests, pollingInterval: 5000, refetchOnFocus: true, refetchOnReconnect: true }
  );
  const [markRead] = useMarkNotificationsReadMutation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
  };

  const handleMarkAll = async () => {
    try {
      await markRead({}).unwrap();
      void refetch();
    } catch { /* ignore */ }
  };

  const handleMarkOne = async (id: number) => {
    try {
      await markRead({ ids: [id] }).unwrap();
      void refetch();
    } catch { /* ignore */ }
  };

  const notifications = data?.notifications || [];
  const unread = data?.unread_count || 0;
  const pendingRequestCount = pendingRequests.length;
  const badgeCount = canSeeRequests ? Math.max(unread, pendingRequestCount) : unread;
  // Show only unread in the badge; show all in dropdown but unread highlighted
  const unreadNotifs = notifications.filter(n => !n.is_read);
  const readNotifs   = notifications.filter(n => n.is_read);

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={styles.bell} onClick={handleOpen} title="Уведомления">
        🔔
        {badgeCount > 0 && <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
      </button>
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHead}>
            <span className={styles.dropTitle}>Уведомления</span>
            {unreadNotifs.length > 0 && (
              <button type="button" className={styles.markAll} onClick={() => void handleMarkAll()}>
                ✓ Прочитать все
              </button>
            )}
          </div>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>Уведомлений нет</div>
            ) : (
              <>
                {unreadNotifs.length > 0 && (
                  <div className={styles.sectionLabel}>Новые ({unreadNotifs.length})</div>
                )}
                {unreadNotifs.map(n => (
                  <div key={n.id} className={`${styles.item} ${styles.unreadItem}`}>
                    <span className={styles.icon}>{kindIcons[n.kind] || 'ℹ️'}</span>
                    <div className={styles.content}>
                      <div className={styles.itemTitle}>{n.title}</div>
                      {n.body && <div className={styles.itemBody}>{n.body}</div>}
                      <div className={styles.itemTime}>{new Date(n.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                    <button
                      type="button"
                      className={styles.readBtn}
                      onClick={() => void handleMarkOne(n.id)}
                      title="Отметить прочитанным"
                    >✓</button>
                  </div>
                ))}
                {readNotifs.length > 0 && unreadNotifs.length > 0 && (
                  <div className={styles.sectionLabel}>Прочитанные</div>
                )}
                {readNotifs.slice(0, 10).map(n => (
                  <div key={n.id} className={styles.item}>
                    <span className={styles.icon}>{kindIcons[n.kind] || 'ℹ️'}</span>
                    <div className={styles.content}>
                      <div className={styles.itemTitle}>{n.title}</div>
                      {n.body && <div className={styles.itemBody}>{n.body}</div>}
                      <div className={styles.itemTime}>{new Date(n.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
