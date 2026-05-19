const pool = require('./db.js');
const { notifyAdmins, notifyUser } = require('./notificationHub.js');

function formatDateRu(value) {
  if (!value) return '';
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const source = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const [year, month, day] = source.split('-').map(Number);
  if (!year || !month || !day) return String(value);
  return `${day} ${months[month - 1]} ${year}`;
}

async function getAvailableShiftTypesForUser(userId) {
  const r = await pool.query(`
    SELECT DISTINCT st.*
    FROM shift_types st
    JOIN users u ON u.id=$1
    LEFT JOIN shift_type_roles str ON str.shift_type_id=st.id
    LEFT JOIN shift_limit_type_exceptions slte ON slte.shift_type_id=st.id AND slte.user_id=u.id
    LEFT JOIN shift_type_user_overrides allow_o ON allow_o.shift_type_id=st.id AND allow_o.user_id=u.id AND allow_o.type='allow'
    LEFT JOIN shift_type_user_overrides deny_o ON deny_o.shift_type_id=st.id AND deny_o.user_id=u.id AND deny_o.type='deny'
    WHERE st.is_active=true
      AND deny_o.id IS NULL
      AND (str.role=u.role OR slte.id IS NOT NULL OR allow_o.id IS NOT NULL)
    ORDER BY st.is_free ASC, st.start_time ASC NULLS LAST, st.name ASC
  `, [userId]);
  return r.rows;
}

async function userCanUseShiftType(userId, shiftTypeId) {
  const r = await pool.query(`
    SELECT 1
    FROM shift_types st
    JOIN users u ON u.id=$1
    LEFT JOIN shift_type_roles str ON str.shift_type_id=st.id AND str.role=u.role
    LEFT JOIN shift_limit_type_exceptions slte ON slte.shift_type_id=st.id AND slte.user_id=u.id
    LEFT JOIN shift_type_user_overrides allow_o ON allow_o.shift_type_id=st.id AND allow_o.user_id=u.id AND allow_o.type='allow'
    LEFT JOIN shift_type_user_overrides deny_o ON deny_o.shift_type_id=st.id AND deny_o.user_id=u.id AND deny_o.type='deny'
    WHERE st.id=$2 AND st.is_active=true AND deny_o.id IS NULL
      AND (str.id IS NOT NULL OR slte.id IS NOT NULL OR allow_o.id IS NOT NULL)
    LIMIT 1
  `, [userId, shiftTypeId]);
  return r.rows.length > 0;
}

