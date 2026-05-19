import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfDay, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { useUserScheduleMutation, useAvailableShiftsMutation, useCreateChangeRequestMutation, useAllSchedulesMutation } from '../../api/api';
import type { ShiftEntry, ShiftType } from '../../api/types';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import styles from './DashboardPage.module.css';

const DOW = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const roleLabels: Record<string,string> = {
  operator:'Оператор', stajer:'Стажёр', uchenik:'Ученик', moderator:'Модератор', admin:'Администратор',
};
const statusColors: Record<string,string> = {
  pending:'#f59e0b', approved:'#10b981', confirmed:'#10b981', declined:'#ef4444',
};

export function DashboardPage() {
  const { userId, fio, role } = useAuth();
  const canSeeAll = role === 'admin' || role === 'moderator';

  const [month, setMonth] = useState(() => new Date());
  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd   = useMemo(() => endOfMonth(month), [month]);
  const days       = useMemo(() => eachDayOfInterval({ start:monthStart, end:monthEnd }), [monthStart, monthEnd]);

  const [loadSchedule, { isLoading }] = useUserScheduleMutation();
  const [loadAll] = useAllSchedulesMutation();
  const [loadAvailableShifts] = useAvailableShiftsMutation();
  const [myEntries, setMyEntries]   = useState<ShiftEntry[]>([]);
  const [allEntries, setAllEntries] = useState<ShiftEntry[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [createCR] = useCreateChangeRequestMutation();

  const reload = useCallback(async () => {
    if (!userId) return;
    const sd = format(monthStart,'yyyy-MM-dd'), ed = format(monthEnd,'yyyy-MM-dd');
    try {
      const rows = await loadSchedule({ user_id:userId, start_date:sd, end_date:ed }).unwrap();
      setMyEntries(rows);
    } catch { toast.error('Ошибка загрузки графика'); }
    try {
      setShiftTypes(await loadAvailableShifts({ user_id:userId }).unwrap());
    } catch { toast.error('Ошибка загрузки доступных смен'); }
    // also load all entries for day count display
    try {
      const res = await loadAll({ start_date:sd, end_date:ed }).unwrap();
      setAllEntries(res.entries);
    } catch { /* non-critical */ }
  }, [loadSchedule, loadAll, loadAvailableShifts, userId, monthStart, monthEnd]);

  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);

  const myMap = useMemo(() => {
    const m = new Map<string,ShiftEntry>();
    myEntries.forEach(e => m.set(e.date.slice(0, 10), e));
    return m;
  }, [myEntries]);

  const allByDay = useMemo(() => {
    const m = new Map<string,ShiftEntry[]>();
    allEntries.forEach(e => {
      const key = e.date.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    });
    return m;
  }, [allEntries]);

  const [dayModal, setDayModal] = useState<{ date:string; myEntry?:ShiftEntry; all:ShiftEntry[] }|null>(null);
  const [crModal, setCrModal]   = useState<{ date:string; entry?:ShiftEntry }|null>(null);
  const [crType, setCrType]     = useState('');
  const [crComment, setCrComment] = useState('');

  const openDay = (ds: string) => {
    const myEntry = myMap.get(ds);
    const all     = allByDay.get(ds)||[];
    setDayModal({ date:ds, myEntry, all });
  };

  const openCR = (date: string, entry?: ShiftEntry) => {
    setCrModal({ date, entry }); setCrType(String(shiftTypes[0]?.id||'')); setCrComment('');
  };

  const submitCR = async () => {
    if (!crModal||!userId) return;
    if (crModal.entry && !crComment.trim()) { toast.error('Напишите причину'); return; }
    if (!crType) { toast.error('Выберите тип смены'); return; }
    try {
      await createCR({ user_id:userId, shift_entry_id:crModal.entry?.id, requested_date:crModal.date, requested_shift_type_id:Number(crType)||undefined, type:crModal.entry?'edit':'new', user_comment:crComment }).unwrap();
      toast.success('✅ Заявка отправлена'); setCrModal(null);
    } catch { toast.error('Ошибка'); }
  };

  const firstDow = (getDay(monthStart)+6)%7;
  const today = startOfDay(new Date());
  const stats = { total:myEntries.length, approved:myEntries.filter(e=>['approved','confirmed'].includes(e.status)).length, pending:myEntries.filter(e=>e.status==='pending').length };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div><h1 className={styles.title}>Мой график</h1><p className={styles.sub}>Привет, <strong>{fio}</strong> 👋</p></div>
        <div className={styles.nav}>
          <Button variant="secondary" size="sm" onClick={() => setMonth(m => subMonths(m,1))}>←</Button>
          <span className={styles.monthLabel}>{format(month,'LLLL yyyy',{locale:ru})}</span>
          <Button variant="secondary" size="sm" onClick={() => setMonth(m => addMonths(m,1))}>→</Button>
          <Button variant="secondary" size="sm" onClick={() => void reload()} loading={isLoading}>↻</Button>
        </div>
      </div>

      <div className={styles.stats}>
        {[{num:stats.total,label:'Смен в месяце',color:'#6366f1'},{num:stats.approved,label:'Подтверждено',color:'#10b981'},{num:stats.pending,label:'Ожидает',color:'#f59e0b'}].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statNum} style={{color:s.color}}>{s.num}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.calendar}>
        {DOW.map(d => <div key={d} className={styles.dowHeader}>{d}</div>)}
        {Array.from({length:firstDow}).map((_,i) => <div key={`e${i}`} />)}
        {days.map(d => {
          const ds = format(d,'yyyy-MM-dd');
          const myEntry = myMap.get(ds);
          const dayAll  = allByDay.get(ds)||[];
          const count   = dayAll.length;
          const isToday = ds===format(new Date(),'yyyy-MM-dd');
          const isPast = isBefore(startOfDay(d), today);
          const st      = myEntry ? statusColors[myEntry.status]||'#6366f1' : null;
          const shiftColor = myEntry?.color || '#6366f1';
          const start = myEntry ? (myEntry.is_free ? myEntry.custom_start?.slice(0,5) : myEntry.start_time?.slice(0,5)) : null;
          const end   = myEntry ? (myEntry.is_free ? myEntry.custom_end?.slice(0,5)   : myEntry.end_time?.slice(0,5))   : null;
          return (
            <button key={ds} type="button"
              className={[styles.dayCell, myEntry?styles.dayCellFilled:'', isToday?styles.today:'', isPast?styles.pastDay:''].join(' ')}
              onClick={() => { if (!isPast) openDay(ds); }}
              disabled={isPast}
              aria-disabled={isPast}
            >
              <span className={styles.dayNum}>{format(d,'d')}</span>
              {myEntry ? (
                <div className={styles.cellShiftBlock} style={{ borderLeftColor: shiftColor }}>
                  <span className={styles.cellShiftName} style={{ color: shiftColor }}>{myEntry.shift_name}</span>
                  {(start || end) && (
                    <span className={styles.cellShiftTime}>{start}–{end}</span>
                  )}
                  {st && <span className={styles.cellStatusDot} style={{ color: st }}>●</span>}
                </div>
              ) : (
                <>
                  {count > 0 && <span className={styles.coworkerCount}>{count} чел.</span>}
                  {count === 0 && <span className={styles.addHint}>+</span>}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Day modal */}
      <Modal open={Boolean(dayModal)} onClose={() => setDayModal(null)}
        title={dayModal ? format(new Date(dayModal.date+'T00:00:00'),'d MMMM yyyy',{locale:ru}) : ''}
        footer={<>
          <Button variant="secondary" onClick={() => setDayModal(null)}>Закрыть</Button>
          <Button onClick={() => { if(dayModal){ setDayModal(null); openCR(dayModal.date, dayModal.myEntry); }}}>
            {dayModal?.myEntry ? '✏️ Запросить изменение' : '+ Запросить смену'}
          </Button>
        </>}
      >
        {dayModal && (
          <div className={styles.dayBody}>
            {dayModal.myEntry ? (
              <div className={styles.myShift} style={{borderLeftColor:dayModal.myEntry.color||'#6366f1'}}>
                <div className={styles.myShiftLabel}>Ваша смена</div>
                <div className={styles.myShiftName} style={{color:dayModal.myEntry.color||'#6366f1'}}>{dayModal.myEntry.shift_name}</div>
                <div className={styles.myShiftTime}>
                  {dayModal.myEntry.is_free
                    ? `${dayModal.myEntry.custom_start?.slice(0,5)||'?'} – ${dayModal.myEntry.custom_end?.slice(0,5)||'?'}`
                    : `${dayModal.myEntry.start_time?.slice(0,5)||''} – ${dayModal.myEntry.end_time?.slice(0,5)||''}`}
                </div>
                <span style={{color:statusColors[dayModal.myEntry.status]||'#94a3b8',fontSize:13}}>
                  ● {dayModal.myEntry.status}
                </span>
              </div>
            ) : <p className={styles.noEntry}>У вас нет смены в этот день</p>}

            {dayModal.all.length > 0 && (
              <div className={styles.coworkers}>
                <div className={styles.coworkersTitle}>Коллеги в этот день ({dayModal.all.length})</div>
                {dayModal.all.map((e,i) => {
                  const isMe = e.user_id === userId;
                  return (
                    <div key={i} className={[styles.coworkerRow, isMe?styles.coworkerMe:''].join(' ')}>
                      <span className={styles.coworkerDot} style={{background:statusColors[e.status]||'#cbd5e1'}} />
                      <span className={styles.coworkerRole}>{roleLabels[e.user_role||'']||e.user_role}</span>
                      {/* Staff see role+time only, admin/mod see everything */}
                      {canSeeAll && e.fio && <span className={styles.coworkerFio}>{e.fio}</span>}
                      <span className={styles.coworkerTime}>
                        {e.is_free
                          ? `${e.custom_start?.slice(0,5)||'?'}–${e.custom_end?.slice(0,5)||'?'}`
                          : `${e.start_time?.slice(0,5)||''}–${e.end_time?.slice(0,5)||''}`}
                        {e.shift_name && <span style={{color:e.color,fontWeight:600,marginLeft:4}}>{e.shift_name}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CR modal */}
      <Modal open={Boolean(crModal)} onClose={() => setCrModal(null)}
        title={crModal?.entry ? 'Запрос изменения смены' : 'Запрос новой смены'}
        footer={<><Button variant="secondary" onClick={() => setCrModal(null)}>Отмена</Button><Button onClick={() => void submitCR()}>Отправить заявку</Button></>}
      >
        {crModal && (
          <div className={styles.crForm}>
            <div className={styles.crDate}><b>Дата:</b> {format(new Date(crModal.date+'T00:00:00'),'d MMMM yyyy',{locale:ru})}</div>
            {crModal.entry && <div className={styles.crCurrent}><b>Текущая смена:</b> {crModal.entry.shift_name}</div>}
            <div className={styles.field}>
              <label className={styles.label}>Желаемый тип смены</label>
              <select className={styles.select} value={crType} onChange={e => setCrType(e.target.value)}>
                <option value="">— без предпочтений —</option>
                {shiftTypes.map((s: ShiftType) => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_free?' (свободная)':` (${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)})`}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{crModal.entry ? 'Причина *' : 'Комментарий'}</label>
              <textarea className={styles.textarea} rows={3} value={crComment} onChange={e => setCrComment(e.target.value)} placeholder={crModal.entry ? 'Опишите причину изменения…' : 'Комментарий необязателен'} />
            </div>
            <div className={styles.crNote}>⚠️ Заявка будет рассмотрена администратором. Вы получите уведомление о решении.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
