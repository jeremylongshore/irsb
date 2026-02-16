CREATE TABLE IF NOT EXISTS identity_cursor (
  chain_id INTEGER NOT NULL,
  registry_address TEXT NOT NULL,
  last_block INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chain_id, registry_address)
);

CREATE TABLE IF NOT EXISTS identity_events (
  event_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  registry_address TEXT NOT NULL,
  agent_token_id TEXT NOT NULL,
  agent_uri TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  discovered_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_identity_events_agent
  ON identity_events(chain_id, registry_address, agent_token_id, block_number DESC);

CREATE TABLE IF NOT EXISTS identity_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_uri TEXT NOT NULL,
  fetch_status TEXT NOT NULL,
  card_hash TEXT,
  card_json TEXT,
  fetched_at INTEGER NOT NULL,
  http_status INTEGER,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_identity_snapshots_agent
  ON identity_snapshots(agent_id, fetched_at DESC);
