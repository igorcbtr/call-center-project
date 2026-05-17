# Колл-центр MVP — Система управления сотрудниками

## Быстрый старт

### Требования
- Node.js 18+
- PostgreSQL 14+
- npm

### 1. База данных
```bash
psql -U postgres
CREATE DATABASE call_center_mvp;
\q

psql -U postgres -d call_center_mvp -f database/init.sql
```

### 2. Бэкенд
```bash
cd backend
cp .env.example .env
# Отредактируйте .env — укажите данные PostgreSQL и JWT_SECRET

npm install
npm start
# Запущен на http://localhost:3002
```

### 3. Фронтенд
```bash
cd frontend
cp .env.example .env
# Проверьте VITE_API_URL=http://localhost:3002/api

npm install
npm run dev
# Открыть http://localhost:5173
```

### Дефолтный администратор
- Логин: `admin`
- Пароль: `admin123`

### Документация
После запуска бэкенда: http://localhost:3002/docs

## Структура проекта
```
mvp/
├── backend/          # Node.js + Express API
│   ├── server.js
│   ├── graficController.js
│   ├── adminService.js
│   └── ...
├── frontend/         # React + TypeScript
│   └── src/
│       ├── api/      # RTK Query
│       ├── features/ # Страницы и функции
│       └── layout/   # Шапка, боковое меню
├── database/
│   └── init.sql      # Схема PostgreSQL
└── docs/
    └── index.html    # Документация
```

## Роли
| Роль | Описание |
|------|----------|
| admin | Полный доступ, управление сотрудниками |
| moderator | Просмотр графика, заявки |
| operator | Просмотр графика, заявки |
| stajer | Просмотр графика, заявки |
| uchenik | Просмотр графика, заявки |
