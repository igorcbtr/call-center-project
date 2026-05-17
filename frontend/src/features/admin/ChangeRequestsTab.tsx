import { useState } from 'react';
import { toast } from 'react-toastify';
import { useChangeRequestsQuery, useProcessChangeRequestMutation, useShiftTypesQuery } from '../../api/api';
import type { ChangeRequest } from '../../api/types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import styles from './ChangeRequestsTab.module.css';

const typeLabels: Record<string, string> = {
  edit: 'Изменение смены', delete: 'Удаление смены', new: 'Новая смена', custom: 'Произвольный запрос',
};
const roleLabels: Record<string, string> = {
  admin: 'Администратор', moderator: 'Модератор', operator: 'Оператор', stajer: 'Стажёр', uchenik: 'Ученик',
};
const statusLabels: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Ожидает', cls: 'pending' },
  approved: { label: 'Одобрено', cls: 'approved' },
  rejected: { label: 'Отклонено', cls: 'rejected' },
};

export function ChangeRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const { data: requests = [], isLoading, refetch } = useChangeRequestsQuery(statusFilter ? { status: statusFilter } : undefined);
  const { data: shiftTypes = [] } = useShiftTypesQuery();
  const [processRequest] = useProcessChangeRequestMutation();

  const [modal, setModal] = useState<ChangeRequest | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [adminComment, setAdminComment] = useState('');
  const [newShiftTypeId, setNewShiftTypeId] = useState('');

  const openModal = (cr: ChangeRequest) => {
    setModal(cr);
    setDecision('approved');
    setAdminComment('');
    setNewShiftTypeId(String(cr.requested_shift_type_id || shiftTypes[0]?.id || ''));
  };

  const handleProcess = async (d: 'approved' | 'rejected') => {
    if (!modal) return;
    const adminStr = localStorage.getItem('mvp_user');
    const adminId = adminStr ? JSON.parse(adminStr).id : 1;
    try {
      await processRequest({
        request_id: modal.id,
        status: d,
        admin_comment: adminComment,
        admin_id: adminId,
        new_shift_type_id: newShiftTypeId ? Number(newShiftTypeId) : undefined,
      }).unwrap();
      toast.success(d === 'approved' ? '✅ Заявка одобрена' : '❌ Заявка отклонена');
      setModal(null);
      void refetch();
    } catch { toast.error('Ошибка обработки заявки'); }
  };

  const shiftOptions = shiftTypes.map(s => ({
    value: String(s.id),
    label: `${s.name} (${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)})`,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Заявки на изменение смен</h1>
          <p className={styles.sub}>Сотрудники могут запрашивать изменение своего расписания</p>
        </div>
        <Button variant="secondary" type="button" onClick={() => void refetch()} loading={isLoading}>Обновить</Button>
      </div>

      <div className={styles.filters}>
        {(['', 'pending', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            type="button"
            className={`${styles.filterBtn} ${statusFilter === s ? styles.active : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === '' ? 'Все' : statusLabels[s]?.label}
            {s === 'pending' && requests.filter(r => r.status === 'pending').length > 0 && statusFilter !== 'pending' && (
              <span className={styles.badge}>{requests.filter(r => r.status === 'pending').length}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.empty}>Загрузка...</div>
      ) : requests.length === 0 ? (
        <div className={styles.empty}>Заявок нет</div>
      ) : (
        <div className={styles.list}>
          {requests.map(cr => {
            const st = statusLabels[cr.status] || { label: cr.status, cls: 'pending' };
            return (
              <div key={cr.id} className={`${styles.card} ${cr.status === 'pending' ? styles.cardPending : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.cardUser}>
                    <span className={styles.userFio}>{cr.user_fio}</span>
                    <span className={styles.userRole}>{roleLabels[cr.user_role || ''] || cr.user_role}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.statusBadge} ${styles[st.cls]}`}>{st.label}</span>
                    <span className={styles.typeLabel}>{typeLabels[cr.type] || cr.type}</span>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  {cr.entry_date && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Текущая дата смены:</span>
                      <span>{cr.entry_date}</span>
                    </div>
                  )}
                  {cr.requested_date && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Запрошенная дата:</span>
                      <span>{cr.requested_date}</span>
                    </div>
                  )}
                  {cr.shift_name && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Текущая смена:</span>
                      <span className={styles.shiftTag} style={{ background: cr.shift_color ? `${cr.shift_color}22` : undefined, borderColor: cr.shift_color || undefined }}>
                        {cr.shift_name}
                      </span>
                    </div>
                  )}
                  {cr.requested_shift_name && (
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Запрошенная смена:</span>
                      <span className={styles.shiftTag} style={{ background: cr.requested_shift_color ? `${cr.requested_shift_color}22` : undefined, borderColor: cr.requested_shift_color || undefined }}>
                        {cr.requested_shift_name}
                      </span>
                    </div>
                  )}
                  {cr.user_comment && (
                    <div className={styles.comment}>💬 {cr.user_comment}</div>
                  )}
                  {cr.admin_comment && (
                    <div className={styles.adminComment}>🔹 Ответ администратора: {cr.admin_comment}</div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.date}>{new Date(cr.created_at).toLocaleString('ru-RU')}</span>
                  {cr.status === 'pending' && (
                    <Button type="button" onClick={() => openModal(cr)}>Рассмотреть</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title="Рассмотрение заявки"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>Отмена</Button>
            <Button variant="danger" type="button" onClick={() => void handleProcess('rejected')}>Отклонить</Button>
            <Button type="button" onClick={() => void handleProcess('approved')}>Одобрить</Button>
          </>
        }
      >
        {modal && (
          <div className={styles.modalBody}>
            <div className={styles.crSummary}>
              <div><strong>Сотрудник:</strong> {modal.user_fio}</div>
              <div><strong>Тип:</strong> {typeLabels[modal.type]}</div>
              {modal.requested_date && <div><strong>Запрошенная дата:</strong> {modal.requested_date}</div>}
              {modal.entry_date && <div><strong>Текущая дата:</strong> {modal.entry_date}</div>}
              {modal.requested_shift_name && <div><strong>Запрошенная смена:</strong> {modal.requested_shift_name}</div>}
              <div><strong>Комментарий сотрудника:</strong> {modal.user_comment || '—'}</div>
            </div>
            <Select
              label="Назначить тип смены (при одобрении)"
              options={shiftOptions}
              value={newShiftTypeId}
              onChange={e => setNewShiftTypeId(e.target.value)}
            />
            <div>
              <label className={styles.label}>Ответ администратора</label>
              <input className={styles.input} value={adminComment} onChange={e => setAdminComment(e.target.value)} placeholder="Комментарий для сотрудника..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
