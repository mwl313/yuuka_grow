CREATE TABLE IF NOT EXISTS telemetry_sessions (
  session_id TEXT PRIMARY KEY,
  anon_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ended_at TEXT NULL,
  user_agent TEXT NULL,
  country TEXT NULL,
  referrer TEXT NULL
);

CREATE INDEX IF NOT EXISTS telemetry_sessions_anon_started ON telemetry_sessions(anon_id, started_at);

CREATE TABLE IF NOT EXISTS telemetry_daily (
  day TEXT NOT NULL,
  anon_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (day, anon_id)
);
