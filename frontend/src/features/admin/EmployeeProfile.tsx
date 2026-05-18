import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  useEmployeeByIdQuery, useAddCommentMutation, useDeleteCommentMutation,
  useAddTestResultMutation, useDeleteTestResultMutation,
} from '../../api/api';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../hooks/useAuth';
import styles from './EmployeeProfile.module.css';

const roleLabels: Record<string,string> = {
  admin:'Администратор', moderator:'Модератор', operator:'Оператор', stajer:'Стажёр', uchenik:'Ученик',
};
const statusColors: Record<string,string> = {
  pending:'#f59e0b', approved:'#10b981', confirmed:'#10b981', declined:'#ef4444',
};
const eventLabels: Record<string,string> = { check_in:'Вход ✅', check_out:'Выход 🚪' };

export function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role: myRole } = useAuth();
  const isAdmin = myRole === 'admin';

  const { data: emp, isLoading, refetch } = useEmployeeByIdQuery(Number(id), { skip: !id });

  const [addComment]    = useAddCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [addTest]       = useAddTestResultMutation();
  const [deleteTest]    = useDeleteTestResultMutation();

  const [commentText, setCommentText] = useState('');
  const [tab, setTab] = useState<'shifts'|'attendance'|'comments'|'tests'|'audit'>('shifts');

  // Test modal
  const [testModal, setTestModal] = useState(false);
  const [testForm, setTestForm]   = useState({ test_name:'', score:'', comment:'' });

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await addComment({ staffId: Number(id), body: commentText }).unwrap();
      setCommentText('');
      toast.success('Комментарий добавлен');
      void refetch();
    } catch { toast.error('Ошибка'); }
  };

  const handleDeleteComment = async (cid: number) => {
    try { await deleteComment(cid).unwrap(); toast.success('Удалён'); void refetch(); }
    catch { toast.error('Ошибка'); }
  };

  const handleAddTest = async () => {
    if (!testForm.test_name.trim()) { toast.error('Введите название теста'); return; }
    try {
      await addTest({ userId: Number(id), ...testForm }).unwrap();
      setTestModal(false); setTestForm({ test_name:'', score:'', comment:'' });
      toast.success('Результат добавлен');
      void refetch();
    } catch { toast.error('Ошибка'); }
  };

  const handleDeleteTest = async (tid: number) => {
    try { await deleteTest(tid).unwrap(); toast.success('Удалён'); void refetch(); }
    catch { toast.error('Ошибка'); }
  };

  if (isLoading) return <div className={styles.loading}>Загрузка…</div>;
  if (!emp) return <div className={styles.loading}>Сотрудник не найден</div>;

  const tabs = [
    { key:'shifts',     label:'Смены',      count: emp.shifts?.length },
    { key:'attendance', label:'Посещения',  count: emp.work_logs?.length },
    { key:'comments',   label:'Комментарии',count: emp.comments?.length },
    { key:'tests',      label:'Тесты',      count: emp.tests?.length },
    ...(isAdmin ? [{ key:'audit', label:'История изменений', count: emp.audit?.length }] : []),
  ] as { key: typeof tab; label: string; count?: number }[];

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate(-1)}>← Назад</button>

      <div className={styles.profileCard}>
        <div className={styles.avatar}>{emp.fio[0]}</div>
        <div className={styles.info}>
          <h1 className={styles.name}>{emp.fio}</h1>
          <div className={styles.meta}>
            <span className={styles.role}>{roleLabels[emp.role]||emp.role}</span>
            {emp.username && <span className={styles.username}>@{emp.username}</span>}
            <span className={emp.status ? styles.active : styles.inactive}>
              {emp.status ? 'Активен' : 'Неактивен'}
            </span>
          </div>
          {(emp.moderators||[]).length > 0 && (
            <div className={styles.mods}>
              <span className={styles.modsLabel}>Модераторы:</span>
              {(emp.moderators||[]).map(m => <span key={m.id} className={styles.modChip}>{m.fio}</span>)}
            </div>
          )}
          <div className={styles.joined}>Добавлен: {emp.created_at ? new Date(emp.created_at).toLocaleDateString('ru-RU') : '—'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.key} type="button"
            className={[styles.tab, tab===t.key?styles.tabActive:''].join(' ')}
            onClick={() => setTab(t.key)}>
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className={styles.tabBadge}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Shifts */}
      {tab==='shifts' && (
        <div className={styles.section}>
          {(!emp.shifts||emp.shifts.length===0) ? <p className={styles.empty}>Смен нет</p> : (
            <table className={styles.table}>
              <thead><tr><th>Дата</th><th>Смена</th><th>Время</th><th>Статус</th><th>Комментарий</th></tr></thead>
              <tbody>
                {emp.shifts.map(s => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td><span style={{color:s.color,fontWeight:600}}>{s.shift_name}</span></td>
                    <td>{s.is_free ? `${s.custom_start?.slice(0,5)||'?'}–${s.custom_end?.slice(0,5)||'?'}` : `${s.start_time?.slice(0,5)||''}–${s.end_time?.slice(0,5)||''}`}</td>
                    <td><span style={{color:statusColors[s.status]||'#94a3b8',fontWeight:600}}>● {s.status}</span></td>
                    <td className={styles.muted}>{s.comment||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Attendance */}
      {tab==='attendance' && (
        <div className={styles.section}>
          {(!emp.work_logs||emp.work_logs.length===0) ? <p className={styles.empty}>Нет записей посещений</p> : (
            <table className={styles.table}>
              <thead><tr><th>Дата/Время</th><th>Событие</th><th>Место</th></tr></thead>
              <tbody>
                {emp.work_logs.map(l => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString('ru-RU')}</td>
                    <td><span className={l.event_type==='check_in'?styles.checkIn:styles.checkOut}>{eventLabels[l.event_type]||l.event_type}</span></td>
                    <td className={styles.muted}>{l.place||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Comments */}
      {tab==='comments' && (
        <div className={styles.section}>
          <div className={styles.commentInput}>
            <textarea className={styles.textarea} rows={2} value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Добавить комментарий к сотруднику…" />
            <Button size="sm" onClick={() => void handleAddComment()}>Добавить</Button>
          </div>
          {(!emp.comments||emp.comments.length===0) ? <p className={styles.empty}>Комментариев нет</p> : (
            <div className={styles.commentList}>
              {emp.comments.map(c => (
                <div key={c.id} className={styles.commentCard}>
                  <div className={styles.commentHeader}>
                    <span className={styles.commentAuthor}>{c.author_fio}</span>
                    <span className={styles.commentRole}>{roleLabels[c.author_role||'']}</span>
                    <span className={styles.commentDate}>{new Date(c.created_at).toLocaleString('ru-RU')}</span>
                    {isAdmin && <button className={styles.delBtn} onClick={() => void handleDeleteComment(c.id)}>✕</button>}
                  </div>
                  <div className={styles.commentBody}>{c.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tests */}
      {tab==='tests' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span />
            <Button size="sm" onClick={() => setTestModal(true)}>+ Добавить результат</Button>
          </div>
          {(!emp.tests||emp.tests.length===0) ? <p className={styles.empty}>Тестов нет</p> : (
            <table className={styles.table}>
              <thead><tr><th>Тест</th><th>Результат</th><th>Комментарий</th><th>Кто добавил</th><th>Дата</th><th></th></tr></thead>
              <tbody>
                {emp.tests.map(t => (
                  <tr key={t.id}>
                    <td><b>{t.test_name}</b></td>
                    <td>{t.score ? <span className={styles.score}>{t.score}</span> : '—'}</td>
                    <td className={styles.muted}>{t.comment||'—'}</td>
                    <td className={styles.muted}>{t.added_by_fio}</td>
                    <td className={styles.muted}>{new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
                    <td>{isAdmin && <button className={styles.delBtn} onClick={() => void handleDeleteTest(t.id)}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Audit */}
      {tab==='audit' && isAdmin && (
        <div className={styles.section}>
          {(!emp.audit||emp.audit.length===0) ? <p className={styles.empty}>История пуста</p> : (
            <table className={styles.table}>
              <thead><tr><th>Дата/Время</th><th>Действие</th><th>Кто изменил</th><th>Детали</th></tr></thead>
              <tbody>
                {emp.audit.map(a => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString('ru-RU')}</td>
                    <td><span className={styles.action}>{a.action}</span></td>
                    <td className={styles.muted}>{a.actor_fio||'—'}</td>
                    <td className={styles.muted} style={{fontSize:11}}>{a.details ? JSON.stringify(a.details).slice(0,80) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Test modal */}
      <Modal open={testModal} onClose={() => setTestModal(false)} title="Добавить результат теста"
        footer={<><Button variant="secondary" onClick={() => setTestModal(false)}>Отмена</Button><Button onClick={() => void handleAddTest()}>Сохранить</Button></>}
      >
        <div className={styles.testForm}>
          <div className={styles.field}><label className={styles.label}>Название теста *</label>
            <input className={styles.input} value={testForm.test_name} onChange={e => setTestForm(f=>({...f,test_name:e.target.value}))} placeholder="Базовый тест оператора" /></div>
          <div className={styles.field}><label className={styles.label}>Результат</label>
            <input className={styles.input} value={testForm.score} onChange={e => setTestForm(f=>({...f,score:e.target.value}))} placeholder="85/100 или Сдан" /></div>
          <div className={styles.field}><label className={styles.label}>Комментарий</label>
            <textarea className={styles.textarea} rows={2} value={testForm.comment} onChange={e => setTestForm(f=>({...f,comment:e.target.value}))} placeholder="Необязательно" /></div>
        </div>
      </Modal>
    </div>
  );
}