exports.getShiftTypes = async (req, res) => {
  try {
    res.json(await getAvailableShiftTypesForUser(req.user.id));
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.getShiftTypeRoles = async (req, res) => {
  try {
    const r = await pool.query(`SELECT str.*,st.name AS shift_name FROM shift_type_roles str JOIN shift_types st ON st.id=str.shift_type_id ORDER BY st.name,str.role`);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.getAvailableShifts = async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: 'user_id обязателен' });
  try {
    const uid = parseInt(user_id, 10);
    if (!['admin','moderator'].includes(req.user.role) && req.user.id !== uid)
      return res.status(403).json({ message: 'Нет доступа' });
    res.json(await getAvailableShiftTypesForUser(uid));
  } catch(err) { res.status(500).json({ message: 'Ошибка' }); }
};

exports.createShiftEntry = async (req, res) => {
  const { user_id, date, shift_type_id, comment, custom_start, custom_end } = req.body;
  if (!user_id||!date||!shift_type_id) return res.status(400).json({ message: 'user_id, date, shift_type_id обязательны' });
  const uid = parseInt(user_id, 10);

  try {
    const stRes = await pool.query('SELECT * FROM shift_types WHERE id=$1', [shift_type_id]);
    if (!stRes.rows.length) return res.status(404).json({ message: 'Тип смены не найден' });
    if (!(await userCanUseShiftType(uid, shift_type_id)))
      return res.status(403).json({ message: 'Этот тип смены недоступен выбранному сотруднику' });
    const st = stRes.rows[0];

    const today = new Date(date);
    const sow = new Date(today); sow.setDate(today.getDate() - ((today.getDay()+6)%7));
    let wRes = await pool.query('SELECT id FROM schedule_weeks WHERE start_date=$1',[sow.toISOString().slice(0,10)]);
    let weekId;
    if (!wRes.rows.length) {
      const cw = await pool.query('INSERT INTO schedule_weeks (start_date,status) VALUES ($1,$2) RETURNING id',[sow.toISOString().slice(0,10),'draft']);
      weekId = cw.rows[0].id;
    } else weekId = wRes.rows[0].id;

    const r = await pool.query(
      `INSERT INTO shift_entries (user_id,date,shift_type_id,week_id,custom_start,custom_end,comment,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8) RETURNING *`,
      [uid, date, shift_type_id, weekId,
       st.is_free ? (custom_start||null) : null,
       st.is_free ? (custom_end||null) : null,
       comment||null, req.user?.id||null]);

    if (['admin','moderator'].includes(req.user?.role) && req.user.id !== uid) {
      await notifyUser(uid, 'Вам назначена смена', `Смена «${st.name}» на ${formatDateRu(date)}`, 'shift', r.rows[0].id, 'shift_entry');
    }
    res.json({ message: 'Создана', entry: r.rows[0] });
  } catch(err) {
    if (err.code==='23505') return res.status(400).json({ message: 'На эту дату уже есть смена' });
    console.error(err); res.status(500).json({ message: 'Ошибка' });
  }
};

exports.updateShiftEntry = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { shift_type_id, comment, custom_start, custom_end } = req.body;
  if (!shift_type_id) return res.status(400).json({ message: 'shift_type_id обязателен' });
  try {
    const stRes = await pool.query('SELECT is_free,name FROM shift_types WHERE id=$1',[shift_type_id]);
    const isFree = stRes.rows[0]?.is_free;
    const entryRes = await pool.query('SELECT user_id FROM shift_entries WHERE id=$1', [id]);
    if (!entryRes.rows.length) return res.status(404).json({ message: 'Не найдено' });
    if (!(await userCanUseShiftType(entryRes.rows[0].user_id, shift_type_id)))
      return res.status(403).json({ message: 'Этот тип смены недоступен выбранному сотруднику' });
    const r = await pool.query(
      'UPDATE shift_entries SET shift_type_id=$1,comment=$2,custom_start=$3,custom_end=$4 WHERE id=$5 RETURNING *',
      [shift_type_id, comment||null, isFree?(custom_start||null):null, isFree?(custom_end||null):null, id]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не найдено' });
    const entry = r.rows[0];
    const shiftName = stRes.rows[0]?.name || 'смена';
    const commentText = comment?.trim() ? ` Комментарий: ${comment.trim()}` : '';
    await notifyUser(
      entry.user_id,
      'Смена изменена',
      `Смена «${shiftName}» на ${formatDateRu(entry.date)} обновлена.${commentText}`,
      'shift',
      id,
      'shift_entry'
    );
    res.json({ message: 'Обновлена', entry });
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

exports.getUserSchedule = async (req, res) => {
  const { user_id, start_date, end_date } = req.body;
  if (!user_id||!start_date||!end_date) return res.status(400).json({ message: 'Обязательные поля' });
  const uid = parseInt(user_id, 10);
  if (req.user.role!=='admin' && req.user.role!=='moderator' && req.user.id!==uid)
    return res.status(403).json({ message: 'Нет доступа' });
  try {
    const r = await pool.query(
      `SELECT se.id, se.user_id, se.shift_type_id, se.week_id, se.comment, se.status,
              se.custom_start, se.custom_end, se.created_by,
              TO_CHAR(se.date, 'YYYY-MM-DD') AS date,
              st.name as shift_name,st.start_time,st.end_time,st.color,st.is_free
       FROM shift_entries se LEFT JOIN shift_types st ON st.id=se.shift_type_id
       WHERE se.user_id=$1 AND se.date BETWEEN $2 AND $3 ORDER BY se.date ASC`,
      [uid, start_date, end_date]);
    res.json(r.rows);
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

exports.getAllSchedules = async (req, res) => {
  const { start_date, end_date } = req.body;
  if (!start_date||!end_date) return res.status(400).json({ message: 'Даты обязательны' });
  // Allow all authenticated employees to view shared schedule calendar
  if (!req.user?.id)
    return res.status(403).json({ message: 'Нет доступа' });
  try {
    const r = await pool.query(
      `SELECT se.id, se.user_id, se.shift_type_id, se.week_id, se.comment, se.status,
              se.custom_start, se.custom_end,
              TO_CHAR(se.date, 'YYYY-MM-DD') AS date,
              u.fio, u.role as user_role,
              st.name as shift_name, st.start_time, st.end_time, st.color, st.is_free
       FROM shift_entries se 
       JOIN users u ON u.id=se.user_id 
       LEFT JOIN shift_types st ON st.id=se.shift_type_id
       WHERE se.date BETWEEN $1 AND $2 
       ORDER BY se.date ASC, u.fio ASC`,
      [start_date, end_date]);
    const crResult = await pool.query(
      `SELECT cr.*,
              TO_CHAR(cr.requested_date, 'YYYY-MM-DD') AS requested_date,
              u.fio as user_fio,
              st.name as shift_name, st.color,
              rst.name as requested_shift_name, rst.color as requested_color,
              TO_CHAR(se.date, 'YYYY-MM-DD') AS entry_date
       FROM change_requests cr 
       JOIN users u ON cr.user_id=u.id
       LEFT JOIN shift_entries se ON cr.shift_entry_id=se.id
       LEFT JOIN shift_types st ON se.shift_type_id=st.id
       LEFT JOIN shift_types rst ON cr.requested_shift_type_id=rst.id
       WHERE cr.status='pending' 
         AND (cr.requested_date BETWEEN $1 AND $2 OR se.date BETWEEN $1 AND $2)
       ORDER BY cr.created_at ASC`,
      [start_date, end_date]);
    res.json({ entries: r.rows, changeRequests: crResult.rows });
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

// Public schedule - all entries for a period (for staff calendar view)
exports.getPublicSchedule = async (req, res) => {
  const { start_date, end_date } = req.body;
  if (!start_date||!end_date) return res.status(400).json({ message: 'Даты обязательны' });
  try {
    const r = await pool.query(
      `SELECT se.id, se.user_id, se.shift_type_id, se.week_id, se.comment, se.status,
              se.custom_start, se.custom_end,
              TO_CHAR(se.date, 'YYYY-MM-DD') AS date,
              u.fio,u.role as user_role,st.name as shift_name,st.start_time,st.end_time,st.color,st.is_free
       FROM shift_entries se JOIN users u ON u.id=se.user_id LEFT JOIN shift_types st ON st.id=se.shift_type_id
       WHERE se.date BETWEEN $1 AND $2 ORDER BY se.date ASC`,
      [start_date, end_date]);
    res.json(r.rows);
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

exports.deleteShiftEntry = async (req, res) => {
  const { entry_id } = req.body;
  if (!entry_id) return res.status(400).json({ message: 'entry_id обязателен' });
  try {
    const er = await pool.query('SELECT * FROM shift_entries WHERE id=$1',[entry_id]);
    if (!er.rows.length) return res.status(404).json({ message: 'Не найдено' });
    await pool.query('DELETE FROM shift_entries WHERE id=$1',[entry_id]);
    const st = await pool.query('SELECT name FROM shift_types WHERE id=$1',[er.rows[0].shift_type_id]);
    await notifyUser(er.rows[0].user_id,'Смена удалена',`Смена «${st.rows[0]?.name||''}» на ${formatDateRu(er.rows[0].date)} удалена`,'warning');
    res.json({ message: 'Удалена' });
  } catch(err) { console.error(err); res.status(500).json({ message: 'Ошибка' }); }
};

exports.respondShiftEntry = async (req, res) => {
  const id = parseInt(req.params.id,10);
  const { action } = req.body;
  if (!['confirm','decline'].includes(action)) return res.status(400).json({ message: 'action: confirm|decline' });
  try {
    const r = await pool.query('UPDATE shift_entries SET status=$1 WHERE id=$2 RETURNING *',
      [action==='confirm'?'confirmed':'declined', id]);
    res.json({ message:'OK', entry:r.rows[0] });
  } catch(err) { res.status(500).json({ message:'Ошибка' }); }
};

exports.approveWeek = async (req, res) => {
  const { week_id, admin_id } = req.body;
  if (!week_id||!admin_id) return res.status(400).json({ message: 'week_id, admin_id обязательны' });
  try {
    await pool.query('BEGIN');
    await pool.query("UPDATE shift_entries SET status='approved' WHERE week_id=$1",[week_id]);
    const r = await pool.query("UPDATE schedule_weeks SET status='locked',approved_at=NOW(),approved_by=$1 WHERE id=$2 RETURNING *",[admin_id,week_id]);
    const users = await pool.query('SELECT DISTINCT user_id FROM shift_entries WHERE week_id=$1',[week_id]);
    for (const u of users.rows) await notifyUser(u.user_id,'График подтверждён','Ваш график на неделю подтверждён','success');
    await pool.query('COMMIT');
    res.json({ message:'Подтверждено', week:r.rows[0] });
  } catch(err) { await pool.query('ROLLBACK'); res.status(500).json({ message:'Ошибка' }); }
};

exports.createChangeRequest = async (req, res) => {
  const { user_id, shift_entry_id, requested_date, requested_shift_type_id, type, user_comment } = req.body;
  if (!user_id||!type) return res.status(400).json({ message: 'user_id и type обязательны' });
  try {
    if (requested_shift_type_id && !(await userCanUseShiftType(user_id, requested_shift_type_id)))
      return res.status(403).json({ message: 'Этот тип смены недоступен для вашей роли' });
    const r = await pool.query(
      `INSERT INTO change_requests (user_id,shift_entry_id,requested_date,requested_shift_type_id,type,user_comment,status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [user_id,shift_entry_id||null,requested_date||null,requested_shift_type_id||null,type,user_comment||null]);
    const uRes = await pool.query('SELECT fio FROM users WHERE id=$1',[user_id]);
    await notifyAdmins('Заявка на изменение смены',
      `${uRes.rows[0]?.fio||'Сотрудник'} запросил изменение${requested_date?` на ${requested_date}`:''}. Комментарий: ${user_comment||'—'}`,
      'warning', r.rows[0].id, 'change_request');
    res.json({ message:'Заявка создана', request:r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ message:'Ошибка' }); }
};

exports.getChangeRequests = async (req, res) => {
  const { status, date_from, date_to } = req.query;
  try {
    let q = `SELECT cr.*,u.fio as user_fio,u.role as user_role,
      se.date as entry_date,st.name as shift_name,st.color as shift_color,
      rst.name as requested_shift_name,rst.color as requested_shift_color
      FROM change_requests cr JOIN users u ON cr.user_id=u.id
      LEFT JOIN shift_entries se ON cr.shift_entry_id=se.id
      LEFT JOIN shift_types st ON se.shift_type_id=st.id
      LEFT JOIN shift_types rst ON cr.requested_shift_type_id=rst.id
      WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND cr.status=$${params.length}`; }
    if (date_from) { params.push(date_from); q += ` AND (cr.requested_date>=$${params.length} OR se.date>=$${params.length})`; }
    if (date_to) { params.push(date_to); q += ` AND (cr.requested_date<=$${params.length} OR se.date<=$${params.length})`; }
    q += ' ORDER BY cr.created_at DESC';
    res.json((await pool.query(q, params)).rows);
  } catch(err) { console.error(err); res.status(500).json({ message:'Ошибка' }); }
};

exports.processChangeRequest = async (req, res) => {
  const { request_id, status, admin_comment, admin_id, new_shift_type_id } = req.body;
  if (!request_id||!['approved','rejected'].includes(status)||!admin_id)
    return res.status(400).json({ message: 'Обязательные поля' });
  try {
    await pool.query('BEGIN');
    const crRes = await pool.query('SELECT * FROM change_requests WHERE id=$1',[request_id]);
    if (!crRes.rows.length) throw new Error('Не найдено');
    const cr = crRes.rows[0];
    const stId = new_shift_type_id||cr.requested_shift_type_id;
    if (status==='approved' && stId && !(await userCanUseShiftType(cr.user_id, stId))) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ message: 'Этот тип смены недоступен сотруднику' });
    }

    if (status==='approved') {
      if (cr.type==='edit'&&cr.shift_entry_id&&stId)
        await pool.query("UPDATE shift_entries SET shift_type_id=$1,status='approved' WHERE id=$2",[stId,cr.shift_entry_id]);
      else if (cr.type==='delete'&&cr.shift_entry_id)
        await pool.query('DELETE FROM shift_entries WHERE id=$1',[cr.shift_entry_id]);
      else if (cr.type==='new'&&cr.requested_date&&stId) {
        const today=new Date(cr.requested_date);
        const sow=new Date(today); sow.setDate(today.getDate()-((today.getDay()+6)%7));
        let wRes=await pool.query('SELECT id FROM schedule_weeks WHERE start_date=$1',[sow.toISOString().slice(0,10)]);
        let wId;
        if (!wRes.rows.length) { const cw=await pool.query('INSERT INTO schedule_weeks (start_date,status) VALUES ($1,$2) RETURNING id',[sow.toISOString().slice(0,10),'draft']); wId=cw.rows[0].id; }
        else wId=wRes.rows[0].id;
        await pool.query(`INSERT INTO shift_entries (user_id,date,shift_type_id,week_id,status) VALUES ($1,$2,$3,$4,'approved') ON CONFLICT (user_id,date) DO UPDATE SET shift_type_id=$3,status='approved'`,[cr.user_id,cr.requested_date,stId,wId]);
      }
    }

    await pool.query('UPDATE change_requests SET status=$1,admin_comment=$2,processed_at=NOW(),processed_by=$3 WHERE id=$4',
      [status,admin_comment||null,admin_id,request_id]);
    const txt = status==='approved'?'одобрена ✅':'отклонена ❌';
    await notifyUser(cr.user_id,`Заявка ${txt}`,
      `Ваша заявка ${txt}.${admin_comment?` Комментарий: ${admin_comment}`:''}`,
      status==='approved'?'success':'error', request_id,'change_request');

    await pool.query('COMMIT');
    res.json({ message:`Заявка ${status==='approved'?'одобрена':'отклонена'}` });
  } catch(err) { await pool.query('ROLLBACK'); console.error(err); res.status(500).json({ message:'Ошибка' }); }
};

exports.getShiftLimits = async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM shift_limits ORDER BY role ASC')).rows); }
  catch(err) { res.status(500).json({ message:'Ошибка' }); }
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
        [r.role,r.min_shifts_per_week||0,r.max_shifts_per_week||5]);
    await client.query('COMMIT');
    res.json((await pool.query('SELECT * FROM shift_limits ORDER BY role')).rows);
  } catch(err) { await client.query('ROLLBACK'); res.status(500).json({ message:'Ошибка' }); }
  finally { client.release(); }
};

exports.getNotifications = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id]);
    const u = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false',[req.user.id]);
    res.json({ notifications:r.rows, unread_count:parseInt(u.rows[0].count) });
  } catch(err) { res.status(500).json({ message:'Ошибка' }); }
};

exports.markNotificationsRead = async (req, res) => {
  const { ids } = req.body;
  try {
    if (ids?.length) await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1 AND id=ANY($2)',[req.user.id,ids]);
    else await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1',[req.user.id]);
    res.json({ message:'OK' });
  } catch(err) { res.status(500).json({ message:'Ошибка' }); }
};
