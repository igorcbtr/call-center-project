import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, eachDayOfInterval, endOfWeek, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'react-toastify';
import {
  useAllSchedulesMutation, useCreateShiftMutation, useDeleteShiftMutation,
  useUpdateShiftMutation, useEmployeesQuery, useShiftTypesQuery,
  useProcessChangeRequestMutation, useChangeRequestsQuery,
} from '../../api/api';
import type { ChangeRequest, ShiftEntry, User } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import styles from './ScheduleTab.module.css';

function keyCell(userId: number, date: string) { return `${userId}_${date}`; }

const roleLabels: Record<string, string> = {
  admin: 'Администратор', moderator: 'Модератор', operator: 'Оператор',
  stajer: 'Стажёр', uchenik: 'Ученик',
};

export function ScheduleTab() {
  const { data: employees = [] } = useEmployeesQuery();
  const { data: shiftTypes = [] } = useShiftTypesQuery();
  const [fetchAll, { isLoading }] = useAllSchedulesMutation();
  const [createShift] = useCreateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [updateShift] = useUpdateShiftMutation();
  const [processRequest] = useProcessChangeRequestMutation();
  const { data: crData, refetch: refetchCR } = useChangeRequestsQuery({ status: 'pending' });

  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const [entries, setEntries] = useState<ShiftEntry[]>([]);
  const [pendingCRs, setPendingCRs] = useState<ChangeRequest[]>([]);

  // Filters
  const [filterRole, setFilterRole] = useState('');
  const [filterName, setFilterName] = useState('');

  const reload = useCallback(async () => {
    const start_date = format(weekStart, 'yyyy-MM-dd');
    const end_date = format(weekEnd, 'yyyy-MM-dd');
    try {
      const res = await fetchAll({ start_date, end_date }).unwrap();
      setEntries(res.entries);
      setPendingCRs(res.changeRequests);
    } catch { toast.error('Не удалось загрузить график'); }
  }, [fetchAll, weekStart, weekEnd]);

  useEffect(() => { void reload(); }, [reload]);

  const map = useMemo(() => {
    const m = new Map<string, ShiftEntry>();
    for (const e of entries) m.set(keyCell(e.user_id, e.date), e);
    return m;
  }, [entries]);

  // Map of pending change requests by user+date
  const crMap = useMemo(() => {
    const m = new Map<string, ChangeRequest[]>();
    for (const cr of pendingCRs) {
      const date = cr.requested_date || cr.entry_date;
      if (!date) continue;
      const key = keyCell(cr.user_id, date);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(cr);
    }
    return m;
  }, [pendingCRs]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(u => {
      if (filterRole && u.role !== filterRole) return false;
      if (filterName && !u.fio.toLowerCase().includes(filterName.toLowerCase())) return false;
      return true;
    });
  }, [employees, filterRole, filterName]);

  // Shift count per user this week
  const shiftCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const e of entries) {
      counts[e.user_id] = (counts[e.user_id] || 0) + 1;
    }
    return counts;
  }, [entries]);

  // Cell modal state
  const [cellModal, setCellModal] = useState<{ user: User; date: string; existingEntry?: ShiftEntry; crs?: ChangeRequest[] } | null>(null);
  const [shiftTypeId, setShiftTypeId] = useState('');
  const [cellComment, setCellComment] = useState('');

  useEffect(() => {
    if (cellModal) {
      const existing = map.get(keyCell(cellModal.user.id, cellModal.date));
      setShiftTypeId(existing ? String(existing.shift_type_id) : String(shiftTypes[0]?.id || ''));
      setCellComment(existing?.comment || '');
    }
  }, [cellModal, shiftTypes, map]);

  // CR review modal
  const [crModal, setCrModal] = useState<ChangeRequest | null>(null);
  const [crDecision, setCrDecision] = useState<'approved' | 'rejected'>('approved');
  const [crAdminComment, setCrAdminComment] = useState('');
  const [crNewShiftTypeId, setCrNewShiftTypeId] = useState('');

  const openCell = (user: User, date: string) => {
    const entry = map.get(keyCell(user.id, date));
    const crs = crMap.get(keyCell(user.id, date));
    setCellModal({ user, date, existingEntry: entry, crs });
  };

  const assign = async () => {
    if (!cellModal) return;
    const st = Number(shiftTypeId);
    if (!st) return;
    const existing = map.get(keyCell(cellModal.user.id, cellModal.date));
    try {
      if (existing) {
        await updateShift({ entry_id: existing.id, shift_type_id: st, comment: cellComment }).unwrap();
        toast.success('Смена обновлена');
      } else {
        await createShift({ user_id: cellModal.user.id, date: cellModal.date, shift_type_id: st, comment: cellComment }).unwrap();
        toast.success('Смена назначена');
      }
      setCellModal(null);
      await reload();
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e && 'data' in e ? String((e as { data?: { message?: string } }).data?.message ?? 'Ошибка') : 'Ошибка';
      toast.error(msg);
    }
  };

  const remove = async () => {
    if (!cellModal) return;
    const ex = map.get(keyCell(cellModal.user.id, cellModal.date));
    if (!ex) return;
    try {
      await deleteShift({ entry_id: ex.id }).unwrap();
      toast.success('Смена удалена');
      setCellModal(null);
      await reload();
    } catch (e: unknown) {
      const msg = typeof e === 'object' && e && 'data' in e ? String((e as { data?: { message?: string } }).data?.message ?? 'Ошибка') : 'Ошибка';
      toast.error(msg);
    }
  };

  const handleProcessCR = async () => {
    if (!crModal) return;
    const adminStr = localStorage.getItem('mvp_user');
    const adminId = adminStr ? JSON.parse(adminStr).id : 1;
    try {
      await processRequest({
        request_id: crModal.id,
        status: crDecision,
        admin_comment: crAdminComment,
        admin_id: adminId,
        new_shift_type_id: crNewShiftTypeId ? Number(crNewShiftTypeId) : undefined,
      }).unwrap();
      toast.success(crDecision === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена');
      setCrModal(null);
      await reload();
      await refetchCR();
    } catch { toast.error('Ошибка обработки заявки'); }
  };

  const shiftOptions = shiftTypes.map(s => ({ value: String(s.id), label: `${s.name} (${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)})` }));
  const roleOptions = [
    { value: '', label: 'Все роли' },
    ...Object.entries(roleLabels).map(([v, l]) => ({ value: v, label: l })),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>График смен</h1>
          <p className={styles.sub}>Матрица сотрудников × дней. Жёлтые ячейки — ожидающие заявки на изменение.</p>
        </div>
        <div className={styles.weekNav}>
          <Button variant="secondary" type="button" onClick={() => setWeekAnchor(d => addDays(d, -7))}>← Пред.</Button>
          <div className={styles.weekLabel}>
            {format(weekStart, 'd MMM', { locale: ru })} – {format(weekEnd, 'd MMM yyyy', { locale: ru })}
          </div>
          <Button variant="secondary" type="button" onClick={() => setWeekAnchor(d => addDays(d, 7))}>След. →</Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.filterInput}
          placeholder="Поиск по имени..."
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
        />
        <select className={styles.filterSelect} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button variant="secondary" type="button" onClick={() => void reload()} loading={isLoading}>
          Обновить
        </Button>
        {pendingCRs.length > 0 && (
          <span className={styles.crBadge}>⚠️ {pendingCRs.length} заявок на изменение</span>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.stickyCol}>Сотрудник</th>
              <th className={styles.countCol}>Смен</th>
              {days.map(d => (
                <th key={d.toISOString()} className={styles.dayHead}>
                  <span className={styles.dow}>{format(d, 'EEE', { locale: ru })}</span>
                  <span className={styles.dom}>{format(d, 'd')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(u => (
              <tr key={u.id}>
                <td className={styles.stickyCol}>
                  <div className={styles.name}>{u.fio}</div>
                  <div className={styles.meta}>{roleLabels[u.role] || u.role}</div>
                </td>
                <td className={styles.countCol}>
                  <span className={styles.shiftCount}>{shiftCounts[u.id] || 0}</span>
                </td>
                {days.map(d => {
                  const ds = format(d, 'yyyy-MM-dd');
                  const e = map.get(keyCell(u.id, ds));
                  const crs = crMap.get(keyCell(u.id, ds));
                  const hasPendingCR = crs && crs.length > 0;

                  return (
                    <td key={ds} className={hasPendingCR ? styles.pendingCrCell : ''}>
                      <button
                        type="button"
                        className={styles.cell}
                        style={e?.color ? { borderColor: e.color, background: `${e.color}18` } : undefined}
                        onClick={() => openCell(u, ds)}
                        title={hasPendingCR ? `Есть заявка на изменение: ${crs[0].user_comment || ''}` : undefined}
                      >
                        {e ? (
                          <span className={styles.cellText}>{e.shift_name ?? 'Смена'}</span>
                        ) : (
                          <span className={styles.placeholder}>+</span>
                        )}
                        {hasPendingCR && <span className={styles.crDot} title="Заявка на изменение">!</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cell modal */}
      <Modal
        open={Boolean(cellModal)}
        onClose={() => setCellModal(null)}
        title={cellModal ? `${cellModal.user.fio} — ${cellModal.date}` : ''}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setCellModal(null)}>Закрыть</Button>
            {cellModal && map.get(keyCell(cellModal.user.id, cellModal.date)) && (
              <Button variant="danger" type="button" onClick={() => void remove()}>Удалить смену</Button>
            )}
            <Button type="button" onClick={() => void assign()}>Сохранить</Button>
          </>
        }
      >
        {cellModal && (
          <div className={styles.modalBody}>
            <Select label="Тип смены" options={shiftOptions} value={shiftTypeId} onChange={e => setShiftTypeId(e.target.value)} />
            <div className={styles.formGroup}>
              <label className={styles.label}>Комментарий (необязательно)</label>
              <input className={styles.input} value={cellComment} onChange={e => setCellComment(e.target.value)} placeholder="Примечание к смене..." />
            </div>
            {cellModal.crs && cellModal.crs.length > 0 && (
              <div className={styles.crAlert}>
                <strong>⚠️ Заявки на изменение ({cellModal.crs.length}):</strong>
                {cellModal.crs.map(cr => (
                  <div key={cr.id} className={styles.crItem}>
                    <span>«{cr.requested_shift_name || 'без типа'}» — {cr.user_comment || '—'}</span>
                    <Button type="button" size="sm" onClick={() => { setCrModal(cr); setCrDecision('approved'); setCrAdminComment(''); setCrNewShiftTypeId(String(cr.requested_shift_type_id || '')); }}>
                      Рассмотреть
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CR review modal */}
      <Modal
        open={Boolean(crModal)}
        onClose={() => setCrModal(null)}
        title="Рассмотрение заявки на изменение смены"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setCrModal(null)}>Отмена</Button>
            <Button variant="danger" type="button" onClick={() => { setCrDecision('rejected'); void handleProcessCR(); }}>Отклонить</Button>
            <Button type="button" onClick={() => { setCrDecision('approved'); void handleProcessCR(); }}>Одобрить</Button>
          </>
        }
      >
        {crModal && (
          <div className={styles.modalBody}>
            <div className={styles.crDetail}>
              <div><strong>Сотрудник:</strong> {crModal.user_fio} ({roleLabels[crModal.user_role || ''] || crModal.user_role})</div>
              <div><strong>Тип заявки:</strong> {crModal.type}</div>
              {crModal.entry_date && <div><strong>Текущая дата смены:</strong> {crModal.entry_date}</div>}
              {crModal.requested_date && <div><strong>Запрошенная дата:</strong> {crModal.requested_date}</div>}
              {crModal.shift_name && <div><strong>Текущая смена:</strong> <span style={{ color: crModal.shift_color }}>{crModal.shift_name}</span></div>}
              {crModal.requested_shift_name && <div><strong>Запрошенная смена:</strong> <span style={{ color: crModal.requested_shift_color }}>{crModal.requested_shift_name}</span></div>}
              <div><strong>Комментарий:</strong> {crModal.user_comment || '—'}</div>
              <div><strong>Создана:</strong> {new Date(crModal.created_at).toLocaleString('ru-RU')}</div>
            </div>
            <Select
              label="Назначить тип смены (при одобрении)"
              options={shiftOptions}
              value={crNewShiftTypeId}
              onChange={e => setCrNewShiftTypeId(e.target.value)}
            />
            <div className={styles.formGroup}>
              <label className={styles.label}>Комментарий администратора</label>
              <input className={styles.input} value={crAdminComment} onChange={e => setCrAdminComment(e.target.value)} placeholder="Ответ сотруднику..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
