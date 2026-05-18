/**
 * Скрипт проверки системы
 * Проверяет подключение к БД, наличие таблиц, администратора
 * 
 * Использование: node scripts/checkSystem.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db.js');

async function checkSystem() {
  console.log('🔍 Проверка системы...\n');

  try {
    // 1. Проверка подключения к БД
    console.log('1️⃣ Проверка подключения к PostgreSQL...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('   ✅ Подключение к БД успешно');
    console.log(`   📅 Время сервера: ${dbTest.rows[0].now}\n`);

    // 2. Проверка таблиц
    console.log('2️⃣ Проверка таблиц...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`   ✅ Найдено таблиц: ${tables.rows.length}`);
    tables.rows.forEach(t => console.log(`      - ${t.table_name}`));
    console.log('');

    // 3. Проверка администратора
    console.log('3️⃣ Проверка администратора...');
    const adminRes = await pool.query(
      "SELECT id, username, fio, role, status FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );
    if (adminRes.rows.length === 0) {
      console.log('   ⚠️  Администратор не найден!');
      console.log('   💡 Запустите: psql -U postgres -d call_center_mvp -f database/init.sql');
    } else {
      const admin = adminRes.rows[0];
      console.log('   ✅ Администратор найден:');
      console.log(`      ID: ${admin.id}`);
      console.log(`      ФИО: ${admin.fio}`);
      console.log(`      Логин: ${admin.username || 'не задан'}`);
      console.log(`      Статус: ${admin.status ? 'активен' : 'неактивен'}`);
    }
    console.log('');

    // 4. Статистика пользователей
    console.log('4️⃣ Статистика пользователей...');
    const userStats = await pool.query(`
      SELECT role, COUNT(*) as count, 
             SUM(CASE WHEN status = true THEN 1 ELSE 0 END) as active
      FROM users 
      GROUP BY role 
      ORDER BY role
    `);
    console.log('   Роль          | Всего | Активных');
    console.log('   --------------|-------|----------');
    userStats.rows.forEach(r => {
      const role = r.role.padEnd(13);
      const total = String(r.count).padStart(5);
      const active = String(r.active).padStart(8);
      console.log(`   ${role} | ${total} | ${active}`);
    });
    console.log('');

    // 5. Типы смен
    console.log('5️⃣ Типы смен...');
    const shiftTypes = await pool.query('SELECT id, name, start_time, end_time, is_active FROM shift_types ORDER BY id');
    if (shiftTypes.rows.length === 0) {
      console.log('   ⚠️  Типы смен не найдены!');
    } else {
      console.log(`   ✅ Найдено типов смен: ${shiftTypes.rows.length}`);
      shiftTypes.rows.forEach(st => {
        const status = st.is_active ? '✓' : '✗';
        const time = st.start_time && st.end_time ? `${st.start_time.slice(0,5)}–${st.end_time.slice(0,5)}` : 'свободная';
        console.log(`      ${status} ${st.name} (${time})`);
      });
    }
    console.log('');

    // 6. Смены за последние 7 дней
    console.log('6️⃣ Смены за последние 7 дней...');
    const recentShifts = await pool.query(`
      SELECT COUNT(*) as count 
      FROM shift_entries 
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    console.log(`   📊 Создано смен: ${recentShifts.rows[0].count}`);
    console.log('');

    // 7. Переменные окружения
    console.log('7️⃣ Переменные окружения...');
    console.log(`   PORT: ${process.env.PORT || 'не задан (по умолчанию 3002)'}`);
    console.log(`   DB_HOST: ${process.env.DB_HOST || 'не задан'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || 'не задан'}`);
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✓ задан' : '⚠️  не задан'}`);
    console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'не задан'}`);
    console.log('');

    console.log('✅ Проверка завершена успешно!');
    console.log('');
    console.log('🚀 Система готова к работе:');
    console.log(`   API: http://localhost:${process.env.PORT || 3002}/api`);
    console.log(`   Документация: http://localhost:${process.env.PORT || 3002}/docs`);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Ошибка проверки:', err.message);
    console.error('\n💡 Возможные причины:');
    console.error('   - PostgreSQL не запущен');
    console.error('   - Неверные параметры подключения в .env');
    console.error('   - База данных не инициализирована');
    console.error('\n🔧 Попробуйте:');
    console.error('   1. Проверить PostgreSQL: pg_isready');
    console.error('   2. Проверить .env файл');
    console.error('   3. Инициализировать БД: psql -U postgres -d call_center_mvp -f database/init.sql');
    await pool.end();
    process.exit(1);
  }
}

checkSystem();
