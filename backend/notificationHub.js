const jwt = require('jsonwebtoken');
const pool = require('./db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const clients = new Map();

function addClient(userId, res) {
  const key = Number(userId);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
}

function removeClient(userId, res) {
  const key = Number(userId);
  const set = clients.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(key);
}

function emitToUser(userId, payload) {
  const set = clients.get(Number(userId));
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch {}
  }
}

async function notifyUser(userId, title, body, kind, refId, refType) {
  try {
    const r = await pool.query(
      `INSERT INTO notifications (user_id,title,body,kind,ref_id,ref_type)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, title, body, kind || 'info', refId || null, refType || null]
    );
    emitToUser(userId, { type: 'notification', notification: r.rows[0] });
    return r.rows[0];
  } catch (e) {
    console.error('notify error', e.message);
    return null;
  }
}

async function notifyAdmins(title, body, kind, refId, refType) {
  try {
    const admins = await pool.query("SELECT id FROM users WHERE role IN ('admin','moderator') AND status=true");
    for (const adm of admins.rows) {
      await notifyUser(adm.id, title, body, kind || 'info', refId || null, refType || null);
    }
  } catch (e) {
    console.error('notify admins error', e.message);
  }
}

function stream(req, res) {
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ message: 'Токен отсутствует' });
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Токен недействителен или истёк' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  addClient(user.id, res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(user.id, res);
  });
}

module.exports = { notifyUser, notifyAdmins, stream, emitToUser };
