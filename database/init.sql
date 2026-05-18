-- Call Center MVP v3
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS test_results CASCADE;
DROP TABLE IF EXISTS staff_comments CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS change_requests CASCADE;
DROP TABLE IF EXISTS free_time CASCADE;
DROP TABLE IF EXISTS shift_entries CASCADE;
DROP TABLE IF EXISTS schedule_weeks CASCADE;
DROP TABLE IF EXISTS shift_type_user_overrides CASCADE;
DROP TABLE IF EXISTS shift_type_roles CASCADE;
DROP TABLE IF EXISTS shift_types CASCADE;
DROP TABLE IF EXISTS shift_limit_exceptions CASCADE;
DROP TABLE IF EXISTS shift_limit_type_exceptions CASCADE;
DROP TABLE IF EXISTS shift_limits CASCADE;
DROP TABLE IF EXISTS moderator_staff CASCADE;
DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS qr_places CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE,
  fio VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('admin','moderator','operator','stajer','uchenik')),
  status BOOLEAN DEFAULT TRUE,
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE moderator_staff (
  moderator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (moderator_id, staff_id)
);

CREATE TABLE qr_places (
  id SERIAL PRIMARY KEY,
  place VARCHAR(255) NOT NULL,
  code  VARCHAR(128) NOT NULL UNIQUE,
  link  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shift_types (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(128) NOT NULL,
  start_time TIME,
  end_time   TIME,
  color      VARCHAR(32) DEFAULT '#3b82f6',
  is_active  BOOLEAN DEFAULT TRUE,
  is_free    BOOLEAN DEFAULT FALSE  -- "свободная смена" — сотрудник сам задаёт время
);

CREATE TABLE shift_type_roles (
  id            SERIAL PRIMARY KEY,
  shift_type_id INT NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  role          VARCHAR(32) NOT NULL,
  UNIQUE (shift_type_id, role)
);

CREATE TABLE shift_type_user_overrides (
  id            SERIAL PRIMARY KEY,
  shift_type_id INT NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(16) NOT NULL CHECK (type IN ('allow','deny')),
  UNIQUE (shift_type_id, user_id)
);

CREATE TABLE schedule_weeks (
  id          SERIAL PRIMARY KEY,
  start_date  DATE NOT NULL UNIQUE,
  status      VARCHAR(32) DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  approved_by INT REFERENCES users(id)
);

CREATE TABLE shift_entries (
  id               SERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  shift_type_id    INT NOT NULL REFERENCES shift_types(id),
  week_id          INT REFERENCES schedule_weeks(id),
  custom_start     TIME,   -- для свободной смены
  custom_end       TIME,   -- для свободной смены
  comment          TEXT,
  status           VARCHAR(32) DEFAULT 'pending',
  created_by       INT REFERENCES users(id),
  UNIQUE (user_id, date)
);

CREATE TABLE shift_limits (
  role                VARCHAR(32) PRIMARY KEY,
  min_shifts_per_week INT NOT NULL DEFAULT 0,
  max_shifts_per_week INT NOT NULL DEFAULT 5
);

CREATE TABLE shift_limit_exceptions (
  id      SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  min_shifts_per_week INT NOT NULL DEFAULT 0,
  max_shifts_per_week INT NOT NULL DEFAULT 99,
  note    TEXT,
  UNIQUE (user_id)
);

-- Extra shift types allowed for specific user (exception)
CREATE TABLE shift_limit_type_exceptions (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_type_id INT NOT NULL REFERENCES shift_types(id) ON DELETE CASCADE,
  UNIQUE (user_id, shift_type_id)
);

CREATE TABLE change_requests (
  id                      SERIAL PRIMARY KEY,
  user_id                 INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_entry_id          INT REFERENCES shift_entries(id) ON DELETE SET NULL,
  requested_date          DATE,
  requested_shift_type_id INT REFERENCES shift_types(id),
  type                    VARCHAR(32) NOT NULL,
  new_data                JSONB DEFAULT '{}',
  user_comment            TEXT,
  status                  VARCHAR(32) DEFAULT 'pending',
  admin_comment           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  processed_at            TIMESTAMPTZ,
  processed_by            INT REFERENCES users(id)
);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  kind       VARCHAR(64) DEFAULT 'info',
  ref_id     INT,
  ref_type   VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments on staff members
CREATE TABLE staff_comments (
  id         SERIAL PRIMARY KEY,
  staff_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id  INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test results for staff
CREATE TABLE test_results (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by   INT NOT NULL REFERENCES users(id),
  test_name  VARCHAR(255) NOT NULL,
  score      VARCHAR(64),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log: who changed what
CREATE TABLE audit_log (
  id          SERIAL PRIMARY KEY,
  actor_id    INT REFERENCES users(id) ON DELETE SET NULL,
  actor_fio   VARCHAR(255),
  target_id   INT REFERENCES users(id) ON DELETE SET NULL,
  target_fio  VARCHAR(255),
  action      VARCHAR(128) NOT NULL,
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  fio        VARCHAR(255),
  place      TEXT,
  event_type VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed
INSERT INTO shift_limits (role, min_shifts_per_week, max_shifts_per_week) VALUES
  ('admin',0,99),('moderator',0,10),('operator',1,6),('stajer',1,4),('uchenik',0,3)
ON CONFLICT DO NOTHING;

INSERT INTO users (username, fio, role, status, password) VALUES
  ('admin','Администратор Системы','admin',true,'$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (username) DO NOTHING;

INSERT INTO shift_types (name, start_time, end_time, color, is_free) VALUES
  ('Утренняя','08:00','14:00','#10b981',false),
  ('Дневная','14:00','20:00','#3b82f6',false),
  ('Ночная','20:00','08:00','#8b5cf6',false),
  ('Свободная',NULL,NULL,'#f59e0b',true)
ON CONFLICT DO NOTHING;

-- Documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(128),
  file_size     BIGINT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
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
);
