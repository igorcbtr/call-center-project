const pool = require('./db.js');

/**
 * 🔍 СТАТУС ПОСЛЕДНЕГО СОБЫТИЯ
 */
exports.getStatus = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "user_id не указан" });
  }

  // Парсим user_id в число
  const userId = parseInt(user_id, 10);
  
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ message: "user_id должен быть числом больше 0" });
  }

  try {
    const result = await pool.query(
      `SELECT event_type 
       FROM work_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ status: "out" });
    }

    return res.json({
      status: result.rows[0].event_type // in / out
    });

  } catch (err) {
    console.error('Ошибка при получении статуса:', err);
    res.status(500).json({ message: "Ошибка БД при получении статуса" });
  }
};

/**
 * 🟢 CHECK IN - начало смены
 */
exports.checkIn = async (req, res) => {
  const { user_id, fio, place } = req.body;

  if (!user_id || !fio || !place) {
    return res.status(400).json({ message: "Не указаны необходимые данные (user_id, fio, place)" });
  }

  // Парсим user_id в число
  const userId = parseInt(user_id, 10);
  
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ message: "user_id должен быть числом больше 0" });
  }

  try {
    // ❗ защита от повторного входа
    const last = await pool.query(
      `SELECT event_type
       FROM work_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (last.rows.length > 0 && last.rows[0].event_type === "in") {
      return res.status(400).json({ message: "Вы уже на смене. Завершите текущую смену" });
    }

    const insertResult = await pool.query(
      `INSERT INTO work_logs (user_id, fio, place, event_type, created_at)
       VALUES ($1, $2, $3, 'in', NOW())
       RETURNING id, created_at`,
      [userId, fio, place]
    );

    if (insertResult.rows.length === 0) {
      return res.status(500).json({ message: "Ошибка при записи в БД" });
    }

    res.json({ 
      message: "Смена начата",
      timestamp: insertResult.rows[0].created_at
    });

  } catch (err) {
    console.error('Ошибка при check-in:', err);
    res.status(500).json({ message: "Ошибка БД при начале смены" });
  }
};

/**
 * 🔴 CHECK OUT - конец смены
 */
exports.checkOut = async (req, res) => {
  const { user_id, fio, place } = req.body;

  if (!user_id || !fio || !place) {
    return res.status(400).json({ message: "Не указаны необходимые данные (user_id, fio, place)" });
  }

  // Парсим user_id в число
  const userId = parseInt(user_id, 10);
  
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ message: "user_id должен быть числом больше 0" });
  }

  try {
    // ❗ нельзя выйти если не вошёл
    const last = await pool.query(
      `SELECT event_type
       FROM work_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (last.rows.length === 0 || last.rows[0].event_type !== "in") {
      return res.status(400).json({ message: "Вы не на смене. Начните смену" });
    }

    const insertResult = await pool.query(
      `INSERT INTO work_logs (user_id, fio, place, event_type, created_at)
       VALUES ($1, $2, $3, 'out', NOW())
       RETURNING id, created_at`,
      [userId, fio, place]
    );

    if (insertResult.rows.length === 0) {
      return res.status(500).json({ message: "Ошибка при записи в БД" });
    }

    res.json({ 
      message: "Смена завершена",
      timestamp: insertResult.rows[0].created_at
    });

  } catch (err) {
    console.error('Ошибка при check-out:', err);
    res.status(500).json({ message: "Ошибка БД при завершении смены" });
  }
};

/**
 * 📡 QR OPEN LOG - логирование открытия QR
 */
exports.markQrOpen = async (req, res) => {
  const { place, code } = req.body;

  if (!place || !code) {
    return res.status(400).json({ message: "Не указаны place и code" });
  }

  try {
    const insertResult = await pool.query(
      `INSERT INTO work_logs (place, event_type, created_at)
       VALUES ($1, 'qr_open', NOW())
       RETURNING id, created_at`,
      [place]
    );

    if (insertResult.rows.length === 0) {
      return res.status(500).json({ message: "Ошибка при записи в БД" });
    }

    res.json({ 
      ok: true,
      timestamp: insertResult.rows[0].created_at
    });

  } catch (err) {
    console.error('Ошибка при markQrOpen:', err);
    res.status(500).json({ message: "Ошибка БД при логировании QR" });
  }
};