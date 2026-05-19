/**
 * Tasks controller — admin assigns tasks, employees can suggest their own
 */
const pool = require('./db.js');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { notifyUser } = require('./notificationHub.js');

const TASK_UPLOADS_DIR = path.join(__dirname, 'uploads', 'tasks');
if (!fs.existsSync(TASK_UPLOADS_DIR)) fs.mkdirSync(TASK_UPLOADS_DIR, { recursive: true });

async function ensureTaskSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_attachments (
      id            SERIAL PRIMARY KEY,
      task_id       INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      uploaded_by   INT REFERENCES users(id) ON DELETE SET NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name   VARCHAR(255) NOT NULL,
      mime_type     VARCHAR(128),
      file_size     BIGINT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function canAccessTask(task, user) {
  return ['admin', 'moderator'].includes(user.role)
    || task.assigned_to === user.id
    || task.created_by === user.id;
}

async function getTaskForAccess(taskId, user) {
  const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (!existing.rows.length) return null;
  const task = existing.rows[0];
  return canAccessTask(task, user) ? task : false;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const taskDir = path.join(TASK_UPLOADS_DIR, String(req.params.id || 'new'));
    if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
    cb(null, taskDir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-а-яА-ЯёЁ ]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

exports.upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const blocked = /\.(exe|bat|cmd|sh|msi|dmg|app)$/i.test(file.originalname);
    cb(blocked ? new Error('Этот тип файла нельзя прикрепить') : null, !blocked);
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
});

async function attachFilesToTasks(tasks) {
  if (!tasks.length) return tasks;
  await ensureTaskSchema();
  const ids = tasks.map(t => t.id);
  const files = await pool.query(`
    SELECT ta.*, u.fio AS uploaded_by_fio
    FROM task_attachments ta
    LEFT JOIN users u ON u.id=ta.uploaded_by
    WHERE ta.task_id = ANY($1::int[])
    ORDER BY ta.created_at ASC
  `, [ids]);
  const grouped = new Map();
  for (const file of files.rows) {
    if (!grouped.has(file.task_id)) grouped.set(file.task_id, []);
    grouped.get(file.task_id).push(file);
  }
  return tasks.map(task => ({ ...task, attachments: grouped.get(task.id) || [] }));
}

// GET /tasks — list tasks for current user (or all for admin)
exports.getTasks = async (req, res) => {
  try {
    await ensureTaskSchema();
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
    res.json(await attachFilesToTasks(r.rows));
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
    await ensureTaskSchema();
    const r = await pool.query(
      `INSERT INTO tasks (title, description, assigned_to, created_by, due_date, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title.trim(), description || null, assignee, req.user.id, due_date || null, priority || 'normal', status]
    );
    if (assignee !== req.user.id) {
      await notifyUser(assignee, 'Новое задание', `Вам назначено задание «${title.trim()}»`, 'info', r.rows[0].id, 'task');
    }
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
    await ensureTaskSchema();
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
    if (newAssignee && newAssignee !== req.user.id) {
      await notifyUser(newAssignee, 'Задание обновлено', `Задание «${newTitle}» обновлено`, 'info', id, 'task');
    }
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
    await ensureTaskSchema();
    const files = await pool.query('SELECT * FROM task_attachments WHERE task_id=$1', [id]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    for (const file of files.rows) {
      const filePath = path.join(TASK_UPLOADS_DIR, String(id), file.stored_name);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    res.json({ message: 'Удалено' });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.uploadTaskAttachments = async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const cleanup = () => {
    for (const file of req.files || []) {
      const filePath = path.join(TASK_UPLOADS_DIR, String(taskId), file.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  };

  try {
    await ensureTaskSchema();
    const task = await getTaskForAccess(taskId, req.user);
    if (task === null) { cleanup(); return res.status(404).json({ message: 'Задание не найдено' }); }
    if (task === false) { cleanup(); return res.status(403).json({ message: 'Нет доступа' }); }
    if (!req.files?.length) return res.status(400).json({ message: 'Файлы не загружены' });

    const inserted = [];
    for (const file of req.files) {
      const r = await pool.query(
        `INSERT INTO task_attachments
         (task_id, uploaded_by, original_name, stored_name, mime_type, file_size)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [taskId, req.user.id, file.originalname, file.filename, file.mimetype, file.size]
      );
      inserted.push(r.rows[0]);
    }
    res.json({ message: 'Файлы прикреплены', attachments: inserted });
  } catch (err) {
    cleanup();
    console.error('uploadTaskAttachments error:', err);
    res.status(500).json({ message: 'Ошибка загрузки файлов: ' + err.message });
  }
};

exports.downloadTaskAttachment = async (req, res) => {
  try {
    await ensureTaskSchema();
    const id = parseInt(req.params.attachmentId, 10);
    const r = await pool.query('SELECT * FROM task_attachments WHERE id=$1', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Файл не найден' });
    const file = r.rows[0];
    const task = await getTaskForAccess(file.task_id, req.user);
    if (task === null) return res.status(404).json({ message: 'Задание не найдено' });
    if (task === false) return res.status(403).json({ message: 'Нет доступа' });

    const filePath = path.join(TASK_UPLOADS_DIR, String(file.task_id), file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Файл не найден на сервере' });
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    console.error('downloadTaskAttachment error:', err);
    res.status(500).json({ message: 'Ошибка скачивания' });
  }
};

exports.deleteTaskAttachment = async (req, res) => {
  try {
    await ensureTaskSchema();
    const id = parseInt(req.params.attachmentId, 10);
    const r = await pool.query('SELECT * FROM task_attachments WHERE id=$1', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Файл не найден' });
    const file = r.rows[0];
    const task = await getTaskForAccess(file.task_id, req.user);
    if (task === null) return res.status(404).json({ message: 'Задание не найдено' });
    if (task === false) return res.status(403).json({ message: 'Нет доступа' });
    if (!['admin', 'moderator'].includes(req.user.role) && file.uploaded_by !== req.user.id) {
      return res.status(403).json({ message: 'Нет прав удалить этот файл' });
    }

    const filePath = path.join(TASK_UPLOADS_DIR, String(file.task_id), file.stored_name);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    await pool.query('DELETE FROM task_attachments WHERE id=$1', [id]);
    res.json({ message: 'Файл удалён' });
  } catch (err) {
    console.error('deleteTaskAttachment error:', err);
    res.status(500).json({ message: 'Ошибка удаления файла' });
  }
};
