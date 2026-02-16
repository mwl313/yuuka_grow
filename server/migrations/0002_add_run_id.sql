ALTER TABLE runs ADD COLUMN run_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_run_id_unique ON runs(run_id) WHERE run_id IS NOT NULL;
