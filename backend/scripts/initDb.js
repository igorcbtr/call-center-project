/**
 * Creates schema and seeds MVP data (users, shift types, role access).
 * Usage: npm run init-db (from mvp/backend, with .env configured)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

function dbUser() {
  const fromEnv = process.env.DB_USER?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.USER) return process.env.USER;
  return 'postgres';
}

async function main() {
  const pool = new Pool({
    user: dbUser(),
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'call_center_mvp',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432),
  });

  const sqlPath = path.join(__dirname, '../../database/init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  const deleteIfExists = async (table) => {
    const exists = await client.query('SELECT to_regclass($1) AS table_name', [table]);
    if (exists.rows[0].table_name) await client.query(`DELETE FROM ${table}`);
  };

  try {
    console.log('Connecting as DB user:', dbUser(), '→ database:', process.env.DB_NAME || 'call_center_mvp');
    console.log('Running schema from', sqlPath);
    await client.query(sql);

    const adminHash = await bcrypt.hash('admin123', SALT_ROUNDS);
    const opHash = await bcrypt.hash('op123', SALT_ROUNDS);

    await deleteIfExists('shift_type_roles');
    await deleteIfExists('shift_type_user_overrides');
    await deleteIfExists('shift_limit_type_exceptions');
    await deleteIfExists('shift_limit_exceptions');
    await deleteIfExists('notifications');
    await deleteIfExists('staff_comments');
    await deleteIfExists('test_results');
    await deleteIfExists('audit_log');
    await deleteIfExists('change_requests');
    await deleteIfExists('shift_entries');
    await deleteIfExists('schedule_weeks');
    await deleteIfExists('free_time');
    await deleteIfExists('work_logs');
    await deleteIfExists('document_access');
    await deleteIfExists('user_documents');
    await deleteIfExists('document_categories');
    await deleteIfExists('task_attachments');
    await deleteIfExists('tasks');
    await deleteIfExists('qr_places');
    await deleteIfExists('shift_types');
    await deleteIfExists('users');

    const adminRes = await client.query(
      `INSERT INTO users (username, fio, role, status, password)
       VALUES ($1, $2, $3, true, $4) RETURNING id`,
      ['admin', 'Administrator', 'admin', adminHash]
    );
    const adminId = adminRes.rows[0].id;

    await client.query(
      `INSERT INTO users (username, fio, role, status, password)
       VALUES ($1, $2, $3, true, $4)`,
      ['operator', 'Operator Demo', 'operator', opHash]
    );

    const st = await client.query(
      `INSERT INTO shift_types (name, start_time, end_time, color) VALUES
       ('Утро', '08:00', '14:00', '#2563eb'),
       ('День', '14:00', '20:00', '#0d9488'),
       ('Вечер', '20:00', '02:00', '#7c3aed')
       RETURNING id, name`
    );

    const ids = st.rows.map((r) => r.id);
    const rolesForAll = ['admin', 'moderator', 'operator'];
    for (const sid of ids) {
      for (const role of rolesForAll) {
        await client.query(
          `INSERT INTO shift_type_roles (shift_type_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [sid, role]
        );
      }
    }

    await client.query(
      `INSERT INTO shift_type_roles (shift_type_id, role) VALUES ($1, 'stajer'), ($2, 'stajer'), ($3, 'uchenik')
       ON CONFLICT DO NOTHING`,
      [ids[0], ids[1], ids[0]]
    );

    await client.query(
      `INSERT INTO work_logs (user_id, fio, place, event_type) VALUES ($1, 'Administrator', 'system', 'db_init')`,
      [adminId]
    );

    console.log('Seeded users: admin / admin123, operator / op123');
    console.log('Done.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
