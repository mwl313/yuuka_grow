CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  ending_category TEXT NOT NULL,
  ending_id TEXT NOT NULL,
  survival_days INTEGER NOT NULL,
  final_credits INTEGER NOT NULL,
  final_thigh_cm INTEGER NOT NULL,
  final_stage INTEGER NOT NULL,
  submitted_at_client TEXT NOT NULL,
  submitted_at_server TEXT NOT NULL,
  client_version TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_credits ON runs(final_credits DESC);
CREATE INDEX IF NOT EXISTS idx_runs_thigh ON runs(final_thigh_cm DESC);
CREATE INDEX IF NOT EXISTS idx_runs_share ON runs(share_id);
