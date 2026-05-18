/**
 * Tasks controller — admin assigns tasks, employees can suggest their own
 */
const pool = require('./db.js');

// GET /tasks — list tasks for current user (or all for admin)
exports.getTasks = async (req, res) => {
  try {
    const isAdmin = ['admin', 'moderator'].includes(req.user.role);
    let q, params;
    if (isAdmin) {
      q = `SELECT t.*, u.fio as assignee_fio, u.role as assignee_role,
             a.fio as created_by_fio
           FROM tasks t
           LEFT JOIN users u ON u.id = t.assigned_to
           LEFT JOIN users a ON a.id = t.created_by
           ORDER BY t.created_at DESC`;
      params = [];
    } else {
      q = `SELECT t.*, u.fio as assignee_fio, u.role as assignee_role,
             a.fio as created_by_fio
           FROM tasks t
           LEFT JOIN users u ON u.id = t.assigned_to
           LEFT JOIN users a ON a.id = t.created_by
           WHERE t.assigned_to = $1 OR t.created_by = $1
           ORDER BY t.created_at DESC`;
      params = [req.user.id];
    }
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка загрузки заданий' });
  }
};

// POST /tasks — create a task (admin assigns, employee suggests)
exports.createTask = async (req, res) => {
  const { title, description, assigned_to, due_date, priority } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'Название обязательно' });

  const isAdmin = ['admin', 'moderator'].includes(req.user.role);
  // Employees can only create suggestions (assigned to themselves)
  const assignee = isAdmin ? (assigned_to || req.user.id) : req.user.id;
  const status = isAdmin ? 'assigned' : 'suggested';

  try {
    const r = await pool.query(
      `INSERT INTO tasks (title, description, assigned_to, created_by, due_date, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title.trim(), description || null, assignee, req.user.id, due_date || null, priority || 'normal', status]
    );
    res.json({ message: 'Создано', task: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка создания задания' });
  }
};

// PUT /tasks/:id — update task status or details
exports.updateTask = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, status, due_date, priority, assigned_to } = req.body;
  const isAdmin = ['admin', 'moderator'].includes(req.user.role);

  try {
    const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Не найдено' });

    const task = existing.rows[0];
    // Employees can only update status of their own tasks
    if (!isAdmin && task.assigned_to !== req.user.id)
      return res.status(403).json({ message: 'Нет доступа' });

    const newTitle       = title       ?? task.title;
    const newDesc        = description ?? task.description;
    const newStatus      = status      ?? task.status;
    const newDue         = due_date    ?? task.due_date;
    const newPriority    = priority    ?? task.priority;
    const newAssignee    = isAdmin ? (assigned_to ?? task.assigned_to) : task.assigned_to;

    const r = await pool.query(
      `UPDATE tasks SET title=$1, description=$2, status=$3, due_date=$4, priority=$5, assigned_to=$6,
       updated_at=NOW() WHERE id=$7 RETURNING *`,
      [newTitle, newDesc, newStatus, newDue, newPriority, newAssignee, id]
    );
    res.json({ message: 'Обновлено', task: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка обновления' });
  }
};

// DELETE /tasks/:id — admin only
exports.deleteTask = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!['admin', 'moderator'].includes(req.user.role))
    return res.status(403).json({ message: 'Нет прав' });
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка' });
  }
};
