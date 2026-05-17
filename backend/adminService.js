const pool = require('./db.js');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * QR-локация (демо)
 */
exports.createQrPlace = async (req, res) => {
  const { place } = req.body;

  if (!place || place.trim() === '') {
    return res.status(400).json({ message: 'Название места обязательно' });
  }

  try {
    const code = `QR_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const base = process.env.PUBLIC_URL || 'http://localhost:3002';
    const link = `${base}/front/html/scan.html?place=${encodeURIComponent(place)}&code=${encodeURIComponent(code)}`;

    return res.json({
      place: place.trim(),
      code,
      link,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Ошибка при создании QR:', err);
    res.status(500).json({ message: 'Ошибка при создании QR кода' });
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, fio, role, status FROM users ORDER BY fio ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка при получении сотрудников:', err);
    res.status(500).json({ message: 'Ошибка при получении сотрудников' });
  }
};

exports.getEmployeeById = async (req, res) => {
  const { id } = req.params;
  const employeeId = parseInt(id, 10);

  if (isNaN(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Неверный ID сотрудника' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, fio, role, status FROM users WHERE id = $1',
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка при получении сотрудника:', err);
    res.status(500).json({ message: 'Ошибка при получении сотрудника' });
  }
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { fio, role, status, username } = req.body;

  const employeeId = parseInt(id, 10);

  if (isNaN(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Неверный ID сотрудника' });
  }

  if (!fio || !role) {
    return res.status(400).json({ message: 'ФИО и роль обязательны' });
  }

  const validRoles = ['admin', 'moderator', 'operator', 'stajer', 'uchenik'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Неверная роль' });
  }

  const statusBool = status === true || status === 'true';

  try {
    const result = await pool.query(
      `UPDATE users SET fio = $1, role = $2, status = $3, username = COALESCE($4, username)
       WHERE id = $5 RETURNING id, username, fio, role, status`,
      [fio.trim(), role, statusBool, username || null, employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    res.json({
      message: 'Сотрудник успешно обновлён',
      employee: result.rows[0],
    });
  } catch (err) {
    console.error('Ошибка при обновлении сотрудника:', err);
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Логин уже занят' });
    }
    res.status(500).json({ message: 'Ошибка при обновлении сотрудника' });
  }
};

exports.createEmployee = async (req, res) => {
  const { fio, role, status, username, password } = req.body;

  if (!fio || !role) {
    return res.status(400).json({ message: 'ФИО и роль обязательны' });
  }

  const validRoles = ['admin', 'moderator', 'operator', 'stajer', 'uchenik'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Неверная роль' });
  }

  const statusBool = status === true || status === 'true';

  try {
    let passwordHash = null;
    if (password && String(password).length > 0) {
      passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
    }

    const result = await pool.query(
      `INSERT INTO users (username, fio, role, status, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, fio, role, status`,
      [username || null, fio.trim(), role, statusBool, passwordHash]
    );

    res.json({
      message: 'Сотрудник успешно добавлен',
      employee: result.rows[0],
    });
  } catch (err) {
    console.error('Ошибка при добавлении сотрудника:', err);
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Логин уже занят' });
    }
    res.status(500).json({ message: 'Ошибка при добавлении сотрудника' });
  }
};

exports.resetEmployeePassword = async (req, res) => {
  const { id } = req.params;

  const employeeId = parseInt(id, 10);

  if (isNaN(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Неверный ID сотрудника' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET password = NULL WHERE id = $1 RETURNING id, fio',
      [employeeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    res.json({
      message: 'Пароль успешно сброшен. Сотрудник должен зарегистрироваться заново',
      employee: result.rows[0],
    });
  } catch (err) {
    console.error('Ошибка при сбросе пароля:', err);
    res.status(500).json({ message: 'Ошибка при сбросе пароля' });
  }
};

exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;

  const employeeId = parseInt(id, 10);

  if (isNaN(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Неверный ID сотрудника' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, fio', [employeeId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Сотрудник не найден' });
    }

    res.json({
      message: 'Сотрудник успешно удалён',
      employee: result.rows[0],
    });
  } catch (err) {
    console.error('Ошибка при удалении сотрудника:', err);
    res.status(500).json({ message: 'Ошибка при удалении сотрудника' });
  }
};

/**
 * Shifts per user in a calendar month (for charts)
 */
exports.getShiftStatsByUser = async (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: 'year and month (1-12) required' });
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  try {
    const result = await pool.query(
      `SELECT u.id, u.fio, COUNT(se.id)::int AS shift_count
       FROM users u
       LEFT JOIN shift_entries se ON se.user_id = u.id
         AND se.date >= $1 AND se.date < $2
         AND se.status <> 'declined'
       GROUP BY u.id, u.fio
       ORDER BY u.fio ASC`,
      [startStr, endStr]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('stats:', err);
    res.status(500).json({ message: 'Ошибка статистики' });
  }
};
