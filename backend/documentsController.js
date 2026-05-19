const pool = require('./db.js');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

async function ensureDocumentSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      created_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_documents (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
      category_id INT REFERENCES document_categories(id) ON DELETE SET NULL,
      access_scope VARCHAR(16) NOT NULL DEFAULT 'owner',
      display_name VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(128),
      file_size BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query('ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL');
  await pool.query('ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS category_id INT REFERENCES document_categories(id) ON DELETE SET NULL');
  await pool.query("ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS access_scope VARCHAR(16) NOT NULL DEFAULT 'owner'");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_access (
      document_id INT NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, user_id)
    )
  `);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(UPLOADS_DIR, String(req.user.id));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-а-яА-ЯёЁ ]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});

exports.upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Разрешены только PDF-файлы'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

exports.listCategories = async (req, res) => {
  try {
    await ensureDocumentSchema();
    const r = await pool.query('SELECT * FROM document_categories ORDER BY name ASC');
    res.json(r.rows);
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ message: 'Ошибка загрузки разделов' });
  }
};

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  if (!['admin','moderator'].includes(req.user.role)) return res.status(403).json({ message: 'Нет прав' });
  if (!name?.trim()) return res.status(400).json({ message: 'Название обязательно' });
  try {
    await ensureDocumentSchema();
    const r = await pool.query(
      'INSERT INTO document_categories (name, created_by) VALUES ($1,$2) RETURNING *',
      [name.trim(), req.user.id]
    );
    res.json({ message: 'Раздел создан', category: r.rows[0] });
  } catch (err) {
    console.error('createCategory error:', err);
    res.status(500).json({ message: 'Ошибка создания раздела' });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    await ensureDocumentSchema();
    const isManager = ['admin','moderator'].includes(req.user.role);
    const params = isManager ? [] : [req.user.id];
    const where = isManager
      ? ''
      : `WHERE d.access_scope='all'
          OR d.user_id=$1
          OR EXISTS (SELECT 1 FROM document_access da WHERE da.document_id=d.id AND da.user_id=$1)`;
    const r = await pool.query(`
      SELECT d.*, c.name AS category_name, u.fio AS uploaded_by_fio,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', au.id, 'fio', au.fio))
          FILTER (WHERE au.id IS NOT NULL), '[]') AS access_users
      FROM user_documents d
      LEFT JOIN document_categories c ON c.id=d.category_id
      LEFT JOIN users u ON u.id=d.uploaded_by
      LEFT JOIN document_access da ON da.document_id=d.id
      LEFT JOIN users au ON au.id=da.user_id
      ${where}
      GROUP BY d.id, c.name, u.fio
      ORDER BY c.name ASC NULLS LAST, d.created_at DESC
    `, params);
    res.json(r.rows);
  } catch (err) {
    console.error('listDocuments error:', err);
    res.status(500).json({ message: 'Ошибка загрузки документов' });
  }
};

exports.listDocumentsAdmin = async (req, res) => {
  return exports.listDocuments(req, res);
};

exports.uploadDocument = async (req, res) => {
  if (!['admin','moderator'].includes(req.user.role)) return res.status(403).json({ message: 'Нет прав' });
  const cleanup = () => {
    if (req.file) {
      const filePath = path.join(UPLOADS_DIR, String(req.user.id), req.file.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
  };
  try {
    await ensureDocumentSchema();
    if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });
    const categoryId = Number(req.body.category_id);
    if (!categoryId) { cleanup(); return res.status(400).json({ message: 'Выберите раздел' }); }
    const accessScope = req.body.access_scope === 'specific' ? 'specific' : 'all';
    const accessUserIds = JSON.parse(req.body.access_user_ids || '[]');
    if (accessScope === 'specific' && (!Array.isArray(accessUserIds) || accessUserIds.length === 0)) {
      cleanup();
      return res.status(400).json({ message: 'Выберите сотрудников для доступа' });
    }

    const { originalname, filename, mimetype, size } = req.file;
    const displayName = (req.body.display_name || '').trim() || originalname;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO user_documents
         (user_id, uploaded_by, category_id, access_scope, display_name, original_name, stored_name, mime_type, file_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.user.id, req.user.id, categoryId, accessScope, displayName, originalname, filename, mimetype, size]
      );
      if (accessScope === 'specific') {
        for (const userId of accessUserIds) {
          await client.query(
            'INSERT INTO document_access (document_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [r.rows[0].id, Number(userId)]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ message: 'Загружено', document: r.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      cleanup();
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ message: 'Ошибка сохранения документа: ' + err.message });
  }
};

async function getAccessibleDocument(docId, req) {
  const r = await pool.query('SELECT * FROM user_documents WHERE id=$1', [docId]);
  if (!r.rows.length) return null;
  const doc = r.rows[0];
  if (['admin','moderator'].includes(req.user.role) || doc.user_id === req.user.id || doc.access_scope === 'all') return doc;
  const access = await pool.query('SELECT 1 FROM document_access WHERE document_id=$1 AND user_id=$2', [docId, req.user.id]);
  return access.rows.length ? doc : false;
}

exports.downloadDocument = async (req, res) => {
  try {
    await ensureDocumentSchema();
    const docId = parseInt(req.params.id, 10);
    const doc = await getAccessibleDocument(docId, req);
    if (doc === null) return res.status(404).json({ message: 'Документ не найден' });
    if (doc === false) return res.status(403).json({ message: 'Нет доступа' });
    const filePath = path.join(UPLOADS_DIR, String(doc.user_id), doc.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Файл не найден на сервере' });
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка скачивания' });
  }
};

exports.deleteDocument = async (req, res) => {
  if (!['admin','moderator'].includes(req.user.role)) return res.status(403).json({ message: 'Нет прав' });
  try {
    await ensureDocumentSchema();
    const docId = parseInt(req.params.id, 10);
    const r = await pool.query('SELECT * FROM user_documents WHERE id=$1', [docId]);
    if (!r.rows.length) return res.status(404).json({ message: 'Не найден' });
    const doc = r.rows[0];
    const filePath = path.join(UPLOADS_DIR, String(doc.user_id), doc.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM user_documents WHERE id=$1', [docId]);
    res.json({ message: 'Удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка удаления' });
  }
};
