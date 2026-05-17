const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME,
});

async function reset() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Новый хеш:', hash);
  const r = await pool.query(
    "UPDATE users SET password=$1 WHERE username='admin' RETURNING id, username",
    [hash]
  );
  console.log('Обновлено:', r.rows);
  await pool.end();
}

reset().catch(console.error);
