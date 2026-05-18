const pool = require('./db.js');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const SALT_ROUNDS = 10;

// ── Audit helper ────────────────────────────────────────────────────────────
async function audit(actorId, actorFio, targetId, targetFio, action, details = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_log (actor_id,actor_fio,target_id,target_fio,action,details) VALUES ($1,$2,$3,$4,$5,$6)',
      [actorId||null, actorFio||null, targetId||null, targetFio||null, action, JSON.stringify(details)]
    );
  } catch(e) { console.error('audit error:', e.message); }
}

// ── QR ──────────────────────────────────────────────────────────────────────
exports.createQrPlace = async (req, res) => {
  const { place } = req.body;
  if (!place?.trim()) return res.status(400).json({ message: 'Название обязательно' });
  try {
    const code = `QR_${Date.now()}_${Math.random().toString(36).substr(2,9).toUpperCase()}`;
    const base = process.env.PUBLIC_URL || `http://localhost:5173`;
    const link = `${base}/scan?place=${encodeURIComponent(place.trim())}&code=${encodeURIComponent(code)}`;
    const qrDataUrl = await QRCode.toDataURL(link, { width: 300, margin: 2 });
    const result = await pool.query(
      'INSERT INTO qr_places (place,code,link) VALUES ($1,$2,$3) RETURNING *',
      [place.trim(), code, link]
    );
    await audit(req.user?.id, req.user?.fio, null, null, 'create_qr', { place: place.trim() });
    res.json({ ...result.rows[0], qrDataUrl });
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка QR' }); }
};

exports.getQrPlaces = async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM qr_places ORDER BY created_at DESC')).rows); }
  catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.deleteQrPlace = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try { await pool.query('DELETE FROM qr_places WHERE id=$1', [id]); res.json({ message: 'Удалено' }); }
  catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── EMPLOYEES ────────────────────────────────────────────────────────────────
exports.getAllEmployees = async (req, res) => {
  const { status } = req.query;
  let where = status === 'inactive' ? 'WHERE u.status=false' : status === 'all' ? '' : 'WHERE u.status=true';
  // moderator sees all staff (for management)
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.fio, u.role, u.status, u.created_at,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id',m.id,'fio',m.fio))
          FILTER (WHERE m.id IS NOT NULL),'[]') AS moderators
      FROM users u
      LEFT JOIN moderator_staff ms ON ms.staff_id=u.id
      LEFT JOIN users m ON m.id=ms.moderator_id
      ${where}
      GROUP BY u.id ORDER BY u.fio ASC`);
    res.json(result.rows);
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

exports.getEmployeeById = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const u = await pool.query(`
      SELECT u.id,u.username,u.fio,u.role,u.status,u.created_at,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id',m.id,'fio',m.fio))
          FILTER (WHERE m.id IS NOT NULL),'[]') AS moderators
      FROM users u
      LEFT JOIN moderator_staff ms ON ms.staff_id=u.id
      LEFT JOIN users m ON m.id=ms.moderator_id
      WHERE u.id=$1 GROUP BY u.id`, [id]);
    if (!u.rows.length) return res.status(404).json({ message: 'Не найден' });

    // shifts last 30 days
    const shifts = await pool.query(`
      SELECT se.*,st.name as shift_name,st.color,st.start_time,st.end_time
      FROM shift_entries se LEFT JOIN shift_types st ON st.id=se.shift_type_id
      WHERE se.user_id=$1 ORDER BY se.date DESC LIMIT 30`, [id]);

    // work logs
    const logs = await pool.query(
      'SELECT * FROM work_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [id]);

    // comments
    const comments = await pool.query(`
      SELECT sc.*,a.fio as author_fio,a.role as author_role
      FROM staff_comments sc JOIN users a ON a.id=sc.author_id
      WHERE sc.staff_id=$1 ORDER BY sc.created_at DESC`, [id]);

    // test results
    const tests = await pool.query(`
      SELECT tr.*,a.fio as added_by_fio
      FROM test_results tr JOIN users a ON a.id=tr.added_by
      WHERE tr.user_id=$1 ORDER BY tr.created_at DESC`, [id]);

    // audit
    const audit = await pool.query(
      'SELECT * FROM audit_log WHERE target_id=$1 ORDER BY created_at DESC LIMIT 30', [id]);

    res.json({ ...u.rows[0], shifts: shifts.rows, work_logs: logs.rows,
      comments: comments.rows, tests: tests.rows, audit: audit.rows });
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

exports.createEmployee = async (req, res) => {
  const { fio, role, status, username, password } = req.body;
  if (!fio||!role) return res.status(400).json({ message: 'ФИО и роль обязательны' });
  if (req.user.role==='moderator' && ['admin','moderator'].includes(role))
    return res.status(403).json({ message: 'Нет прав' });
  try {
    const hash = password?.length > 0 ? await bcrypt.hash(String(password), SALT_ROUNDS) : null;
    const r = await pool.query(
      'INSERT INTO users (username,fio,role,status,password) VALUES ($1,$2,$3,$4,$5) RETURNING id,username,fio,role,status',
      [username||null, fio.trim(), role, status!==false, hash]);
    await audit(req.user.id, req.user.fio, r.rows[0].id, fio, 'create_user', { role });
    res.json({ message: 'Создан', employee: r.rows[0] });
  } catch(err) {
    if (err.code==='23505') return res.status(400).json({ message: 'Логин занят' });
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.updateEmployee = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { fio, role, status, username } = req.body;
  if (!fio||!role) return res.status(400).json({ message: 'ФИО и роль обязательны' });
  if (req.user.role==='moderator' && ['admin','moderator'].includes(role))
    return res.status(403).json({ message: 'Нет прав' });
  try {
    const old = await pool.query('SELECT fio,role FROM users WHERE id=$1', [id]);
    const r = await pool.query(
      'UPDATE users SET fio=$1,role=$2,status=$3,username=COALESCE(NULLIF($4,\'\'),username) WHERE id=$5 RETURNING id,username,fio,role,status',
      [fio.trim(), role, status!==false, username||'', id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не найден' });
    await audit(req.user.id, req.user.fio, id, fio, 'update_user',
      { old: old.rows[0], new: { fio, role, status } });
    res.json({ message: 'Обновлено', employee: r.rows[0] });
  } catch(err) {
    if (err.code==='23505') return res.status(400).json({ message: 'Логин занят' });
    res.status(500).json({ message: 'Ошибка' });
  }
};

exports.resetEmployeePassword = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const r = await pool.query('UPDATE users SET password=NULL WHERE id=$1 RETURNING id,fio',[id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не найден' });
    await audit(req.user.id, req.user.fio, id, r.rows[0].fio, 'reset_password');
    res.json({ message: 'Пароль сброшен' });
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.deleteEmployee = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.user.role === 'moderator') return res.status(403).json({ message: 'Нет прав' });
  const client = await pool.connect();
  const tableExists = async (table) => {
    const r = await client.query('SELECT to_regclass($1) AS table_name', [table]);
    return Boolean(r.rows[0].table_name);
  };
  const deleteIfExists = async (table, where, params) => {
    if (await tableExists(table)) await client.query(`DELETE FROM ${table} WHERE ${where}`, params);
  };
  const updateIfExists = async (table, set, where, params) => {
    if (await tableExists(table)) await client.query(`UPDATE ${table} SET ${set} WHERE ${where}`, params);
  };
  try {
    const check = await client.query('SELECT id, fio, role FROM users WHERE id=$1', [id]);
    if (!check.rows.length) return res.status(404).json({ message: 'Сотрудник не найден' });
    const emp = check.rows[0];

    // Prevent deleting yourself
    if (id === req.user.id) return res.status(400).json({ message: 'Нельзя удалить себя' });

    await client.query('BEGIN');

    // Clean up all related data before deleting user
    await client.query('DELETE FROM moderator_staff WHERE moderator_id=$1 OR staff_id=$1', [id]);
    await client.query('DELETE FROM shift_type_user_overrides WHERE user_id=$1', [id]);
    await client.query('DELETE FROM shift_limit_type_exceptions WHERE user_id=$1', [id]);
    await client.query('DELETE FROM shift_limit_exceptions WHERE user_id=$1', [id]);
    await client.query('DELETE FROM notifications WHERE user_id=$1', [id]);
    await client.query('DELETE FROM staff_comments WHERE staff_id=$1 OR author_id=$1', [id]);
    await client.query('DELETE FROM test_results WHERE user_id=$1 OR added_by=$1', [id]);
    await client.query('DELETE FROM change_requests WHERE user_id=$1', [id]);
    await client.query('UPDATE change_requests SET processed_by=NULL WHERE processed_by=$1', [id]);
    await client.query('UPDATE shift_entries SET created_by=NULL WHERE created_by=$1', [id]);
    await client.query('UPDATE schedule_weeks SET approved_by=NULL WHERE approved_by=$1', [id]);
    await client.query('DELETE FROM shift_entries WHERE user_id=$1', [id]);
    await deleteIfExists('free_time', 'user_id=$1', [id]);
    await client.query('DELETE FROM work_logs WHERE user_id=$1', [id]);
    await deleteIfExists('user_documents', 'user_id=$1', [id]);
    await updateIfExists('tasks', 'assigned_to=NULL', 'assigned_to=$1', [id]);
    await updateIfExists('tasks', 'created_by=NULL', 'created_by=$1', [id]);

    // Now delete the user
    await client.query('DELETE FROM users WHERE id=$1', [id]);
    await client.query('COMMIT');

    await audit(req.user.id, req.user.fio, id, emp.fio, 'delete_user', { role: emp.role });
    res.json({ message: 'Сотрудник удалён' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteEmployee error:', err);
    res.status(500).json({ message: 'Ошибка удаления: ' + err.message });
  } finally {
    client.release();
  }
};

exports.setModeratorStaff = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  const { moderator_ids } = req.body;
  if (!Array.isArray(moderator_ids)) return res.status(400).json({ message: 'moderator_ids обязателен' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM moderator_staff WHERE staff_id=$1',[staffId]);
    for (const mid of moderator_ids)
      await client.query('INSERT INTO moderator_staff (moderator_id,staff_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[mid,staffId]);
    await client.query('COMMIT');
    res.json({ message: 'Обновлено' });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Ошибка' }); }
  finally { client.release(); }
};

exports.getMyStaff = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id,u.username,u.fio,u.role,u.status FROM users u
      JOIN moderator_staff ms ON ms.staff_id=u.id
      WHERE ms.moderator_id=$1 ORDER BY u.fio ASC`, [req.user.id]);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── COMMENTS ─────────────────────────────────────────────────────────────────
