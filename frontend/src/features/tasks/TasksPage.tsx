import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import styles from './TasksPage.module.css';

interface Task {
  id: number;
  title: string;
  description?: string;
  assigned_to?: number;
  assignee_fio?: string;
  assignee_role?: string;
  created_by?: number;
  created_by_fio?: string;
  due_date?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'assigned' | 'in_progress' | 'done' | 'suggested' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface Employee { id: number; fio: string; role: string; }

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
function getToken() { return localStorage.getItem('mvp_token') || ''; }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const priorityMeta: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Низкий',    color: '#64748b', bg: '#f1f5f9' },
  normal: { label: 'Обычный',   color: '#3b82f6', bg: '#dbeafe' },
  high:   { label: 'Высокий',   color: '#f59e0b', bg: '#fef3c7' },
  urgent: { label: 'Срочно',    color: '#ef4444', bg: '#fee2e2' },
};

const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  assigned:    { label: 'Назначено',   color: '#6366f1', bg: '#eff6ff' },
  in_progress: { label: 'В работе',    color: '#f59e0b', bg: '#fef3c7' },
  done:        { label: 'Выполнено',   color: '#10b981', bg: '#d1fae5' },
  suggested:   { label: 'Предложено',  color: '#8b5cf6', bg: '#ede9fe' },
  rejected:    { label: 'Отклонено',   color: '#ef4444', bg: '#fee2e2' },
};

