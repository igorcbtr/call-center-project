import { useState, useRef, useEffect } from 'react';
import { useNotificationsQuery, useMarkNotificationsReadMutation } from '../../api/api';
import styles from './NotificationBell.module.css';

const kindIcons: Record<string, string> = {
  info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌', shift: '📅',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, refetch } = useNotificationsQuery(undefined, { pollingInterval: 30000 });
  const [markRead] = useMarkNotificationsReadMutation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = async () => {
    setOpen(o => !o);
    if (!open && data?.unread_count) {
      await markRead({}).unwrap().catch(() => {});
      void refetch();
    }
  };

  const notifications = data?.notifications || [];
  const unread = data?.unread_count || 0;

  return (
    <div className={styles.wrap} ref={ref}>
      <button type="button" className={styles.bell} onClick={() => void handleOpen()} title="Уведомления">
        🔔
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropHead}>
            <span className={styles.dropTitle}>Уведомления</span>
            {notifications.length > 0 && (
              <button type="button" className={styles.markAll} onClick={() => void markRead({}).then(() => refetch())}>
                Прочитать все
              </button>
            )}
          </div>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>Уведомлений нет</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`${styles.item} ${!n.is_read ? styles.unreadItem : ''}`}>
                  <span className={styles.icon}>{kindIcons[n.kind] || 'ℹ️'}</span>
                  <div className={styles.content}>
                    <div className={styles.itemTitle}>{n.title}</div>
                    {n.body && <div className={styles.itemBody}>{n.body}</div>}
                    <div className={styles.itemTime}>{new Date(n.created_at).toLocaleString('ru-RU')}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
