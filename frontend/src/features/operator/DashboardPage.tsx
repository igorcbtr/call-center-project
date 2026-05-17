import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'react-toastify';
import {
  useCreateChangeRequestMutation,
  useDeleteFreeTimeMutation,
  useFreeTimeListQuery,
  useUserScheduleMutation,
  useShiftTypesQuery,
} from '../../api/api';
import type { ShiftEntry } from '../../api/types';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import { ShiftItem } from './ShiftItem';
import { FreeTimeForm } from './FreeTimeForm';
import styles from './DashboardPage.module.css';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает', color: '#f59e0b' },
  approved: { label: 'Подтверждено', color: '#10b981' },
  confirmed: { label: 'Подтверждено', color: '#10b981' },
  declined: { label: 'Отклонено', color: '#ef4444' },
};

export function DashboardPage() {
  const { userId, fio } = useAuth();
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);

  const [loadSchedule, { isLoading }] = useUserScheduleMutation();
  const [entries, setEntries] = useState<ShiftEntry[]>([]);
  const { data: shiftTypes = [] } = useShiftTypesQuery();

  const uid = userId ?? 0;
  const { data: freeList = [], refetch: refetchFt } = useFreeTimeListQuery(uid, { skip: uid === 0 });
  const [deleteFt] = useDeleteFreeTimeMutation();
  const [createChangeRequest] = useCreateChangeRequestMutation();

  const [crModal, setCrModal] = useState<{ entry?: ShiftEntry; mode: 'edit' | 'new' } | null>(null);
  const [crComment, setCrComment] = useState('');
  const [crDate, setCrDate] = useState('');
  const [crShiftTypeId, setCrShiftTypeId] = useState('');

  const reload = useCallback(async () => {
    if (!userId) return;
    const rows = await loadSchedule({
      user_id: userId,
      start_date: format(weekStart, 'yyyy-MM-dd'),
      end_date: format(weekEnd, 'yyyy-MM-dd'),
    }).unwrap().catch(() => []);
    setEntries(rows);
  }, [loadSchedule, userId, weekStart, weekEnd]);

  useEffect(() => { void reload(); }, [reload]);

  const shiftCount = entries.length;

  const openChangeRequest = (entry?: ShiftEntry) => {
    setCrModal({ entry, mode: entry ? 'edit' : 'new' });
    setCrComment('');
    setCrDate(entry ? entry.date : format(new Date(), 'yyyy-MM-dd'));
    setCrShiftTypeId(entry ? String(entry.shift_type_id) : String(shiftTypes[0]?.id || ''));
  };

  const submitChangeRequest = async () => {
    if (!userId) return;
    try {
      await createChangeRequest({
        user_id: userId,
        shift_entry_id: crModal?.entry?.id,
        requested_date: crDate,
        requested_shift_type_id: Number(crShiftTypeId) || undefined,
        type: crModal?.mode === 'new' ? 'new' : 'edit',
        user_comment: crComment,
      }).unwrap();
      toast.success('✅ Заявка отправлена администратору');
      setCrModal(null);
    } catch { toast.error('Ошибка отправки заявки'); }
  };

  const shiftOptions = shiftTypes.map(s => ({
    value: String(s.id),
    label: `${s.name} (${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)})`,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Мой график</h1>
          <p className={styles.sub}>Добро пожаловать, <strong>{fio}</strong> 👋</p>
        </div>
        <div className={styles.weekNav}>
          <Button variant="secondary" type="button" onClick={() => setWeekAnchor(d => addDays(d, -7))}>← Пред.</Button>
          <div className={styles.weekLabel}>
            {format(weekStart, 'd MMM', { locale: ru })} – {format(weekEnd, 'd MMM yyyy', { locale: ru })}
          </div>
          <Button variant="secondary" type="button" onClick={() => setWeekAnchor(d => addDays(d, 7))}>След. →</Button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{shiftCount}</span>
          <span className={styles.statLabel}>Смен на неделе</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{entries.filter(e => e.status === 'approved' || e.status === 'confirmed').length}</span>
          <span className={styles.statLabel}>Подтверждено</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{entries.filter(e => e.status === 'pending').length}</span>
          <span className={styles.statLabel}>Ожидает</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <Button variant="secondary" type="button" onClick={() => void reload()} loading={isLoading}>Обновить</Button>
        <Button type="button" onClick={() => openChangeRequest()}>+ Запросить смену</Button>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Расписание на неделю</h2>
        {entries.length === 0 ? (
          <div className={styles.empty}>На эту неделю смен нет.</div>
        ) : (
          <div className={styles.shiftList}>
            {entries.map(e => {
              const st = statusLabels[e.status] || { label: e.status, color: '#94a3b8' };
              return (
                <div key={e.id} className={styles.shiftCard} style={{ borderLeftColor: e.color || '#6366f1' }}>
                  <div className={styles.shiftDate}>{format(new Date(e.date), 'EEEE, d MMMM', { locale: ru })}</div>
                  <div className={styles.shiftName} style={{ color: e.color || '#6366f1' }}>
                    {e.shift_name || 'Смена'}
                  </div>
                  <div className={styles.shiftTime}>
                    {e.start_time?.slice(0,5)} – {e.end_time?.slice(0,5)}
                  </div>
                  <div className={styles.shiftStatus}>
                    <span style={{ color: st.color, fontWeight: 600 }}>● {st.label}</span>
                  </div>
                  {e.comment && <div className={styles.shiftComment}>{e.comment}</div>}
                  <div className={styles.shiftActions}>
                    <Button type="button" size="sm" variant="secondary" onClick={() => openChangeRequest(e)}>
                      ✏️ Запросить изменение
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Свободное время</h2>
        {uid > 0 && <FreeTimeForm userId={uid} onCreated={() => void refetchFt()} />}
        {freeList.length > 0 ? (
          <div className={styles.ftList}>
            {freeList.map(ft => (
              <div key={ft.id} className={styles.ftCard}>
                <div className={styles.ftDate}>{ft.date}</div>
                <div className={styles.ftTime}>{ft.start_time.slice(0,5)} – {ft.end_time.slice(0,5)}</div>
                <div className={styles.ftKind}>{ft.kind}</div>
                <button
                  type="button"
                  className={styles.ftDelete}
                  onClick={() => deleteFt({ id: ft.id, userId: uid }).unwrap().then(() => refetchFt()).catch(() => toast.error('Ошибка'))}
                >×</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>Нет записей свободного времени.</div>}
      </div>

      <Modal
        open={Boolean(crModal)}
        onClose={() => setCrModal(null)}
        title={crModal?.mode === 'new' ? 'Запросить новую смену' : `Запрос изменения смены — ${crModal?.entry?.date}`}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setCrModal(null)}>Отмена</Button>
            <Button type="button" onClick={() => void submitChangeRequest()}>Отправить заявку</Button>
          </>
        }
      >
        {crModal && (
          <div className={styles.crForm}>
            <div>
              <label className={styles.crLabel}>Желаемая дата</label>
              <input type="date" className={styles.crInput} value={crDate} onChange={e => setCrDate(e.target.value)} />
            </div>
            <Select
              label="Желаемый тип смены"
              options={shiftOptions}
              value={crShiftTypeId}
              onChange={e => setCrShiftTypeId(e.target.value)}
            />
            <div>
              <label className={styles.crLabel}>Комментарий (обязательно)</label>
              <textarea
                className={styles.crTextarea}
                rows={3}
                value={crComment}
                onChange={e => setCrComment(e.target.value)}
                placeholder="Опишите причину изменения..."
              />
            </div>
            <p className={styles.crHint}>⚠️ Заявка будет отправлена администратору на рассмотрение. Вы получите уведомление о решении.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
