CREATE TABLE IF NOT EXISTS app_users (
  google_sub TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS milestones (
  name TEXT PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS teams (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Otros',
  seniority TEXT NOT NULL DEFAULT 'N/A',
  modality TEXT NOT NULL DEFAULT 'Interno',
  manager TEXT NOT NULL DEFAULT '',
  initial_team TEXT NOT NULL DEFAULT 'Sin Equipo',
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  warning BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL REFERENCES milestones(name) ON DELETE CASCADE,
  team_name TEXT NOT NULL REFERENCES teams(name),
  rotation_type TEXT NOT NULL DEFAULT 'indefinida' CHECK (rotation_type IN ('indefinida', 'acotada')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, milestone)
);

CREATE TABLE IF NOT EXISTS role_needs (
  milestone TEXT NOT NULL REFERENCES milestones(name) ON DELETE CASCADE,
  team_name TEXT NOT NULL REFERENCES teams(name) ON DELETE CASCADE,
  role TEXT NOT NULL,
  required_count INTEGER NOT NULL CHECK (required_count >= 0),
  PRIMARY KEY (milestone, team_name, role)
);

CREATE TABLE IF NOT EXISTS need_sets (
  milestone TEXT NOT NULL REFERENCES milestones(name) ON DELETE CASCADE,
  team_name TEXT NOT NULL REFERENCES teams(name) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (milestone, team_name)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  actor_sub TEXT REFERENCES app_users(google_sub) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);

CREATE TABLE IF NOT EXISTS board_snapshots (
  id BIGSERIAL PRIMARY KEY,
  created_by TEXT REFERENCES app_users(google_sub) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);
