-- Call Center MVP schema (PostgreSQL)
-- Database: call_center_mvp

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS statistics_events CASCADE;
DROP TABLE IF EXISTS dispute_requests CASCADE;
DROP TABLE IF EXISTS change_requests CASCADE;
DROP TABLE IF EXISTS free_time CASCADE;
DROP TABLE IF EXISTS shift_entries CASCADE;
DROP TABLE IF EXISTS schedule_weeks CASCADE;
DROP TABLE IF EXISTS shift_type_user_overrides CASCADE;
DROP TABLE IF EXISTS shift_type_roles CASCADE;
DROP TABLE IF EXISTS shift_types CASCADE;
DROP TABLE IF EXISTS shift_limits CASCADE;
DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE,
  fio VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'moderator', 'operator', 'stajer', 'uchenik')),
  status BOOLEAN DEFAULT TRUE,
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shift_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color VARCHAR(32) DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE shift_type_roles (
  id SERIAL PRIMARY KEY,
  shift_type_id INT NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL,
  UNIQUE (shift_type_id, role)
);

CREATE TABLE shift_type_user_overrides (
  id SERIAL PRIMARY KEY,
  shift_type_id INT NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL CHECK (type IN ('allow', 'deny')),
  UNIQUE (shift_type_id, user_id)
);

CREATE TABLE schedule_weeks (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL UNIQUE,
  status VARCHAR(32) DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  approved_by INT REFERENCES users(id)
);

CREATE TABLE shift_entries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_type_id INT NOT NULL REFERENCES shift_types(id),
  week_id INT REFERENCES schedule_weeks(id),
  comment TEXT,
  is_uncertain BOOLEAN DEFAULT FALSE,
  status VARCHAR(32) DEFAULT 'pending',
  created_by_admin BOOLEAN DEFAULT FALSE,
  UNIQUE (user_id, date)
);

CREATE TABLE free_time (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  kind VARCHAR(64) DEFAULT 'personal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shift_limits (
  role VARCHAR(32) PRIMARY KEY CHECK (role IN ('admin', 'moderator', 'operator', 'stajer', 'uchenik')),
  max_shifts_per_week INT NOT NULL DEFAULT 5
);

CREATE TABLE change_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_entry_id INT REFERENCES shift_entries(id) ON DELETE SET NULL,
  requested_date DATE,
  requested_shift_type_id INT REFERENCES shift_types(id),
  type VARCHAR(32) NOT NULL,
  new_data JSONB DEFAULT '{}',
  user_comment TEXT,
  status VARCHAR(32) DEFAULT 'pending',
  admin_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by INT REFERENCES users(id)
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  kind VARCHAR(64) DEFAULT 'info',
  ref_id INT,
  ref_type VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispute_requests (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  payload JSONB DEFAULT '{}',
  status VARCHAR(32) DEFAULT 'stub',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE statistics_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(64),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  fio VARCHAR(255),
  place TEXT,
  event_type VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default data
INSERT INTO shift_limits (role, max_shifts_per_week) VALUES
  ('admin', 99),
  ('moderator', 10),
  ('operator', 6),
  ('stajer', 4),
  ('uchenik', 3)
ON CONFLICT (role) DO NOTHING;

-- Default admin user (password: admin123)
INSERT INTO users (username, fio, role, status, password) VALUES
  ('admin', 'Администратор Системы', 'admin', true, '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (username) DO NOTHING;

-- Default shift types
INSERT INTO shift_types (name, start_time, end_time, color) VALUES
  ('Утренняя', '08:00', '14:00', '#10b981'),
  ('Дневная', '14:00', '20:00', '#3b82f6'),
  ('Ночная', '20:00', '08:00', '#8b5cf6')
ON CONFLICT DO NOTHING;
