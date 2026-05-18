import { useState } from 'react';
import { toast } from 'react-toastify';
import { useChangeRequestsQuery, useProcessChangeRequestMutation, useShiftTypesQuery } from '../../api/api';
import type { ChangeRequest } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import styles from './ChangeRequestsTab.module.css';
import { useAuth } from '../../hooks/useAuth';

const typeLabels: Record<string,string> = { edit:'Изменение', delete:'Удаление', new:'Новая смена', custom:'Произвольный' };
const statusMeta: Record<string,{label:string;cls:string}> = {
  pending:{label:'Ожидает',cls:'pending'}, approved:{label:'Одобрено',cls:'approved'}, rejected:{label:'Отклонено',cls:'rejected'},
};

export function ChangeRequestsTab() {
  const { userId } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: requests = [], isLoading, refetch } = useChangeRequestsQuery({
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const { data: shiftTypes = [] } = useShiftTypesQuery();
  const [processRequest] = useProcessChangeRequestMutation();

  const [modal, setModal]         = useState<ChangeRequest|null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [newShiftType, setNewShiftType] = useState('');

  const adminId = userId ?? 1;

  const openModal = (cr: ChangeRequest) => {
    setModal(cr); setAdminComment('');
    setNewShiftType(String(cr.requested_shift_type_id||shiftTypes[0]?.id||''));
  };

  const handleProcess = async (d: 'approved'|'rejected', ids?: number[]) => {
    const toProcess = ids || (modal ? [modal.id] : []);
    if (!toProcess.length) return;
    try {
      for (const rid of toProcess)
        await processRequest({ request_id:rid, status:d, admin_comment:adminComment, admin_id:adminId,
          new_shift_type_id: newShiftType ? Number(newShiftType) : undefined }).unwrap();
      toast.success(d==='approved' ? `✅ Одобрено (${toProcess.length})` : `❌ Отклонено (${toProcess.length})`);
      setModal(null); setSelected(new Set()); void refetch();
    } catch { toast.error('Ошибка обработки'); }
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  });

  const toggleAll = () => {
    if (selected.size === requests.length) setSelected(new Set());
    else setSelected(new Set(requests.map(r => r.id)));
  };

  const pendingReqs = requests.filter(r => r.status === 'pending');

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Заявки на изменение смен</h1>
          <p className={styles.sub}>Управляйте запросами сотрудников на изменение расписания</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} loading={isLoading}>↻ Обновить</Button>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.statusTabs}>
          {([['','Все'],['pending','Ожидают'],['approved','Одобренные'],['rejected','Отклонённые']] as const).map(([v,l]) => (
            <button key={v} type="button"
              className={[styles.stab, statusFilter===v?styles.stabActive:''].join(' ')}
              onClick={() => setStatusFilter(v)}>
              {l}
              {v==='pending' && pendingReqs.length > 0 && <span className={styles.badge}>{pendingReqs.length}</span>}
            </button>
          ))}
        </div>
        <div className={styles.dateFilters}>
          <label className={styles.dateLabel}>С:</label>
          <input type="date" className={styles.dateInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <label className={styles.dateLabel}>По:</label>
          <input type="date" className={styles.dateInput} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(dateFrom||dateTo) && <button className={styles.clearDate} onClick={() => { setDateFrom(''); setDateTo(''); }}>✕</button>}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>Выбрано: {selected.size}</span>
          <Button size="sm" onClick={() => void handleProcess('approved', [...selected])}>✅ Одобрить все выбранные</Button>
          <Button size="sm" variant="danger" onClick={() => void handleProcess('rejected', [...selected])}>❌ Отклонить все выбранные</Button>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Снять выбор</Button>
        </div>
      )}

      {isLoading ? <div className={styles.empty}>Загрузка…</div>
        : requests.length === 0 ? <div className={styles.empty}>Заявок нет</div>
        : (
        <div className={styles.list}>
          {/* Select all */}
          {requests.length > 1 && (
            <label className={styles.selectAll}>
              <input type="checkbox" checked={selected.size===requests.length && requests.length>0} onChange={toggleAll} />
              Выбрать все ({requests.length})
            </label>
          )}
          {requests.map(cr => {
            const st = statusMeta[cr.status] || { label:cr.status, cls:'pending' };
            return (
              <div key={cr.id} className={[styles.card, cr.status==='pending'?styles.cardPending:'', selected.has(cr.id)?styles.cardSelected:''].join(' ')}>
                <div className={styles.cardLeft}>
                  <input type="checkbox" className={styles.checkbox}
                    checked={selected.has(cr.id)} onChange={() => toggleSelect(cr.id)} />
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardUser}>
                      <span className={styles.userFio}>{cr.user_fio}</span>
                      <span className={styles.userRole}>{cr.user_role}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={`${styles.statusBadge} ${styles[st.cls]}`}>{st.label}</span>
                      <span className={styles.typeLabel}>{typeLabels[cr.type]||cr.type}</span>
                    </div>
                  </div>
                  <div className={styles.cardFields}>
                    {cr.entry_date && <span className={styles.field}><b>Текущая дата:</b> {cr.entry_date}</span>}
                    {cr.requested_date && <span className={styles.field}><b>Запрошена:</b> {cr.requested_date}</span>}
                    {cr.shift_name && <span className={styles.field}><b>Сейчас:</b> <span style={{color:cr.shift_color,fontWeight:600}}>{cr.shift_name}</span></span>}
                    {cr.requested_shift_name && <span className={styles.field}><b>Хочет:</b> <span style={{color:cr.requested_shift_color,fontWeight:600}}>{cr.requested_shift_name}</span></span>}
                    {cr.user_comment && <span className={styles.comment}>💬 {cr.user_comment}</span>}
                    {cr.admin_comment && <span className={styles.adminComment}>🔹 {cr.admin_comment}</span>}
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.date}>{new Date(cr.created_at).toLocaleString('ru-RU')}</span>
                    {cr.status==='pending' && <Button size="sm" onClick={() => openModal(cr)}>Рассмотреть</Button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title="Рассмотрение заявки"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(null)}>Отмена</Button>
          <Button variant="danger" onClick={() => void handleProcess('rejected')}>Отклонить</Button>
          <Button onClick={() => void handleProcess('approved')}>Одобрить</Button>
        </>}
      >
        {modal && (
          <div className={styles.modalBody}>
            <div className={styles.crSummary}>
              <div><b>Сотрудник:</b> {modal.user_fio}</div>
              <div><b>Тип:</b> {typeLabels[modal.type]}</div>
              {modal.requested_date && <div><b>Запрошенная дата:</b> {modal.requested_date}</div>}
              {modal.entry_date && <div><b>Текущая дата:</b> {modal.entry_date}</div>}
              {modal.requested_shift_name && <div><b>Запрошенная смена:</b> {modal.requested_shift_name}</div>}
              <div><b>Комментарий:</b> {modal.user_comment||'—'}</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Назначить тип смены</label>
              <select className={styles.input} value={newShiftType} onChange={e => setNewShiftType(e.target.value)}>
                <option value="">— без изменения —</option>
                {shiftTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ответ администратора</label>
              <input className={styles.input} value={adminComment} onChange={e => setAdminComment(e.target.value)} placeholder="Комментарий для сотрудника…" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
