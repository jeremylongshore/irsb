CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  created_at INTEGER,
  status TEXT DEFAULT 'ACTIVE',
  labels_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  observed_at INTEGER NOT NULL,
  signals_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_agent ON snapshots(agent_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  severity TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_json TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_alerts_agent ON alerts(agent_id, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS risk_reports (
  report_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(agent_id),
  generated_at INTEGER NOT NULL,
  overall_risk INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  report_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_agent ON risk_reports(agent_id, generated_at DESC);
