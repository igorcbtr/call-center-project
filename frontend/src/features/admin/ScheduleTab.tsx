import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfDay, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'react-toastify';
import {
  useAllSchedulesMutation, useCreateShiftMutation, useDeleteShiftMutation,
  useUpdateShiftMutation, useEmployeesQuery, useShiftTypesQuery,
  useProcessChangeRequestMutation, useChangeRequestsQuery,
} from '../../api/api';
import type { ChangeRequest, ShiftEntry, ShiftType, User } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import styles from './ScheduleTab.module.css';

const DOW = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const roleLabels: Record<string,string> = {
  admin:'Администратор', moderator:'Модератор', operator:'Оператор', stajer:'Стажёр', uchenik:'Ученик',
};
const statusColors: Record<string,string> = {
  pending:'#f59e0b', approved:'#10b981', confirmed:'#10b981', declined:'#ef4444',
};

export function ScheduleTab() {
  const { data: allEmployees = [] } = useEmployeesQuery();
  const { data: shiftTypes = [] } = useShiftTypesQuery();
  const [fetchAll, { isLoading }] = useAllSchedulesMutation();
  const [createShift] = useCreateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [updateShift] = useUpdateShiftMutation();
  const [processRequest] = useProcessChangeRequestMutation();
  const { data: crData, refetch: refetchCR } = useChangeRequestsQuery({ status:'pending' });

  const [month, setMonth] = useState(() => new Date());
  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd   = useMemo(() => endOfMonth(month), [month]);
  const days       = useMemo(() => eachDayOfInterval({ start:monthStart, end:monthEnd }), [monthStart, monthEnd]);

  const [entries, setEntries]       = useState<ShiftEntry[]>([]);
  const [pendingCRs, setPendingCRs] = useState<ChangeRequest[]>([]);
  const [filterRole, setFilterRole] = useState('');
  const [filterName, setFilterName] = useState('');

  const employees = useMemo(() =>
    allEmployees.filter(u => {
      if (filterRole && u.role !== filterRole) return false;
      if (filterName && !u.fio.toLowerCase().includes(filterName.toLowerCase())) return false;
      return true;
    }), [allEmployees, filterRole, filterName]);

  const reload = useCallback(async () => {
    try {
      console.log('🔄 Reloading schedule for:', format(monthStart,'yyyy-MM-dd'), 'to', format(monthEnd,'yyyy-MM-dd'));
      const res = await fetchAll({ start_date: format(monthStart,'yyyy-MM-dd'), end_date: format(monthEnd,'yyyy-MM-dd') }).unwrap();
      console.log('✅ Loaded entries:', res.entries.length, 'change requests:', res.changeRequests.length);
      console.log('📋 Entries sample:', res.entries.slice(0, 3));
      setEntries(res.entries);
      setPendingCRs(res.changeRequests);
    } catch (err) { 
      console.error('❌ Failed to load schedule:', err);
      toast.error('Не удалось загрузить график'); 
    }
  }, [fetchAll, monthStart, monthEnd]);

  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);

  const entryMap = useMemo(() => {
    const m = new Map<string, ShiftEntry[]>();
    entries.forEach(e => {
      // Normalize date: take only YYYY-MM-DD part regardless of timezone
      const key = typeof e.date === 'string' ? e.date.slice(0, 10) : e.date;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    });
    console.log('📅 EntryMap:', m.size, 'days,', entries.length, 'total entries');
    if (entries.length > 0) {
      console.log('📋 Sample entry:', entries[0]);
    }
    return m;
  }, [entries]);

  const crMap = useMemo(() => {
    const m = new Map<string, ChangeRequest[]>();
    pendingCRs.forEach(cr => {
      const date = cr.requested_date || cr.entry_date;
      if (!date) return;
      if (!m.has(date)) m.set(date, []);
      m.get(date)!.push(cr);
    });
    return m;
  }, [pendingCRs]);

  // Day modal
  const [dayDate, setDayDate] = useState<string|null>(null);
  const dayEntries = dayDate ? (entryMap.get(dayDate)||[]) : [];
  const dayCRs     = dayDate ? (crMap.get(dayDate)||[]) : [];

  // Shift modal
  const [shiftModal, setShiftModal] = useState<{ date:string; user?:User; entry?:ShiftEntry }|null>(null);
  const [selUser, setSelUser]       = useState('');
  const [selType, setSelType]       = useState('');
  const [shiftComment, setShiftComment] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');

  const selShiftType = shiftTypes.find((s: ShiftType) => String(s.id) === selType);

  const openShiftModal = (date: string, user?: User, entry?: ShiftEntry) => {
    setShiftModal({ date, user, entry });
    setSelUser(user ? String(user.id) : '');
    setSelType(entry ? String(entry.shift_type_id) : String(shiftTypes[0]?.id||''));
    setShiftComment(entry?.comment||'');
    setCustomStart(entry?.custom_start?.slice(0,5)||'');
    setCustomEnd(entry?.custom_end?.slice(0,5)||'');
  };

  const saveShift = async () => {
    if (!shiftModal) return;
    const uid = Number(selUser); const stid = Number(selType);
    if (!uid||!stid) { toast.error('Выберите сотрудника и тип смены'); return; }
    if (selShiftType?.is_free && (!customStart||!customEnd)) { toast.error('Укажите время начала и конца'); return; }
    
    // Past dates are allowed for corrections and late approvals
    
    try {
      if (shiftModal.entry) {
        await updateShift({ entry_id:shiftModal.entry.id, shift_type_id:stid, comment:shiftComment, custom_start:customStart||undefined, custom_end:customEnd||undefined }).unwrap();
        toast.success('Смена обновлена');
      } else {
        await createShift({ user_id:uid, date:shiftModal.date, shift_type_id:stid, comment:shiftComment, custom_start:customStart||undefined, custom_end:customEnd||undefined }).unwrap();
        toast.success('Смена добавлена');
      }
      setShiftModal(null); 
      setDayDate(null);
      // Force reload to get updated data with JOIN
      console.log('💾 Shift saved, reloading...');
      await reload();
      console.log('✅ Reload complete');
    } catch(e: unknown) { 
      console.error('❌ Save error:', e);
      toast.error(e && typeof e === 'object' && 'data' in e && e.data && typeof e.data === 'object' && 'message' in e.data ? String(e.data.message) : 'Ошибка'); 
    }
  };

  const removeShift = async () => {
    if (!shiftModal?.entry) return;
    try { await deleteShift({ entry_id:shiftModal.entry.id }).unwrap(); toast.success('Удалена'); setShiftModal(null); setDayDate(null); await reload(); }
    catch { toast.error('Ошибка'); }
  };

  // CR modal
  const [crModal, setCrModal] = useState<ChangeRequest|null>(null);
  const [crComment, setCrComment] = useState('');
  const [crShiftType, setCrShiftType] = useState('');

  const processCR = async (decision: 'approved'|'rejected') => {
    if (!crModal) return;
    const adminStr = localStorage.getItem('mvp_user');
    const adminId  = adminStr ? JSON.parse(adminStr).id : 1;
    try {
      await processRequest({ request_id:crModal.id, status:decision, admin_comment:crComment, admin_id:adminId, new_shift_type_id:crShiftType?Number(crShiftType):undefined }).unwrap();
      toast.success(decision==='approved'?'Одобрено':'Отклонено');
      setCrModal(null); await reload(); await refetchCR();
    } catch { toast.error('Ошибка'); }
  };

  const firstDow = (getDay(monthStart)+6)%7;
  const today = startOfDay(new Date());
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>График смен</h1>
          <p className={styles.sub}>Нажмите на день — увидите все смены и сможете управлять ими.</p>
        </div>
        <div className={styles.monthNav}>
          <Button variant="secondary" size="sm" onClick={() => setMonth(m => subMonths(m,1))}>←</Button>
          <span className={styles.monthLabel}>{format(month,'LLLL yyyy',{locale:ru})}</span>
          <Button variant="secondary" size="sm" onClick={() => setMonth(m => addMonths(m,1))}>→</Button>
          <Button variant="secondary" size="sm" onClick={() => void reload()} loading={isLoading}>↻</Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Поиск по имени…" value={filterName} onChange={e => setFilterName(e.target.value)} />
        <select className={styles.sel} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Все роли</option>
          {Object.entries(roleLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(crData?.length||0) > 0 && <span className={styles.crBadge}>⚠️ {crData!.length} заявок</span>}
        {entries.length > 0 && <span className={styles.infoBadge}>📊 Всего смен: {entries.length}</span>}
      </div>

      <div className={styles.calendar}>
        {DOW.map(d => <div key={d} className={styles.dowHeader}>{d}</div>)}
        {Array.from({length:firstDow}).map((_,i) => <div key={`e${i}`} />)}
        {days.map(d => {
          const ds = format(d,'yyyy-MM-dd');
          const dayEnts = entryMap.get(ds)||[];
          const dayCrList = crMap.get(ds)||[];
          const hasCR = dayCrList.length > 0;
          const isToday = ds === format(new Date(),'yyyy-MM-dd');
          const isPast = isBefore(startOfDay(d), today);
          
          // Filter by current employee filter
          const visibleEnts = dayEnts.filter(e => {
            if (filterRole && e.user_role !== filterRole) return false;
            if (filterName && !(e.fio || '').toLowerCase().includes(filterName.toLowerCase())) return false;
            return true;
          });
          
          return (
            <button key={ds} type="button"
              className={[
                styles.dayCell,
                hasCR ? styles.dayCellCR : '',
                isToday ? styles.today : '',
                isPast ? styles.pastDay : '',
                visibleEnts.length > 0 ? styles.dayCellFilled : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { if (!isPast) setDayDate(ds); }}
              disabled={isPast}
              aria-disabled={isPast}
            >
              <span className={styles.dayNum}>{format(d,'d')}</span>
              {hasCR && <span className={styles.dayAlert}>!</span>}

              {/* Show shift chips in cell */}
              <div className={styles.cellShifts}>
                {visibleEnts.slice(0, 3).map((e, i) => {
                  const name = e.fio || '?';
                  const color = e.color || '#6366f1';
                  const start = e.is_free ? e.custom_start?.slice(0,5) : e.start_time?.slice(0,5);
                  const end   = e.is_free ? e.custom_end?.slice(0,5)   : e.end_time?.slice(0,5);
                  const roleLabel = roleLabels[e.user_role || ''] || e.user_role || '';
                  return (
                    <div
                      key={i}
                      className={styles.cellShiftChip}
                      style={{ borderLeftColor: color, background: `${color}12` }}
                    >
                      <div className={styles.cellShiftInfo}>
                        <span className={styles.cellShiftName} style={{ color }}>
                          {name}
                        </span>
                        {roleLabel && (
                          <span className={styles.cellShiftRole}>{roleLabel}</span>
                        )}
                      </div>
                      {(start && end) && (
                        <span className={styles.cellShiftTime}>{start}–{end}</span>
                      )}
                    </div>
                  );
                })}
                {visibleEnts.length > 3 && (
                  <div className={styles.cellMore}>+{visibleEnts.length - 3} ещё</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day modal */}
      <Modal open={Boolean(dayDate)} onClose={() => setDayDate(null)}
        title={dayDate ? format(new Date(dayDate+'T00:00:00'),'d MMMM yyyy (EEEE)',{locale:ru}) : ''}
        footer={<>
          <Button variant="secondary" onClick={() => setDayDate(null)}>Закрыть</Button>
          {dayDate && !isBefore(startOfDay(new Date(dayDate+'T00:00:00')), today) && (
            <Button onClick={() => { setDayDate(null); openShiftModal(dayDate); }}>+ Добавить смену</Button>
          )}
        </>}
      >
        <div className={styles.dayBody}>
          {dayDate && isBefore(startOfDay(new Date(dayDate+'T00:00:00')), today) && (
            <div className={styles.pastWarning}>Прошедшая дата заблокирована для добавления смен.</div>
          )}
          {dayEntries.length===0 && dayCRs.length===0 && (
            <p className={styles.empty}>
              Смен нет.{dayDate && !isBefore(startOfDay(new Date(dayDate+'T00:00:00')), today) ? ' Нажмите «+ Добавить смену».' : ''}
            </p>
          )}
          {dayEntries.map(e => {
            const emp = allEmployees.find(u => u.id===e.user_id);
            const st  = statusColors[e.status]||'#94a3b8';
            const start = e.is_free ? e.custom_start?.slice(0,5) : e.start_time?.slice(0,5);
            const end   = e.is_free ? e.custom_end?.slice(0,5)   : e.end_time?.slice(0,5);
            return (
              <div key={e.id} className={styles.dayRow}>
                <div className={styles.dayRowUser}>
                  <span className={styles.userAvatar}>{(e.fio||emp?.fio||'?')[0]}</span>
                  <div>
                    <div className={styles.userName}>{e.fio||emp?.fio}</div>
                    <div className={styles.userRole}>{roleLabels[e.user_role||emp?.role||'']}</div>
                  </div>
                </div>
                <div className={styles.entryChip} style={{ background:`${e.color||'#6366f1'}18`, borderColor:e.color||'#e2e8f0' }}>
                  <span style={{ color:e.color||'#6366f1', fontWeight:700 }}>{e.shift_name}</span>
                  {(start||end) && <span className={styles.entryTime}>{start}–{end}</span>}
                  <span style={{ color:st, fontSize:12 }}>● {e.status}</span>
                </div>
                <div className={styles.dayRowActions}>
                  <Button size="sm" variant="secondary" onClick={() => { setDayDate(null); openShiftModal(dayDate!, emp, e); }}>✏️</Button>
                </div>
              </div>
            );
          })}
          {dayCRs.length > 0 && (
            <div className={styles.crSection}>
              <div className={styles.crSectionTitle}>⚠️ Заявки на изменение ({dayCRs.length})</div>
              {dayCRs.map(cr => (
                <div key={cr.id} className={styles.crRow}>
                  <span className={styles.crUser}>{cr.user_fio}</span>
                  <span className={styles.crType}>{cr.requested_shift_name||'—'}</span>
                  <span className={styles.crComment}>{cr.user_comment||''}</span>
                  <Button size="sm" onClick={() => { setCrModal(cr); setCrComment(''); setCrShiftType(String(cr.requested_shift_type_id||'')); }}>Рассмотреть</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Shift modal */}
      <Modal open={Boolean(shiftModal)} onClose={() => setShiftModal(null)}
        title={shiftModal?.entry ? `Редактировать смену — ${shiftModal.date}` : `Добавить смену — ${shiftModal?.date}`}
        footer={<>
          <Button variant="secondary" onClick={() => setShiftModal(null)}>Отмена</Button>
          {shiftModal?.entry && <Button variant="danger" onClick={() => void removeShift()}>Удалить</Button>}
          <Button onClick={() => void saveShift()}>Сохранить</Button>
        </>}
      >
        {shiftModal && (
          <div className={styles.shiftForm}>
            {!shiftModal.user && (
              <div className={styles.field}>
                <label className={styles.label}>Сотрудник</label>
                <select className={styles.select} value={selUser} onChange={e => setSelUser(e.target.value)}>
                  <option value="">— выберите —</option>
                  {employees.map(u => <option key={u.id} value={u.id}>{u.fio} ({roleLabels[u.role]})</option>)}
                </select>
              </div>
            )}
            {shiftModal.user && <p className={styles.fixedUser}><strong>{shiftModal.user.fio}</strong></p>}
            <div className={styles.field}>
              <label className={styles.label}>Тип смены</label>
              <select className={styles.select} value={selType} onChange={e => setSelType(e.target.value)}>
                {shiftTypes.map((s: ShiftType) => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_free?' (свободная)':` (${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)})`}</option>
                ))}
              </select>
            </div>
            {selShiftType?.is_free && (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className={styles.field}>
                  <label className={styles.label}>Начало</label>
                  <input type="time" className={styles.input} value={customStart} onChange={e => setCustomStart(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Конец</label>
                  <input type="time" className={styles.input} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label}>Комментарий</label>
              <input className={styles.input} value={shiftComment} onChange={e => setShiftComment(e.target.value)} placeholder="Необязательно" />
            </div>
          </div>
        )}
      </Modal>

      {/* CR modal */}
      <Modal open={Boolean(crModal)} onClose={() => setCrModal(null)} title="Заявка на изменение"
        footer={<>
          <Button variant="secondary" onClick={() => setCrModal(null)}>Отмена</Button>
          <Button variant="danger" onClick={() => void processCR('rejected')}>Отклонить</Button>
          <Button onClick={() => void processCR('approved')}>Одобрить</Button>
        </>}
      >
        {crModal && (
          <div className={styles.shiftForm}>
            <div className={styles.crInfo}>
              <div><b>Сотрудник:</b> {crModal.user_fio}</div>
              {crModal.entry_date && <div><b>Текущая дата:</b> {crModal.entry_date}</div>}
              {crModal.requested_date && <div><b>Запрашивает:</b> {crModal.requested_date}</div>}
              {crModal.shift_name && <div><b>Сейчас:</b> {crModal.shift_name}</div>}
              {crModal.requested_shift_name && <div><b>Хочет:</b> {crModal.requested_shift_name}</div>}
              <div><b>Комментарий:</b> {crModal.user_comment||'—'}</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Назначить тип (при одобрении)</label>
              <select className={styles.select} value={crShiftType} onChange={e => setCrShiftType(e.target.value)}>
                <option value="">— без изменения —</option>
                {shiftTypes.map((s: ShiftType) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ответ администратора</label>
              <input className={styles.input} value={crComment} onChange={e => setCrComment(e.target.value)} placeholder="Комментарий сотруднику…" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
