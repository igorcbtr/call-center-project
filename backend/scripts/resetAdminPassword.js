/**
 * Скрипт сброса пароля администратора
 * Использование: node scripts/resetAdminPassword.js [новый_пароль]
 * Если пароль не указан — используется 'admin123'
 *
 * Пример:
 *   node scripts/resetAdminPassword.js myNewPassword123
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db.js');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function resetAdminPassword() {
  const newPassword = process.argv[2] || 'admin123';

  if (newPassword.length < 6) {
    console.error('❌ Пароль должен быть минимум 6 символов');
    process.exit(1);
  }

  try {
    console.log('🔄 Подключение к базе данных...');

    // Найти администратора
    const adminRes = await pool.query(
      "SELECT id, username, fio FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );

    if (adminRes.rows.length === 0) {
      console.error('❌ Администратор не найден в базе данных');
      process.exit(1);
    }

    const admin = adminRes.rows[0];
    console.log(`👤 Найден администратор: ${admin.fio} (логин: ${admin.username || 'не задан'})`);

    // Хешировать новый пароль
    console.log('🔐 Хеширование пароля...');
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Обновить пароль
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, admin.id]);

    console.log('✅ Пароль администратора успешно сброшен!');
    console.log(`   Логин: ${admin.username || admin.fio}`);
    console.log(`   Новый пароль: ${newPassword}`);
    console.log('');
    console.log('⚠️  Не забудьте сменить пароль после входа в систему!');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    await pool.end();
    process.exit(1);
  }
}

resetAdminPassword();