exports.addComment = async (req, res) => {
  const staffId = parseInt(req.params.id, 10);
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'Текст обязателен' });
  try {
    const r = await pool.query(
      'INSERT INTO staff_comments (staff_id,author_id,body) VALUES ($1,$2,$3) RETURNING *',
      [staffId, req.user.id, body.trim()]);
    res.json({ message: 'Добавлен', comment: r.rows[0] });
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.deleteComment = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try { await pool.query('DELETE FROM staff_comments WHERE id=$1',[id]); res.json({ message: 'Удалено' }); }
  catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── TEST RESULTS ──────────────────────────────────────────────────────────────
exports.addTestResult = async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { test_name, score, comment } = req.body;
  if (!test_name?.trim()) return res.status(400).json({ message: 'Название теста обязательно' });
  try {
    const r = await pool.query(
      'INSERT INTO test_results (user_id,added_by,test_name,score,comment) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [userId, req.user.id, test_name.trim(), score||null, comment||null]);
    res.json({ message: 'Добавлено', result: r.rows[0] });
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.deleteTestResult = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try { await pool.query('DELETE FROM test_results WHERE id=$1',[id]); res.json({ message: 'Удалено' }); }
  catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
exports.getAuditLog = async (req, res) => {
  const { target_id } = req.query;
  try {
    let q = 'SELECT * FROM audit_log';
    const params = [];
    if (target_id) { q += ' WHERE target_id=$1'; params.push(target_id); }
    q += ' ORDER BY created_at DESC LIMIT 100';
    res.json((await pool.query(q, params)).rows);
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── SHIFT TYPES ───────────────────────────────────────────────────────────────
exports.getShiftTypes = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT st.*,
        COALESCE(json_agg(DISTINCT str.role) FILTER (WHERE str.role IS NOT NULL),'[]') AS allowed_roles,
        COALESCE(json_agg(DISTINCT jsonb_build_object('user_id',stuo.user_id,'type',stuo.type,'fio',u2.fio))
          FILTER (WHERE stuo.user_id IS NOT NULL),'[]') AS user_overrides
      FROM shift_types st
      LEFT JOIN shift_type_roles str ON str.shift_type_id=st.id
      LEFT JOIN shift_type_user_overrides stuo ON stuo.shift_type_id=st.id
      LEFT JOIN users u2 ON u2.id=stuo.user_id
      WHERE st.is_active=true GROUP BY st.id ORDER BY st.is_free ASC, st.start_time ASC NULLS LAST`);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.createShiftType = async (req, res) => {
  const { name, start_time, end_time, color, allowed_roles, is_free } = req.body;
  if (!name) return res.status(400).json({ message: 'name обязателен' });
  if (!is_free && (!start_time||!end_time)) return res.status(400).json({ message: 'Время обязательно для фиксированной смены' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      'INSERT INTO shift_types (name,start_time,end_time,color,is_free) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, is_free?null:start_time, is_free?null:end_time, color||'#3b82f6', !!is_free]);
    const stId = r.rows[0].id;
    if (Array.isArray(allowed_roles))
      for (const role of allowed_roles)
        await client.query('INSERT INTO shift_type_roles (shift_type_id,role) VALUES ($1,$2) ON CONFLICT DO NOTHING',[stId,role]);
    await client.query('COMMIT');
    res.json({ message: 'Создан', shift_type: r.rows[0] });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Ошибка' }); }
  finally { client.release(); }
};

exports.updateShiftType = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, start_time, end_time, color, allowed_roles, is_free } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE shift_types SET name=$1,start_time=$2,end_time=$3,color=$4,is_free=$5 WHERE id=$6',
      [name, is_free?null:start_time, is_free?null:end_time, color||'#3b82f6', !!is_free, id]);
    await client.query('DELETE FROM shift_type_roles WHERE shift_type_id=$1',[id]);
    if (Array.isArray(allowed_roles))
      for (const role of allowed_roles)
        await client.query('INSERT INTO shift_type_roles (shift_type_id,role) VALUES ($1,$2) ON CONFLICT DO NOTHING',[id,role]);
    await client.query('COMMIT');
    res.json({ message: 'Обновлено' });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Ошибка' }); }
  finally { client.release(); }
};

exports.deleteShiftType = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try { await pool.query('UPDATE shift_types SET is_active=false WHERE id=$1',[id]); res.json({ message: 'Удалено' }); }
  catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── LIMITS ────────────────────────────────────────────────────────────────────
exports.getShiftLimits = async (req, res) => {
  try {
    const limits = await pool.query('SELECT * FROM shift_limits ORDER BY role ASC');
    const exceptions = await pool.query(`
      SELECT sle.*,u.fio,u.role as user_role,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id',st.id,'name',st.name,'color',st.color))
          FILTER (WHERE st.id IS NOT NULL),'[]') AS extra_shift_types
      FROM shift_limit_exceptions sle
      JOIN users u ON u.id=sle.user_id
      LEFT JOIN shift_limit_type_exceptions slte ON slte.user_id=sle.user_id
      LEFT JOIN shift_types st ON st.id=slte.shift_type_id
      GROUP BY sle.id,u.fio,u.role ORDER BY u.fio ASC`);
    res.json({ limits: limits.rows, exceptions: exceptions.rows });
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.putShiftLimits = async (req, res) => {
  const { limits } = req.body;
  if (!Array.isArray(limits)) return res.status(400).json({ message: 'limits обязателен' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of limits)
      await client.query(
        `INSERT INTO shift_limits (role,min_shifts_per_week,max_shifts_per_week) VALUES ($1,$2,$3)
         ON CONFLICT (role) DO UPDATE SET min_shifts_per_week=$2,max_shifts_per_week=$3`,
        [r.role, r.min_shifts_per_week||0, r.max_shifts_per_week||5]);
    await client.query('COMMIT');
    res.json((await pool.query('SELECT * FROM shift_limits ORDER BY role')).rows);
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Ошибка' }); }
  finally { client.release(); }
};

exports.upsertLimitException = async (req, res) => {
  const { user_id, min_shifts_per_week, max_shifts_per_week, note, extra_shift_type_ids } = req.body;
  if (!user_id) return res.status(400).json({ message: 'user_id обязателен' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO shift_limit_exceptions (user_id,min_shifts_per_week,max_shifts_per_week,note)
       VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE
       SET min_shifts_per_week=$2,max_shifts_per_week=$3,note=$4`,
      [user_id, min_shifts_per_week||0, max_shifts_per_week||99, note||null]);
    // Update extra shift types
    await client.query('DELETE FROM shift_limit_type_exceptions WHERE user_id=$1',[user_id]);
    if (Array.isArray(extra_shift_type_ids))
      for (const stid of extra_shift_type_ids)
        await client.query('INSERT INTO shift_limit_type_exceptions (user_id,shift_type_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[user_id,stid]);
    await client.query('COMMIT');
    res.json({ message: 'Сохранено' });
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Ошибка' }); }
  finally { client.release(); }
};

exports.deleteLimitException = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const r = await pool.query('SELECT user_id FROM shift_limit_exceptions WHERE id=$1',[id]);
    if (r.rows.length) await pool.query('DELETE FROM shift_limit_type_exceptions WHERE user_id=$1',[r.rows[0].user_id]);
    await pool.query('DELETE FROM shift_limit_exceptions WHERE id=$1',[id]);
    res.json({ message: 'Удалено' });
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── SCAN ──────────────────────────────────────────────────────────────────────
exports.scanAction = async (req, res) => {
  const { place, code, action } = req.body;
  if (!place||!['in','out'].includes(action)) return res.status(400).json({ message: 'place и action обязательны' });
  try {
    await pool.query(
      'INSERT INTO work_logs (user_id,fio,place,event_type) VALUES ($1,$2,$3,$4)',
      [req.user?.id||null, req.user?.fio||null, place, action==='in'?'check_in':'check_out']);
    res.json({ message: action==='in'?'Вход зафиксирован':'Выход зафиксирован' });
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.getWorkLogs = async (req, res) => {
  const { date, user_id } = req.query;
  try {
    let q = `SELECT wl.*,u.fio as user_fio,u.role as user_role FROM work_logs wl LEFT JOIN users u ON u.id=wl.user_id WHERE 1=1`;
    const params = [];
    if (date) { params.push(date); q += ` AND DATE(wl.created_at)=$${params.length}`; }
    if (user_id) { params.push(user_id); q += ` AND wl.user_id=$${params.length}`; }
    q += ' ORDER BY wl.created_at DESC LIMIT 200';
    res.json((await pool.query(q, params)).rows);
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

// ── STATS ─────────────────────────────────────────────────────────────────────
exports.getShiftStatsByUser = async (req, res) => {
  const year=parseInt(req.query.year,10), month=parseInt(req.query.month,10);
  if (isNaN(year)||isNaN(month)||month<1||month>12) return res.status(400).json({ message: 'year и month обязательны' });
  const s=new Date(Date.UTC(year,month-1,1)).toISOString().slice(0,10);
  const e=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  try {
    const r = await pool.query(
      `SELECT u.id,u.fio,u.role,COUNT(se.id)::int AS shift_count
       FROM users u LEFT JOIN shift_entries se ON se.user_id=u.id AND se.date>=$1 AND se.date<$2 AND se.status<>'declined'
       GROUP BY u.id ORDER BY u.fio ASC`, [s,e]);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};
