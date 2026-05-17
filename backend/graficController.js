const pool = require('./db.js');

// Helper: create notification for admins
async function notifyAdmins(title, body, kind, refId, refType) {
  const admins = await pool.query("SELECT id FROM users WHERE role = 'admin' AND status = true");
  for (const adm of admins.rows) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, kind, ref_id, ref_type) VALUES ($1,$2,$3,$4,$5,$6)`,
      [adm.id, title, body, kind || 'info', refId || null, refType || null]
    );
  }
}

// Helper: notify specific user
async function notifyUser(userId, title, body, kind, refId, refType) {
  await pool.query(
    `INSERT INTO notifications (user_id, title, body, kind, ref_id, ref_type) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, title, body, kind || 'info', refId || null, refType || null]
  );
}

exports.getShiftTypes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shift_types WHERE is_active = true ORDER BY start_time ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при получении типов смен' });
  }
};

exports.createShiftType = async (req, res) => {
  const { name, start_time, end_time, color } = req.body;
  if (!name || !start_time || !end_time)
    return res.status(400).json({ message: 'name, start_time, end_time обязательны' });
  try {
    const result = await pool.query(
      `INSERT INTO shift_types (name, start_time, end_time, color) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, start_time, end_time, color || '#3b82f6']
    );
    res.json({ message: 'Тип смены создан', shift_type: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при создании типа смены' });
  }
};

exports.deleteShiftType = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Неверный id' });
  try {
    const result = await pool.query('UPDATE shift_types SET is_active=false WHERE id=$1 RETURNING *', [id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Не найдено' });
    res.json({ message: 'Тип смены удалён', shift_type: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.setShiftRoleAccess = async (req, res) => {
  const { shift_type_id, role } = req.body;
  if (!shift_type_id || !role) return res.status(400).json({ message: 'shift_type_id и role обязательны' });
  try {
    const result = await pool.query(
      `INSERT INTO shift_type_roles (shift_type_id, role) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *`,
      [shift_type_id, role]
    );
    res.json({ message: 'Доступ установлен', role_access: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.setUserShiftOverride = async (req, res) => {
  const { shift_type_id, user_id, type } = req.body;
  if (!shift_type_id || !user_id || !['allow', 'deny'].includes(type))
    return res.status(400).json({ message: 'shift_type_id, user_id, type(allow/deny) обязательны' });
  try {
    const result = await pool.query(
      `INSERT INTO shift_type_user_overrides (shift_type_id, user_id, type)
       VALUES ($1,$2,$3) ON CONFLICT (shift_type_id, user_id) DO UPDATE SET type=$3 RETURNING *`,
      [shift_type_id, user_id, type]
    );
    res.json({ message: 'Override установлен', override: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

async function checkShiftAccess(user_id, shift_type_id) {
  const overrideResult = await pool.query(
    'SELECT type FROM shift_type_user_overrides WHERE user_id=$1 AND shift_type_id=$2',
    [user_id, shift_type_id]
  );
  if (overrideResult.rows.length > 0) return overrideResult.rows[0].type === 'allow';
  const userResult = await pool.query('SELECT role FROM users WHERE id=$1', [user_id]);
  if (!userResult.rows.length) return false;
  const roleResult = await pool.query(
    'SELECT id FROM shift_type_roles WHERE shift_type_id=$1 AND role=$2',
    [shift_type_id, userResult.rows[0].role]
  );
  return roleResult.rows.length > 0;
}

exports.getAvailableShifts = async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: 'user_id обязателен' });
  const userId = parseInt(user_id, 10);
  if (isNaN(userId)) return res.status(400).json({ message: 'user_id должен быть числом' });
  if (req.user && req.user.role !== 'admin' && req.user.id !== userId)
    return res.status(403).json({ message: 'Нет доступа' });
  try {
    const shiftsResult = await pool.query('SELECT * FROM shift_types WHERE is_active=true ORDER BY start_time ASC');
    const available = [];
    for (const shift of shiftsResult.rows) {
      if (await checkShiftAccess(userId, shift.id)) available.push(shift);
    }
    res.json(available);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.createShiftEntry = async (req, res) => {
  const { user_id, date, shift_type_id, comment, is_uncertain } = req.body;
  if (!user_id || !date || !shift_type_id)
    return res.status(400).json({ message: 'user_id, date, shift_type_id обязательны' });
  const userId = parseInt(user_id, 10);
  if (isNaN(userId)) return res.status(400).json({ message: 'user_id должен быть числом' });
  if (req.user && req.user.role !== 'admin' && req.user.id !== userId)
    return res.status(403).json({ message: 'Нет доступа' });
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin && !(await checkShiftAccess(userId, shift_type_id)))
      return res.status(403).json({ message: 'У вас нет доступа к этой смене' });

    const today = new Date(date);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    let weekResult = await pool.query('SELECT id FROM schedule_weeks WHERE start_date=$1', [startOfWeek.toISOString().split('T')[0]]);
    let weekId;
    if (!weekResult.rows.length) {
      const cw = await pool.query('INSERT INTO schedule_weeks (start_date, status) VALUES ($1,$2) RETURNING id', [startOfWeek.toISOString().split('T')[0], 'draft']);
      weekId = cw.rows[0].id;
    } else {
      weekId = weekResult.rows[0].id;
    }

    const existResult = await pool.query('SELECT id FROM shift_entries WHERE user_id=$1 AND date=$2', [userId, date]);
    if (existResult.rows.length > 0)
      return res.status(400).json({ message: 'На эту дату уже есть смена' });

    const result = await pool.query(
      `INSERT INTO shift_entries (user_id, date, shift_type_id, week_id, comment, is_uncertain, status, created_by_admin)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *`,
      [userId, date, shift_type_id, weekId, comment || null, is_uncertain || false, isAdmin]
    );

    // Notify user if admin created, or notify admins if employee created
    if (isAdmin && req.user.id !== userId) {
      const stRes = await pool.query('SELECT name FROM shift_types WHERE id=$1', [shift_type_id]);
      const shiftName = stRes.rows[0]?.name || 'смена';
      await notifyUser(userId, 'Вам назначена смена', `Администратор назначил вам смену «${shiftName}» на ${date}`, 'shift', result.rows[0].id, 'shift_entry');
    }

    res.json({ message: 'Смена создана', entry: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при создании смены' });
  }
};

exports.getUserSchedule = async (req, res) => {
  const { user_id, start_date, end_date } = req.body;
  if (!user_id || !start_date || !end_date)
    return res.status(400).json({ message: 'user_id, start_date, end_date обязательны' });
  const userId = parseInt(user_id, 10);
  if (req.user && req.user.role !== 'admin' && req.user.id !== userId)
    return res.status(403).json({ message: 'Нет доступа к чужому графику' });
  try {
    const result = await pool.query(
      `SELECT se.*, st.name as shift_name, st.start_time, st.end_time, st.color
       FROM shift_entries se LEFT JOIN shift_types st ON se.shift_type_id=st.id
       WHERE se.user_id=$1 AND se.date BETWEEN $2 AND $3 ORDER BY se.date ASC`,
      [userId, start_date, end_date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.getAllSchedules = async (req, res) => {
  const { start_date, end_date } = req.body;
  if (!start_date || !end_date)
    return res.status(400).json({ message: 'start_date, end_date обязательны' });
  if (req.user && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Только администратор' });
  try {
    const result = await pool.query(
      `SELECT se.*, u.fio, u.role as user_role, st.name as shift_name, st.start_time, st.end_time, st.color
       FROM shift_entries se
       JOIN users u ON se.user_id=u.id
       LEFT JOIN shift_types st ON se.shift_type_id=st.id
       WHERE se.date BETWEEN $1 AND $2 ORDER BY se.date ASC, u.fio ASC`,
      [start_date, end_date]
    );
    // Also fetch pending change_requests for this period
    const crResult = await pool.query(
      `SELECT cr.*, u.fio as user_fio, st.name as shift_name, st.color,
              rst.name as requested_shift_name, rst.color as requested_color
       FROM change_requests cr
       JOIN users u ON cr.user_id=u.id
       LEFT JOIN shift_entries se ON cr.shift_entry_id=se.id
       LEFT JOIN shift_types st ON se.shift_type_id=st.id
       LEFT JOIN shift_types rst ON cr.requested_shift_type_id=rst.id
       WHERE cr.status='pending'
         AND (cr.requested_date BETWEEN $1 AND $2 OR se.date BETWEEN $1 AND $2)
       ORDER BY cr.created_at ASC`,
      [start_date, end_date]
    );
    res.json({ entries: result.rows, changeRequests: crResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.deleteShiftEntry = async (req, res) => {
  const { entry_id } = req.body;
  if (!entry_id) return res.status(400).json({ message: 'entry_id обязателен' });
  const entryId = parseInt(entry_id, 10);
  try {
    const entryResult = await pool.query('SELECT * FROM shift_entries WHERE id=$1', [entryId]);
    if (!entryResult.rows.length) return res.status(404).json({ message: 'Смена не найдена' });
    const entry = entryResult.rows[0];
    const weekResult = await pool.query('SELECT status FROM schedule_weeks WHERE id=$1', [entry.week_id]);
    if (weekResult.rows.length && weekResult.rows[0].status === 'locked')
      return res.status(400).json({ message: 'Неделя заблокирована. Используйте заявку на изменение' });
    await pool.query('DELETE FROM shift_entries WHERE id=$1', [entryId]);
    // Notify user
    const stRes = await pool.query('SELECT name FROM shift_types WHERE id=$1', [entry.shift_type_id]);
    const shiftName = stRes.rows[0]?.name || 'смена';
    await notifyUser(entry.user_id, 'Смена удалена', `Смена «${shiftName}» на ${entry.date} была удалена администратором`, 'warning');
    res.json({ message: 'Смена удалена' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.updateShiftEntry = async (req, res) => {
  const { entry_id, shift_type_id, comment, is_uncertain } = req.body;
  if (!entry_id || !shift_type_id) return res.status(400).json({ message: 'entry_id и shift_type_id обязательны' });
  const entryId = parseInt(entry_id, 10);
  try {
    const result = await pool.query(
      `UPDATE shift_entries SET shift_type_id=$1, comment=$2, is_uncertain=$3 WHERE id=$4 RETURNING *`,
      [shift_type_id, comment || null, is_uncertain || false, entryId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Не найдено' });
    const entry = result.rows[0];
    const stRes = await pool.query('SELECT name FROM shift_types WHERE id=$1', [shift_type_id]);
    const shiftName = stRes.rows[0]?.name || 'смена';
    await notifyUser(entry.user_id, 'Смена изменена', `Администратор изменил вашу смену на ${entry.date} — теперь «${shiftName}»`, 'shift', entryId, 'shift_entry');
    res.json({ message: 'Смена обновлена', entry: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.approveWeek = async (req, res) => {
  const { week_id, admin_id } = req.body;
  if (!week_id || !admin_id) return res.status(400).json({ message: 'week_id, admin_id обязательны' });
  const weekId = parseInt(week_id, 10);
  const adminId = parseInt(admin_id, 10);
  try {
    await pool.query('BEGIN');
    await pool.query("UPDATE shift_entries SET status='approved' WHERE week_id=$1", [weekId]);
    const result = await pool.query(
      "UPDATE schedule_weeks SET status='locked', approved_at=NOW(), approved_by=$1 WHERE id=$2 RETURNING *",
      [adminId, weekId]
    );
    // Notify all users in this week
    const users = await pool.query(
      'SELECT DISTINCT user_id FROM shift_entries WHERE week_id=$1', [weekId]
    );
    for (const u of users.rows) {
      await notifyUser(u.user_id, 'Неделя подтверждена', 'Ваш график на эту неделю подтверждён администратором', 'success');
    }
    await pool.query('COMMIT');
    res.json({ message: 'Неделя подтверждена', week: result.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

// Employee requests shift change — creates a pending change request
// AND marks the cell in schedule as "pending change request"
exports.createChangeRequest = async (req, res) => {
  const { user_id, shift_entry_id, requested_date, requested_shift_type_id, type, new_data, user_comment } = req.body;
  if (!user_id || !type || !['edit', 'delete', 'custom', 'new'].includes(type))
    return res.status(400).json({ message: 'user_id и type(edit/delete/custom/new) обязательны' });
  const userId = parseInt(user_id, 10);
  if (isNaN(userId)) return res.status(400).json({ message: 'user_id должен быть числом' });

  try {
    const result = await pool.query(
      `INSERT INTO change_requests (user_id, shift_entry_id, requested_date, requested_shift_type_id, type, new_data, user_comment, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [userId, shift_entry_id || null, requested_date || null, requested_shift_type_id || null,
       type, JSON.stringify(new_data || {}), user_comment || null]
    );
    const cr = result.rows[0];

    // Notify all admins
    const userRes = await pool.query('SELECT fio FROM users WHERE id=$1', [userId]);
    const fio = userRes.rows[0]?.fio || 'Сотрудник';
    const dateLabel = requested_date || (shift_entry_id ? `запись #${shift_entry_id}` : '');
    await notifyAdmins(
      'Заявка на изменение смены',
      `${fio} запросил изменение смены${dateLabel ? ` на ${dateLabel}` : ''}. Комментарий: ${user_comment || '—'}`,
      'warning', cr.id, 'change_request'
    );

    res.json({ message: 'Заявка создана', request: cr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при создании заявки' });
  }
};

exports.getChangeRequests = async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT cr.*, u.fio as user_fio, u.role as user_role,
             se.date as entry_date, se.shift_type_id as entry_shift_type_id,
             st.name as shift_name, st.color as shift_color,
             rst.name as requested_shift_name, rst.color as requested_shift_color
      FROM change_requests cr
      JOIN users u ON cr.user_id=u.id
      LEFT JOIN shift_entries se ON cr.shift_entry_id=se.id
      LEFT JOIN shift_types st ON se.shift_type_id=st.id
      LEFT JOIN shift_types rst ON cr.requested_shift_type_id=rst.id
    `;
    const params = [];
    if (status) { query += ' WHERE cr.status=$1'; params.push(status); }
    query += ' ORDER BY cr.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.processChangeRequest = async (req, res) => {
  const { request_id, status, admin_comment, admin_id, new_shift_type_id } = req.body;
  if (!request_id || !['approved', 'rejected'].includes(status) || !admin_id)
    return res.status(400).json({ message: 'request_id, status, admin_id обязательны' });
  const requestId = parseInt(request_id, 10);
  const adminId = parseInt(admin_id, 10);

  try {
    await pool.query('BEGIN');
    const crResult = await pool.query('SELECT * FROM change_requests WHERE id=$1', [requestId]);
    if (!crResult.rows.length) throw new Error('Заявка не найдена');
    const cr = crResult.rows[0];

    if (status === 'approved') {
      const shiftTypeToUse = new_shift_type_id || cr.requested_shift_type_id;

      if (cr.type === 'edit' && cr.shift_entry_id && shiftTypeToUse) {
        // Admin edits the existing shift
        await pool.query(
          `UPDATE shift_entries SET shift_type_id=$1, status='approved' WHERE id=$2`,
          [shiftTypeToUse, cr.shift_entry_id]
        );
      } else if (cr.type === 'delete' && cr.shift_entry_id) {
        await pool.query('DELETE FROM shift_entries WHERE id=$1', [cr.shift_entry_id]);
      } else if (cr.type === 'new' && cr.requested_date) {
        // Create a new shift entry as requested
        if (shiftTypeToUse) {
          const today = new Date(cr.requested_date);
          const sow = new Date(today);
          sow.setDate(today.getDate() - ((today.getDay() + 6) % 7));
          let wRes = await pool.query('SELECT id FROM schedule_weeks WHERE start_date=$1', [sow.toISOString().split('T')[0]]);
          let weekId;
          if (!wRes.rows.length) {
            const cw = await pool.query('INSERT INTO schedule_weeks (start_date,status) VALUES ($1,$2) RETURNING id', [sow.toISOString().split('T')[0], 'draft']);
            weekId = cw.rows[0].id;
          } else {
            weekId = wRes.rows[0].id;
          }
          await pool.query(
            `INSERT INTO shift_entries (user_id, date, shift_type_id, week_id, status) VALUES ($1,$2,$3,$4,'approved') ON CONFLICT (user_id, date) DO UPDATE SET shift_type_id=$3, status='approved'`,
            [cr.user_id, cr.requested_date, shiftTypeToUse, weekId]
          );
        }
      }
    }

    const result = await pool.query(
      'UPDATE change_requests SET status=$1, admin_comment=$2, processed_at=NOW(), processed_by=$3 WHERE id=$4 RETURNING *',
      [status, admin_comment || null, adminId, requestId]
    );

    // Notify user
    const statusText = status === 'approved' ? 'одобрена ✅' : 'отклонена ❌';
    await notifyUser(cr.user_id, `Заявка ${statusText}`,
      `Ваша заявка на изменение смены была ${statusText}.${admin_comment ? ` Комментарий: ${admin_comment}` : ''}`,
      status === 'approved' ? 'success' : 'error', requestId, 'change_request');

    await pool.query('COMMIT');
    res.json({ message: `Заявка ${status === 'approved' ? 'одобрена' : 'отклонена'}`, request: result.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Ошибка при обработке заявки' });
  }
};

exports.setScheduleRule = async (req, res) => {
  const { role, max_shifts } = req.body;
  if (!role || max_shifts == null) return res.status(400).json({ message: 'role и max_shifts обязательны' });
  try {
    const result = await pool.query(
      `INSERT INTO shift_limits (role, max_shifts_per_week) VALUES ($1,$2) ON CONFLICT (role) DO UPDATE SET max_shifts_per_week=EXCLUDED.max_shifts_per_week RETURNING *`,
      [role, max_shifts]
    );
    res.json({ message: 'Лимит обновлён', rule: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.getShiftLimits = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shift_limits ORDER BY role ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.putShiftLimits = async (req, res) => {
  const { limits } = req.body;
  if (!Array.isArray(limits)) return res.status(400).json({ message: 'limits должен быть массивом' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of limits) {
      if (!row.role || row.max_shifts_per_week == null) continue;
      await client.query(
        `INSERT INTO shift_limits (role, max_shifts_per_week) VALUES ($1,$2) ON CONFLICT (role) DO UPDATE SET max_shifts_per_week=EXCLUDED.max_shifts_per_week`,
        [row.role, row.max_shifts_per_week]
      );
    }
    await client.query('COMMIT');
    const all = await pool.query('SELECT * FROM shift_limits ORDER BY role ASC');
    res.json(all.rows);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ message: 'Ошибка сохранения лимитов' });
  } finally {
    client.release();
  }
};

exports.getFreeTime = async (req, res) => {
  const userId = parseInt(req.query.user_id, 10);
  if (isNaN(userId)) return res.status(400).json({ message: 'user_id обязателен' });
  if (req.user.role !== 'admin' && req.user.id !== userId) return res.status(403).json({ message: 'Нет доступа' });
  try {
    const result = await pool.query(
      'SELECT * FROM free_time WHERE user_id=$1 ORDER BY date DESC, start_time ASC', [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.createFreeTime = async (req, res) => {
  const { user_id, date, start_time, end_time, kind } = req.body;
  const uid = parseInt(user_id, 10);
  if (isNaN(uid) || !date || !start_time || !end_time)
    return res.status(400).json({ message: 'user_id, date, start_time, end_time обязательны' });
  if (req.user.role !== 'admin' && req.user.id !== uid) return res.status(403).json({ message: 'Нет доступа' });
  try {
    const result = await pool.query(
      `INSERT INTO free_time (user_id, date, start_time, end_time, kind) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [uid, date, start_time, end_time, kind || 'personal']
    );
    res.json({ message: 'Сохранено', free_time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.deleteFreeTime = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ message: 'Неверный id' });
  try {
    const r = await pool.query('SELECT user_id FROM free_time WHERE id=$1', [id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не найдено' });
    if (req.user.role !== 'admin' && r.rows[0].user_id !== req.user.id) return res.status(403).json({ message: 'Нет доступа' });
    await pool.query('DELETE FROM free_time WHERE id=$1', [id]);
    res.json({ message: 'Удалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.respondShiftEntry = async (req, res) => {
  const entryId = parseInt(req.params.id, 10);
  const { action } = req.body;
  if (isNaN(entryId) || !['confirm', 'decline'].includes(action))
    return res.status(400).json({ message: 'action: confirm | decline' });
  try {
    const er = await pool.query('SELECT * FROM shift_entries WHERE id=$1', [entryId]);
    if (!er.rows.length) return res.status(404).json({ message: 'Смена не найдена' });
    const entry = er.rows[0];
    if (req.user.role !== 'admin' && entry.user_id !== req.user.id) return res.status(403).json({ message: 'Нет доступа' });
    const newStatus = action === 'confirm' ? 'confirmed' : 'declined';
    const result = await pool.query('UPDATE shift_entries SET status=$1 WHERE id=$2 RETURNING *', [newStatus, entryId]);
    res.json({ message: 'OK', entry: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.getShiftTypeRoles = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT str.id, str.shift_type_id, str.role, st.name AS shift_name
       FROM shift_type_roles str
       JOIN shift_types st ON st.id=str.shift_type_id
       ORDER BY st.name, str.role`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

// Notifications
exports.getNotifications = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [userId]
    );
    const unread = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false', [userId]);
    res.json({ notifications: result.rows, unread_count: parseInt(unread.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.markNotificationsRead = async (req, res) => {
  const userId = req.user.id;
  const { ids } = req.body;
  try {
    if (ids && ids.length) {
      await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND id=ANY($2)', [userId, ids]);
    } else {
      await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1', [userId]);
    }
    res.json({ message: 'OK' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка' });
  }
};
