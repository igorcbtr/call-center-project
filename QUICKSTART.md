# 🚀 Быстрый старт — Колл-центр MVP

## Шаг 1: База данных (5 минут)

```bash
# Создайте БД PostgreSQL
psql -U postgres
CREATE DATABASE call_center_mvp;
\q

# Инициализируйте схему
psql -U postgres -d call_center_mvp -f database/init.sql
```

## Шаг 2: Бэкенд (2 минуты)

```bash
cd backend
cp .env.example .env
# Отредактируйте .env — укажите параметры подключения к БД
npm install
npm start
```

**Бэкенд запустится на:** http://localhost:3002

## Шаг 3: Фронтенд (2 минуты)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

**Фронтенд запустится на:** http://localhost:5173

## Шаг 4: Первый вход

Откройте http://localhost:5173 и войдите:

- **Логин:** `admin`
- **Пароль:** `admin123`

⚠️ **Важно:** Смените пароль после первого входа!

---

## 🔧 Полезные команды

### Сброс пароля администратора
```bash
cd backend
npm run reset-admin              # Сбросить на admin123
npm run reset-admin myPassword   # Установить свой пароль
```

### Проверка работы
```bash
# Проверить бэкенд
curl http://localhost:3002/api/users

# Открыть документацию
open http://localhost:3002/docs
```

---

## 📚 Что дальше?

1. **Создайте сотрудников** — Раздел "Сотрудники" → кнопка "Добавить"
2. **Назначьте смены** — Раздел "График" → кликните на ячейку календаря
3. **Изучите документацию** — Кнопка "📚 Документация" в шапке

---

## ❓ Проблемы?

### Ошибка подключения к БД
- Проверьте, что PostgreSQL запущен: `pg_isready`
- Проверьте параметры в `backend/.env`

### Порт занят
- Измените `PORT` в `backend/.env`
- Измените `VITE_API_URL` в `frontend/.env`

### Смены не отображаются
- Откройте консоль браузера (F12)
- Проверьте логи: должны быть сообщения "✅ Loaded entries: X"
- Обновите страницу (Ctrl+R)

---

## 📞 Поддержка

Полная документация: http://localhost:3002/docs (после запуска бэкенда)
