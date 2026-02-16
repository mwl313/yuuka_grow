ALTER TABLE runs ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN updated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_runs_is_hidden ON runs(is_hidden);
