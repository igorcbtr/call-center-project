import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  useShiftLimitsDataQuery, usePutShiftLimitsMutation,
  useUpsertLimitExceptionMutation, useDeleteLimitExceptionMutation,
  useEmployeesQuery, useShiftTypesQuery,
  useCreateShiftTypeMutation, useUpdateShiftTypeMutation, useDeleteShiftTypeMutation,
} from '../../api/api';
import type { ShiftLimit, ShiftLimitException, ShiftType, UserRole } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import styles from './LimitsTab.module.css';
import { useAuth } from '../../hooks/useAuth';

const roleLabels: Record<UserRole,string> = {
  admin:'Администратор', moderator:'Модератор', operator:'Оператор', stajer:'Стажёр', uchenik:'Ученик',
};
const ALL_ROLES: UserRole[] = ['admin','moderator','operator','stajer','uchenik'];
const COLORS = ['#6366f1','#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#84cc16'];

export function LimitsTab() {
  const { role: myRole } = useAuth();
  const isAdmin = myRole === 'admin';

  const { data: limData, isLoading, refetch } = useShiftLimitsDataQuery();
  const [putLimits, { isLoading: saving }] = usePutShiftLimitsMutation();
  const [upsertEx]  = useUpsertLimitExceptionMutation();
  const [deleteEx]  = useDeleteLimitExceptionMutation();
  const { data: employees = [] } = useEmployeesQuery();
  const { data: shiftTypes = [], refetch: refetchTypes } = useShiftTypesQuery();
  const [createST]  = useCreateShiftTypeMutation();
  const [updateST]  = useUpdateShiftTypeMutation();
  const [deleteST]  = useDeleteShiftTypeMutation();

  const [draftEdits, setDraftEdits] = useState<Record<string, Partial<ShiftLimit>>>({});
  const draft = useMemo(
    () => (limData?.limits || []).map(row => ({ ...row, ...(draftEdits[row.role] || {}) })),
    [limData, draftEdits]
  );

  const updateLimit = (role: UserRole, field: 'min'|'max', v: number) =>
    setDraftEdits(prev => ({
      ...prev,
      [role]: {
        ...(prev[role] || {}),
        [field === 'min' ? 'min_shifts_per_week' : 'max_shifts_per_week']: v,
      },
    }));

  const saveLimits = async () => {
    try {
      await putLimits({ limits: draft.map(r => ({ role:r.role, min_shifts_per_week:r.min_shifts_per_week, max_shifts_per_week:r.max_shifts_per_week })) }).unwrap();
      setDraftEdits({});
      toast.success('Лимиты сохранены');
    }
    catch { toast.error('Ошибка'); }
  };

  // Exception modal
  const [exModal, setExModal] = useState(false);
  const [editEx, setEditEx]   = useState<ShiftLimitException|null>(null);
  const [exForm, setExForm]   = useState({ user_id:0, min:0, max:99, note:'', extra_shift_type_ids:[] as number[] });

  const openExModal = (ex?: ShiftLimitException) => {
    if (ex) {
      setEditEx(ex);
      setExForm({ user_id:ex.user_id, min:ex.min_shifts_per_week, max:ex.max_shifts_per_week, note:ex.note||'', extra_shift_type_ids:(ex.extra_shift_types||[]).map(t=>t.id) });
    } else {
      setEditEx(null);
      setExForm({ user_id:0, min:0, max:99, note:'', extra_shift_type_ids:[] });
    }
    setExModal(true);
  };

  const saveEx = async () => {
    if (!exForm.user_id) { toast.error('Выберите сотрудника'); return; }
    try {
      await upsertEx({ user_id:exForm.user_id, min_shifts_per_week:exForm.min, max_shifts_per_week:exForm.max, note:exForm.note, extra_shift_type_ids:exForm.extra_shift_type_ids }).unwrap();
      toast.success('Исключение сохранено'); setExModal(false); void refetch();
    } catch { toast.error('Ошибка'); }
  };

  const delEx = async (ex: ShiftLimitException) => {
    if (!window.confirm(`Удалить исключение для ${ex.fio}?`)) return;
    try { await deleteEx(ex.id).unwrap(); toast.success('Удалено'); void refetch(); }
    catch { toast.error('Ошибка'); }
  };

  const toggleExType = (id: number) => setExForm(f => ({
    ...f,
    extra_shift_type_ids: f.extra_shift_type_ids.includes(id) ? f.extra_shift_type_ids.filter(x=>x!==id) : [...f.extra_shift_type_ids, id],
  }));

  // Shift type modal
  const [stModal, setStModal] = useState<{mode:'create'|'edit'; st?:ShiftType}|null>(null);
  const [stForm, setStForm]   = useState({ name:'', start_time:'09:00', end_time:'18:00', color:'#6366f1', allowed_roles:['operator','stajer','uchenik'] as string[], is_free:false });

  const openST = (st?: ShiftType) => {
    if (st) {
      setStForm({ name:st.name, start_time:st.start_time?.slice(0,5)||'09:00', end_time:st.end_time?.slice(0,5)||'18:00', color:st.color, allowed_roles:st.allowed_roles||[], is_free:st.is_free });
      setStModal({ mode:'edit', st });
    } else {
      setStForm({ name:'', start_time:'09:00', end_time:'18:00', color:'#6366f1', allowed_roles:['operator','stajer','uchenik'], is_free:false });
      setStModal({ mode:'create' });
    }
  };

  const saveST = async () => {
    if (!stForm.name) { toast.error('Введите название'); return; }
    if (!stForm.is_free && (!stForm.start_time||!stForm.end_time)) { toast.error('Укажите время'); return; }
    try {
      if (stModal?.mode==='edit' && stModal.st) await updateST({ id:stModal.st.id, ...stForm }).unwrap();
      else await createST(stForm).unwrap();
      toast.success(stModal?.mode==='edit'?'Обновлено':'Создано');
      setStModal(null); void refetchTypes();
    } catch { toast.error('Ошибка'); }
  };

  const delST = async (st: ShiftType) => {
    if (!window.confirm(`Удалить «${st.name}»?`)) return;
    try { await deleteST(st.id).unwrap(); toast.success('Удалено'); void refetchTypes(); }
    catch { toast.error('Ошибка'); }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Лимиты и типы смен</h1>

      {/* Limits — admin only */}
      {isAdmin && (
        <div className={styles.section}>
          <div className={styles.secHead}>
            <h2 className={styles.secTitle}>Лимиты смен по ролям</h2>
            <Button onClick={() => void saveLimits()} loading={saving} disabled={isLoading}>Сохранить</Button>
          </div>
          <div className={styles.limGrid}>
            {draft.map(row => (
              <div key={row.role} className={styles.limCard}>
                <div className={styles.limRole}>{roleLabels[row.role]}</div>
                {[{f:'min' as const,l:'Мин / нед'},{f:'max' as const,l:'Макс / нед'}].map(({f,l}) => (
                  <div key={f} className={styles.limRow}>
                    <label className={styles.limLabel}>{l}</label>
                    <input type="number" min={0} max={99} className={styles.limInput}
                      value={f==='min'?row.min_shifts_per_week:row.max_shifts_per_week}
                      onChange={e => updateLimit(row.role, f, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exceptions */}
      <div className={styles.section}>
        <div className={styles.secHead}>
          <h2 className={styles.secTitle}>Исключения по лимитам</h2>
          <Button onClick={() => openExModal()}>+ Добавить исключение</Button>
        </div>
        {(limData?.exceptions||[]).length===0
          ? <p className={styles.empty}>Исключений нет</p>
          : (limData?.exceptions||[]).map((ex: ShiftLimitException) => (
            <div key={ex.id} className={styles.exRow}>
              <span className={styles.exFio}>{ex.fio}</span>
              <span className={styles.exRole}>{roleLabels[ex.user_role as UserRole]||ex.user_role}</span>
              <span className={styles.exLim}>мин {ex.min_shifts_per_week} / макс {ex.max_shifts_per_week}</span>
              {(ex.extra_shift_types||[]).length > 0 && (
                <div className={styles.exTypes}>
                  {(ex.extra_shift_types||[]).map(t => <span key={t.id} className={styles.exType} style={{borderColor:t.color,color:t.color}}>{t.name}</span>)}
                </div>
              )}
              {ex.note && <span className={styles.exNote}>{ex.note}</span>}
              <div className={styles.exActions}>
                <Button size="sm" variant="secondary" onClick={() => openExModal(ex)}>Ред.</Button>
                <Button size="sm" variant="danger" onClick={() => delEx(ex)}>Удалить</Button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Shift types — admin only */}
      {isAdmin && (
        <div className={styles.section}>
          <div className={styles.secHead}>
            <h2 className={styles.secTitle}>Типы смен</h2>
            <Button onClick={() => openST()}>+ Создать тип</Button>
          </div>
          <div className={styles.stGrid}>
            {shiftTypes.map((st: ShiftType) => (
              <div key={st.id} className={styles.stCard} style={{borderLeft:`4px solid ${st.color}`}}>
                <div className={styles.stTop}>
                  <span className={styles.stDot} style={{background:st.color}} />
                  <span className={styles.stName}>{st.name}</span>
                  {st.is_free
                    ? <span className={styles.freeBadge}>Свободная</span>
                    : <span className={styles.stTime}>{st.start_time?.slice(0,5)} – {st.end_time?.slice(0,5)}</span>}
                </div>
                <div className={styles.stRoles}>
                  {(st.allowed_roles||[]).map(r => <span key={r} className={styles.stRole}>{roleLabels[r as UserRole]||r}</span>)}
                </div>
                <div className={styles.stActions}>
                  <Button size="sm" variant="secondary" onClick={() => openST(st)}>Ред.</Button>
                  <Button size="sm" variant="danger" onClick={() => delST(st)}>Удалить</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exception modal */}
      <Modal open={exModal} onClose={() => setExModal(false)} title={editEx?'Редактировать исключение':'Добавить исключение'}
        footer={<><Button variant="secondary" onClick={() => setExModal(false)}>Отмена</Button><Button onClick={() => void saveEx()}>Сохранить</Button></>}
      >
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Сотрудник</label>
            <select className={styles.input} value={exForm.user_id} onChange={e => setExForm(f=>({...f,user_id:Number(e.target.value)}))}>
              <option value={0}>— выберите —</option>
              {employees.map(u => <option key={u.id} value={u.id}>{u.fio} ({u.role})</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className={styles.field}><label className={styles.label}>Мин / нед</label>
              <input type="number" min={0} max={99} className={styles.input} value={exForm.min} onChange={e=>setExForm(f=>({...f,min:Number(e.target.value)}))} /></div>
            <div className={styles.field}><label className={styles.label}>Макс / нед</label>
              <input type="number" min={0} max={99} className={styles.input} value={exForm.max} onChange={e=>setExForm(f=>({...f,max:Number(e.target.value)}))} /></div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Дополнительные типы смен (исключения)</label>
            <div className={styles.rolesGrid}>
              {shiftTypes.map((st: ShiftType) => (
                <label key={st.id} className={styles.roleCheck}>
                  <input type="checkbox" checked={exForm.extra_shift_type_ids.includes(st.id)} onChange={() => toggleExType(st.id)} />
                  <span style={{color:st.color,fontWeight:600}}>●</span> {st.name}
                </label>
              ))}
            </div>
          </div>
          <div className={styles.field}><label className={styles.label}>Примечание</label>
            <input className={styles.input} value={exForm.note} onChange={e=>setExForm(f=>({...f,note:e.target.value}))} placeholder="Необязательно" /></div>
        </div>
      </Modal>

      {/* Shift type modal */}
      <Modal open={Boolean(stModal)} onClose={() => setStModal(null)} title={stModal?.mode==='edit'?'Редактировать тип смены':'Новый тип смены'}
        footer={<><Button variant="secondary" onClick={() => setStModal(null)}>Отмена</Button><Button onClick={() => void saveST()}>Сохранить</Button></>}
      >
        <div className={styles.form}>
          <div className={styles.field}><label className={styles.label}>Название *</label>
            <input className={styles.input} value={stForm.name} onChange={e=>setStForm(f=>({...f,name:e.target.value}))} placeholder="Утренняя смена" /></div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={stForm.is_free} onChange={e=>setStForm(f=>({...f,is_free:e.target.checked}))} />
            <span><b>Свободная смена</b> — сотрудник сам указывает время</span>
          </label>
          {!stForm.is_free && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className={styles.field}><label className={styles.label}>Начало</label>
                <input type="time" className={styles.input} value={stForm.start_time} onChange={e=>setStForm(f=>({...f,start_time:e.target.value}))} /></div>
              <div className={styles.field}><label className={styles.label}>Конец</label>
                <input type="time" className={styles.input} value={stForm.end_time} onChange={e=>setStForm(f=>({...f,end_time:e.target.value}))} /></div>
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.label}>Цвет</label>
            <div className={styles.colorRow}>
              {COLORS.map(c => (
                <button key={c} type="button" className={styles.colorDot}
                  style={{background:c, outline:stForm.color===c?`3px solid ${c}`:'none', outlineOffset:2}}
                  onClick={() => setStForm(f=>({...f,color:c}))} />
              ))}
              <input type="color" className={styles.colorPicker} value={stForm.color} onChange={e=>setStForm(f=>({...f,color:e.target.value}))} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Доступ по ролям</label>
            <div className={styles.rolesGrid}>
              {ALL_ROLES.map(r => (
                <label key={r} className={styles.roleCheck}>
                  <input type="checkbox" checked={stForm.allowed_roles.includes(r)} onChange={() => setStForm(f => ({ ...f, allowed_roles: f.allowed_roles.includes(r) ? f.allowed_roles.filter(x=>x!==r) : [...f.allowed_roles, r] }))} />
                  {roleLabels[r]}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
