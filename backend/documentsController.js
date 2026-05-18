/**
 * Documents controller — upload, list, download, delete user documents
 * Files are stored in backend/uploads/<user_id>/
 */
const pool = require('./db.js');
const path = require('path');
const fs   = require('fs');
const multer = require('multer');

const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage — per-user folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOADS_DIR, String(req.user.id));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Sanitize original name
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-а-яА-ЯёЁ ]/g, '_');
    const unique = `${Date.now()}_${safe}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  // Allow common document types
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Недопустимый тип файла. Разрешены: PDF, Word, Excel, изображения, текст'));
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// GET /documents — list user's documents
exports.listDocuments = async (req, res) => {
  try {
    // Auto-create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_documents (
        id            SERIAL PRIMARY KEY,
        user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_name  VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name   VARCHAR(255) NOT NULL,
        mime_type     VARCHAR(128),
        file_size     BIGINT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const userId = req.user.id;
    const r = await pool.query(
      'SELECT * FROM user_documents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('listDocuments error:', err);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
};

// GET /documents/admin/:userId — admin sees any user's docs
exports.listDocumentsAdmin = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const r = await pool.query(
      'SELECT * FROM user_documents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка' });
  }
};

// POST /documents/upload — upload a file
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });

    // Auto-create table if it doesn't exist (safety net)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_documents (
        id            SERIAL PRIMARY KEY,
        user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_name  VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name   VARCHAR(255) NOT NULL,
        mime_type     VARCHAR(128),
        file_size     BIGINT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { originalname, filename, mimetype, size } = req.file;
    const userId = req.user.id;
    const displayName = (req.body.display_name || '').trim() || originalname;

    const r = await pool.query(
      `INSERT INTO user_documents (user_id, display_name, original_name, stored_name, mime_type, file_size)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, displayName, originalname, filename, mimetype, size]
    );
    res.json({ message: 'Загружено', document: r.rows[0] });
  } catch (err) {
    console.error('uploadDocument error:', err);
    // If file was saved to disk but DB failed, clean it up
    if (req.file) {
      const filePath = path.join(UPLOADS_DIR, String(req.user?.id), req.file.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    res.status(500).json({ message: 'Ошибка сохранения документа: ' + err.message });
  }
};

// GET /documents/:id/download — download a file
exports.downloadDocument = async (req, res) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const isAdmin = ['admin', 'moderator'].includes(req.user.role);

    const r = await pool.query('SELECT * FROM user_documents WHERE id = $1', [docId]);
    if (!r.rows.length) return res.status(404).json({ message: 'Документ не найден' });

    const doc = r.rows[0];
    if (!isAdmin && doc.user_id !== userId)
      return res.status(403).json({ message: 'Нет доступа' });

    const filePath = path.join(UPLOADS_DIR, String(doc.user_id), doc.stored_name);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ message: 'Файл не найден на сервере' });

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка скачивания' });
  }
};

// DELETE /documents/:id — delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const isAdmin = ['admin', 'moderator'].includes(req.user.role);

    const r = await pool.query('SELECT * FROM user_documents WHERE id = $1', [docId]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не найден' });

    const doc = r.rows[0];
    if (!isAdmin && doc.user_id !== userId)
      return res.status(403).json({ message: 'Нет доступа' });

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, String(doc.user_id), doc.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM user_documents WHERE id = $1', [docId]);
    res.json({ message: 'Удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка удаления' });
  }
};
