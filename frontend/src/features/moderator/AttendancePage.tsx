import { useEffect, useState } from 'react';
import { useWorkLogsQuery } from '../../api/api';
import styles from './AttendancePage.module.css';

const eventLabels: Record<string, string> = {
  check_in:  '✅ Вход',
  check_out: '🚪 Выход',
  qr_open:   '📱 QR открыт',
};

const eventColors: Record<string, string> = {
  check_in:  '#10b981',
  check_out: '#ef4444',
  qr_open:   '#f59e0b',
};

export function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data: logs = [], isLoading, refetch } = useWorkLogsQuery({ date });

  useEffect(() => { queueMicrotask(() => void refetch()); }, [date, refetch]);

  // Group by user
  const byUser = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    const key = log.user_fio || log.fio || `ID:${log.user_id}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const totalIn  = logs.filter(l => l.event_type === 'check_in').length;
  const totalOut = logs.filter(l => l.event_type === 'check_out').length;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Посещения</h1>
          <p className={styles.sub}>Журнал отметок сотрудников по QR-кодам</p>
        </div>
        <div className={styles.controls}>
          <input
            type="date"
            className={styles.dateInput}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <button className={styles.refreshBtn} onClick={() => void refetch()} disabled={isLoading}>
            {isLoading ? '…' : '↻ Обновить'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryNum} style={{ color: '#10b981' }}>{totalIn}</span>
          <span className={styles.summaryLabel}>Входов</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryNum} style={{ color: '#ef4444' }}>{totalOut}</span>
          <span className={styles.summaryLabel}>Выходов</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryNum} style={{ color: '#6366f1' }}>{Object.keys(byUser).length}</span>
          <span className={styles.summaryLabel}>Сотрудников</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryNum} style={{ color: '#475569' }}>{logs.length}</span>
          <span className={styles.summaryLabel}>Всего событий</span>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.empty}>Загрузка…</div>
      ) : logs.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <p className={styles.emptyText}>Нет записей за {new Date(date + 'T00:00:00').toLocaleDateString('ru-RU')}</p>
          <p className={styles.emptyHint}>Сотрудники ещё не отметились через QR-код</p>
        </div>
      ) : (
        <>
          {/* By user */}
          <div className={styles.section}>
            <h2 className={styles.secTitle}>По сотрудникам</h2>
            <div className={styles.userCards}>
              {Object.entries(byUser).map(([name, userLogs]) => {
                const lastIn  = userLogs.filter(l => l.event_type === 'check_in').at(-1);
                const lastOut = userLogs.filter(l => l.event_type === 'check_out').at(-1);
                const isPresent = lastIn && (!lastOut || new Date(lastIn.created_at) > new Date(lastOut.created_at));
                return (
                  <div key={name} className={styles.userCard}>
                    <div className={styles.userCardTop}>
                      <div className={styles.userAvatar}>{name[0]}</div>
                      <div className={styles.userInfo}>
                        <span className={styles.userName}>{name}</span>
                        {userLogs[0]?.user_role && (
                          <span className={styles.userRole}>{userLogs[0].user_role}</span>
                        )}
                      </div>
                      <span className={styles.presenceBadge} style={{
                        background: isPresent ? '#d1fae5' : '#f1f5f9',
                        color: isPresent ? '#059669' : '#64748b',
                      }}>
                        {isPresent ? '● На месте' : '○ Ушёл'}
                      </span>
                    </div>
                    <div className={styles.userEvents}>
                      {userLogs.map(log => (
                        <div key={log.id} className={styles.eventRow}>
                          <span className={styles.eventType} style={{ color: eventColors[log.event_type] || '#64748b' }}>
                            {eventLabels[log.event_type] || log.event_type}
                          </span>
                          <span className={styles.eventTime}>
                            {new Date(log.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {log.place && <span className={styles.eventPlace}>📍 {log.place}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full log table */}
          <div className={styles.section}>
            <h2 className={styles.secTitle}>Полный журнал</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Сотрудник</th>
                    <th>Событие</th>
                    <th>Место</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td className={styles.timeCell}>
                        {new Date(log.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className={styles.nameCell}>{log.user_fio || log.fio || '—'}</td>
                      <td>
                        <span style={{ color: eventColors[log.event_type] || '#64748b', fontWeight: 600 }}>
                          {eventLabels[log.event_type] || log.event_type}
                        </span>
                      </td>
                      <td className={styles.placeCell}>{log.place || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
