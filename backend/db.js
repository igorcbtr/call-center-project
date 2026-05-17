require('dotenv').config();
const { Pool } = require('pg');

/** macOS Postgres often has no "postgres" role — use your login name ($USER) */
function dbUser() {
  const fromEnv = process.env.DB_USER?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.USER) return process.env.USER;
  return 'postgres';
}

const pool = new Pool({
  user: dbUser(),
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'call_center_mvp',
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
});

module.exports = pool;