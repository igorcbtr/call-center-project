require('dotenv').config();
const pool = require('./db.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * USERS - public list for legacy (minimal fields)
 */
exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, fio, role, status, password FROM users WHERE status = true ORDER BY fio ASC'
    );

    const users = result.rows.map((u) => ({
      id: u.id,
      username: u.username,
      fio: u.fio,
      role: u.role,
      hasPassword: !!u.password,
    }));

    res.json(users);
  } catch (err) {
    console.error('Ошибка при загрузке пользователей:', err);
    res.status(500).json({
      message: 'Ошибка сервера при загрузке пользователей',
      users: [],
    });
  }
};

/**
 * Current user from DB (JWT id)
 */
exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, fio, role, status FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('me:', err);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

/**
 * LOGIN + JWT — login matches username OR fio
 */
exports.login = async (req, res) => {
  const { login, username, password } = req.body; const loginField = login || username;

  try {
    if (!loginField || !password) {
      return res.status(400).json({ message: 'Логин и пароль обязательны' });
    }

    const result = await pool.query(
      `SELECT id, username, fio, role, status, password FROM users
       WHERE username = $1 OR fio = $1`,
      [loginField]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден в системе' });
    }

    const user = result.rows[0];

    if (!user.status) {
      return res.status(403).json({ message: 'Ваш аккаунт отключён администратором' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Пароль не установлен. Используйте регистрацию' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Неверный пароль' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        fio: user.fio,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Успешный вход',
      role: user.role,
      token,
      id: user.id,
      fio: user.fio,
      username: user.username,
    });
  } catch (err) {
    console.error('Ошибка при входе:', err);
    res.status(500).json({ message: 'Ошибка сервера. Попробуйте позже' });
  }
};

/**
 * REGISTER — first-time password for pre-created user (by username or fio)
 */
exports.register = async (req, res) => {
  const { login, username, password } = req.body; const loginField = login || username;

  try {
    if (!loginField || !password) {
      return res.status(400).json({ message: 'Логин и пароль обязательны' });
    }

    const result = await pool.query(
      'SELECT id, fio, password, status FROM users WHERE username = $1 OR fio = $1',
      [loginField]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден в системе' });
    }

    const user = result.rows[0];

    if (!user.status) {
      return res.status(403).json({ message: 'Ваш аккаунт отключён администратором' });
    }

    if (user.password) {
      return res.status(400).json({ message: 'Пароль уже установлен. Используйте вход' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const updateResult = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, fio',
      [hash, user.id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ message: 'Ошибка при сохранении пароля' });
    }

    res.json({ message: 'Пароль успешно установлен. Пожалуйста, войдите' });
  } catch (err) {
    console.error('Ошибка при регистрации:', err);
    res.status(500).json({ message: 'Ошибка сервера. Попробуйте позже' });
  }
};