export function TasksPage() {
  const { userId, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'moderator';

  const [tasks, setTasks]       = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]   = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', assigned_to: '', due_date: '', priority: 'normal', status: 'assigned',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/tasks`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch { toast.error('Ошибка загрузки заданий'); }
    finally { setLoading(false); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${baseUrl}/admin/employees`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, [isAdmin]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchTasks();
      void fetchEmployees();
    });
  }, [fetchTasks, fetchEmployees]);

  const openCreate = () => {
    setEditTask(null);
    setForm({ title: '', description: '', assigned_to: '', due_date: '', priority: 'normal', status: 'assigned' });
    setShowForm(true);
  };

  const openEdit = (t: Task) => {
    setEditTask(t);
    setForm({
      title: t.title,
      description: t.description || '',
      assigned_to: String(t.assigned_to || ''),
      due_date: t.due_date || '',
      priority: t.priority,
      status: t.status,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Введите название'); return; }
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || undefined,
        due_date: form.due_date || undefined,
        priority: form.priority,
      };
      if (isAdmin) {
        body.assigned_to = form.assigned_to ? Number(form.assigned_to) : undefined;
        body.status = form.status;
      }

      let res;
      if (editTask) {
        res = await fetch(`${baseUrl}/tasks/${editTask.id}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`${baseUrl}/tasks`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Ошибка');
      toast.success(editTask ? 'Обновлено' : 'Создано');
      setShowForm(false);
      void fetchTasks();
    } catch (e: unknown) { toast.error(errorMessage(e, 'Ошибка')); }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    try {
      const res = await fetch(`${baseUrl}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success('Статус обновлён');
      void fetchTasks();
    } catch { toast.error('Ошибка'); }
  };

  const handleDelete = async (task: Task) => {
    if (!window.confirm(`Удалить задание «${task.title}»?`)) return;
    try {
      const res = await fetch(`${baseUrl}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      toast.success('Удалено');
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch { toast.error('Ошибка'); }
  };

  const filtered = tasks.filter(t => !filterStatus || t.status === filterStatus);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Задания</h1>
          <p className={styles.sub}>
            {isAdmin ? 'Назначайте задания сотрудникам и отслеживайте выполнение.' : 'Ваши задания и предложения.'}
          </p>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>
          {isAdmin ? '+ Добавить задание' : '+ Предложить задание'}
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.statusTabs}>
          {[['', 'Все'], ['assigned', 'Назначено'], ['in_progress', 'В работе'], ['done', 'Выполнено'], ['suggested', 'Предложено']].map(([v, l]) => (
            <button key={v} type="button"
              className={[styles.stab, filterStatus === v ? styles.stabActive : ''].join(' ')}
              onClick={() => setFilterStatus(v)}>
              {l}
            </button>
          ))}
        </div>
        <button className={styles.refreshBtn} onClick={() => void fetchTasks()} disabled={loading}>↻</button>
      </div>

      {/* Task list */}
      {loading ? <div className={styles.empty}>Загрузка…</div>
        : filtered.length === 0 ? <div className={styles.empty}>Заданий нет</div>
        : (
          <div className={styles.taskList}>
            {filtered.map(task => {
              const pm = priorityMeta[task.priority] || priorityMeta.normal;
              const sm = statusMeta[task.status] || statusMeta.assigned;
              const isMyTask = task.assigned_to === userId;
              return (
                <div key={task.id} className={styles.taskCard}>
                  <div className={styles.taskTop}>
                    <div className={styles.taskTitleRow}>
                      <span className={styles.taskTitle}>{task.title}</span>
                      <span className={styles.priorityBadge} style={{ color: pm.color, background: pm.bg }}>
                        {pm.label}
                      </span>
                      <span className={styles.statusBadge} style={{ color: sm.color, background: sm.bg }}>
                        {sm.label}
                      </span>
                    </div>
                    {task.description && <p className={styles.taskDesc}>{task.description}</p>}
                  </div>
                  <div className={styles.taskMeta}>
                    {task.assignee_fio && (
                      <span className={styles.metaItem}>👤 {task.assignee_fio}</span>
                    )}
                    {task.created_by_fio && (
                      <span className={styles.metaItem}>✍️ {task.created_by_fio}</span>
                    )}
                    {task.due_date && (
                      <span className={styles.metaItem}>📅 {new Date(task.due_date + 'T00:00:00').toLocaleDateString('ru-RU')}</span>
                    )}
                    <span className={styles.metaItem}>🕐 {new Date(task.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                  <div className={styles.taskActions}>
                    {/* Status change for assigned employee */}
                    {isMyTask && task.status === 'assigned' && (
                      <button className={styles.actionBtn} onClick={() => void handleStatusChange(task, 'in_progress')}>
                        ▶ Начать
                      </button>
                    )}
                    {isMyTask && task.status === 'in_progress' && (
                      <button className={`${styles.actionBtn} ${styles.doneBtn}`} onClick={() => void handleStatusChange(task, 'done')}>
                        ✓ Выполнено
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button className={styles.editBtn} onClick={() => openEdit(task)}>✏️ Ред.</button>
                        <button className={styles.deleteBtn} onClick={() => void handleDelete(task)}>🗑</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Form modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>{editTask ? 'Редактировать задание' : (isAdmin ? 'Новое задание' : 'Предложить задание')}</h2>
              <button className={styles.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Название *</label>
                <input className={styles.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Что нужно сделать?" onKeyDown={e => { if (e.key === 'Enter') void handleSave(); }} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Описание</label>
                <textarea className={styles.textarea} rows={3} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Подробности задания…" />
              </div>
              {isAdmin && (
                <div className={styles.field}>
                  <label className={styles.label}>Назначить сотруднику</label>
                  <select className={styles.input} value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">— выберите —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.fio} ({e.role})</option>)}
                  </select>
                </div>
              )}
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Срок</label>
                  <input type="date" className={styles.input} value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Приоритет</label>
                  <select className={styles.input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Низкий</option>
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                    <option value="urgent">Срочно</option>
                  </select>
                </div>
              </div>
              {isAdmin && editTask && (
                <div className={styles.field}>
                  <label className={styles.label}>Статус</label>
                  <select className={styles.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="assigned">Назначено</option>
                    <option value="in_progress">В работе</option>
                    <option value="done">Выполнено</option>
                    <option value="rejected">Отклонено</option>
                  </select>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Отмена</button>
              <button className={styles.saveBtn} onClick={() => void handleSave()}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
