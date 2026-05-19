/**
 * Migration script — adds new tables without dropping existing data
 * Run: node scripts/migrate.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db.js');

async function migrate() {
  console.log('🔄 Running migrations...');

  try {
    // Documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_documents (
        id            SERIAL PRIMARY KEY,
        user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        uploaded_by   INT REFERENCES users(id) ON DELETE SET NULL,
        category_id   INT,
        access_scope  VARCHAR(16) NOT NULL DEFAULT 'owner',
        display_name  VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name   VARCHAR(255) NOT NULL,
        mime_type     VARCHAR(128),
        file_size     BIGINT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query('ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL');
    await pool.query('ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS category_id INT');
    await pool.query("ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS access_scope VARCHAR(16) NOT NULL DEFAULT 'owner'");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_documents_category_fk') THEN
          ALTER TABLE user_documents ADD CONSTRAINT user_documents_category_fk
          FOREIGN KEY (category_id) REFERENCES document_categories(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_access (
        document_id INT NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, user_id)
      )
    `);
    console.log('✅ user_documents table ready');

    // Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        description TEXT,
        assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
        created_by  INT REFERENCES users(id) ON DELETE SET NULL,
        due_date    DATE,
        priority    VARCHAR(32) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
        status      VARCHAR(32) DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','done','suggested','rejected')),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
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
    console.log('✅ tasks table ready');

    // Ensure admin user has password set (default: admin123)
    const adminCheck = await pool.query(
      "SELECT id, password FROM users WHERE role='admin' ORDER BY id LIMIT 1"
    );
    if (adminCheck.rows.length > 0 && !adminCheck.rows[0].password) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, adminCheck.rows[0].id]);
      console.log('✅ Admin password set to: admin123');
    } else if (adminCheck.rows.length > 0) {
      console.log('✅ Admin password already set');
    }

    console.log('\n✅ All migrations completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

migrate();
