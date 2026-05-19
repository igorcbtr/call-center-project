import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  useEmployeesQuery, useCreateEmployeeMutation, useUpdateEmployeeMutation,
  useDeleteEmployeeMutation, useResetPasswordMutation, useSetModeratorStaffMutation,
} from '../../api/api';
import type { User, UserRole } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import styles from './UsersTab.module.css';
import { useAuth } from '../../hooks/useAuth';

function apiMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data;
    if (data && typeof data === 'object' && 'message' in data) return String(data.message);
  }
  return fallback;
}

const ALL_ROLES: {value:UserRole;label:string}[] = [
  {value:'admin',label:'Администратор'},{value:'moderator',label:'Модератор'},
  {value:'operator',label:'Оператор'},{value:'stajer',label:'Стажёр'},{value:'uchenik',label:'Ученик'},
];
const STAFF_ROLES = ALL_ROLES.filter(r => !['admin','moderator'].includes(r.value));

const roleBg: Record<string,string> = {
  admin:'#fee2e2|#991b1b', moderator:'#fef3c7|#92400e',
  operator:'#dbeafe|#1e40af', stajer:'#d1fae5|#065f46', uchenik:'#ede9fe|#5b21b6',
};

function RolePill({ role }: { role: string }) {
  const [bg,color] = (roleBg[role]||'#f1f5f9|#475569').split('|');
  return <span style={{background:bg,color,padding:'2px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>{ALL_ROLES.find(r=>r.value===role)?.label||role}</span>;
}

export function UsersTab() {
  const { role: myRole, userId } = useAuth();
  const isAdmin = myRole === 'admin';
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<'active'|'inactive'|'all'>('active');
  const [filterRole, setFilterRole]   = useState('');
  const [search, setSearch]           = useState('');

  const { data: employees = [], isLoading, refetch } = useEmployeesQuery({ status: statusFilter });
  const [createEmp]    = useCreateEmployeeMutation();
  const [updateEmp]    = useUpdateEmployeeMutation();
  const [deleteEmp]    = useDeleteEmployeeMutation();
  const [resetPwd]     = useResetPasswordMutation();
  const [setModerators] = useSetModeratorStaffMutation();

  const moderators = useMemo(() => employees.filter(u => u.role==='moderator'), [employees]);

  const filtered = useMemo(() => employees.filter(u => {
    if (filterRole && u.role!==filterRole) return false;
    const q = search.toLowerCase();
    return !q || u.fio.toLowerCase().includes(q) || (u.username||'').toLowerCase().includes(q);
  }), [employees, filterRole, search]);

  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<User|null>(null);
  const [form, setForm]       = useState({ fio:'', role:'operator' as UserRole, username:'', password:'', status:true });
  const [modModal, setModModal] = useState<User|null>(null);
  const [selMods, setSelMods]   = useState<number[]>([]);

  const openCreate = () => { setEditing(null); setForm({fio:'',role:'operator',username:'',password:'',status:true}); setOpen(true); };
  const openEdit   = (u: User) => { setEditing(u); setForm({fio:u.fio,role:u.role,username:u.username||'',password:'',status:u.status}); setOpen(true); };
  const openMods   = (u: User) => { setModModal(u); setSelMods((u.moderators||[]).map(m=>m.id)); };
  const profilePath = (userId: number) => isAdmin ? `/admin/employees/${userId}` : `/mod/employees/${userId}`;
  const canEditUser = (u: User) => isAdmin || !['admin','moderator'].includes(u.role);

  const save = async () => {
    if (!form.fio.trim()) { toast.error('Введите ФИО'); return; }
    try {
      if (editing) await updateEmp({ id:editing.id, body:{ fio:form.fio, role:form.role, status:form.status, username:form.username||null } }).unwrap();
      else await createEmp({ fio:form.fio, role:form.role, status:form.status, username:form.username||undefined, password:form.password||undefined }).unwrap();
      toast.success(editing?'Обновлено':'Создан'); setOpen(false);
    } catch(e: unknown) { toast.error(apiMessage(e, 'Ошибка')); }
  };

  const doReset = async (u: User) => {
    if (!window.confirm(`Сбросить пароль ${u.fio}?`)) return;
    try { await resetPwd(u.id).unwrap(); toast.success('Пароль сброшен'); }
    catch { toast.error('Ошибка'); }
  };

  const doDelete = async (u: User) => {
    if (!window.confirm(`Удалить ${u.fio}?`)) return;
    try { await deleteEmp(u.id).unwrap(); toast.success('Удалён'); }
    catch { toast.error('Ошибка'); }
  };

  const saveMods = async () => {
    if (!modModal) return;
    try { await setModerators({ staffId:modModal.id, moderator_ids:selMods }).unwrap(); toast.success('Обновлено'); setModModal(null); void refetch(); }
    catch { toast.error('Ошибка'); }
  };

  const roleOptions = isAdmin ? ALL_ROLES : STAFF_ROLES;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div><h1 className={styles.title}>Сотрудники</h1><p className={styles.sub}>Нажмите на строку для просмотра профиля</p></div>
        <Button onClick={openCreate}>+ Новый сотрудник</Button>
      </div>

      <div className={styles.filters}>
        <input className={styles.search} placeholder="Поиск по имени / логину…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={styles.sel} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Все роли</option>
          {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className={styles.statusTabs}>
          {(['active','inactive','all'] as const).map(s => (
            <button key={s} type="button" className={[styles.stab, statusFilter===s?styles.stabActive:''].join(' ')} onClick={() => setStatusFilter(s)}>
              {s==='active'?'Активные':s==='inactive'?'Скрытые':'Все'}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} loading={isLoading}>↻</Button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Сотрудник</th><th>Логин</th><th>Роль</th><th>Модераторы</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {filtered.length===0 && <tr><td colSpan={6} className={styles.empty}>Нет сотрудников</td></tr>}
            {filtered.map(u => (
              <tr key={u.id} className={styles.clickableRow} onClick={() => navigate(profilePath(u.id))}>
                <td><span className={styles.fio}>{u.fio}</span></td>
                <td className={styles.muted}>{u.username||'—'}</td>
                <td><RolePill role={u.role} /></td>
                <td>
                  <div className={styles.modList} onClick={e => e.stopPropagation()}>
                    {(u.moderators||[]).length===0 ? <span className={styles.muted}>—</span>
                      : (u.moderators||[]).map(m => <span key={m.id} className={styles.modChip}>{m.fio}</span>)}
                    {isAdmin && <button type="button" className={styles.modBtn} onClick={e => { e.stopPropagation(); openMods(u); }}>✏️</button>}
                  </div>
                </td>
                <td><span className={u.status?styles.statusOn:styles.statusOff}>{u.status?'Активен':'Неактивен'}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  <div className={styles.actions}>
                    {canEditUser(u) && <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>Ред.</Button>}
                    {isAdmin && <Button size="sm" variant="secondary" onClick={() => doReset(u)}>Сброс пароля</Button>}
                    {isAdmin && u.id !== userId && <Button size="sm" variant="danger" onClick={() => doDelete(u)}>Удалить</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing?'Редактировать':'Новый сотрудник'}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Отмена</Button><Button onClick={() => void save()}>Сохранить</Button></>}
      >
        <div className={styles.form}>
          <div className={styles.field}><label className={styles.label}>ФИО *</label>
            <input className={styles.input} value={form.fio} onChange={e => setForm(f=>({...f,fio:e.target.value}))}
              onKeyDown={e => { if (e.key === 'Enter') void save(); }} /></div>
          <div className={styles.field}><label className={styles.label}>Логин</label>
            <input className={styles.input} value={form.username} onChange={e => setForm(f=>({...f,username:e.target.value}))}
              onKeyDown={e => { if (e.key === 'Enter') void save(); }} /></div>
          <div className={styles.field}><label className={styles.label}>Роль *</label>
            <select className={styles.input} value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value as UserRole}))}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select></div>
          {!editing && <div className={styles.field}><label className={styles.label}>Пароль (если пусто — сотрудник зарегистрируется сам)</label>
            <input className={styles.input} type="password" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e => { if (e.key === 'Enter') void save(); }} /></div>}
          <label className={styles.checkRow}><input type="checkbox" checked={form.status} onChange={e => setForm(f=>({...f,status:e.target.checked}))} /> Активный аккаунт</label>
        </div>
      </Modal>

      <Modal open={Boolean(modModal)} onClose={() => setModModal(null)} title={`Модераторы: ${modModal?.fio}`}
        footer={<><Button variant="secondary" onClick={() => setModModal(null)}>Отмена</Button><Button onClick={() => void saveMods()}>Сохранить</Button></>}
      >
        <div className={styles.modModalBody}>
          <p className={styles.modHint}>Выберите модераторов (можно несколько):</p>
          {moderators.length===0 && <p className={styles.muted}>Нет модераторов в системе</p>}
          {moderators.map(m => (
            <label key={m.id} className={styles.modCheckRow}>
              <input type="checkbox" checked={selMods.includes(m.id)} onChange={() => setSelMods(prev => prev.includes(m.id)?prev.filter(x=>x!==m.id):[...prev,m.id])} />
              <span>{m.fio}</span>
              {m.username && <span className={styles.muted}>@{m.username}</span>}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
