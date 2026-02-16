CREATE TABLE IF NOT EXISTS context_cursor (
  agent_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  last_block INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (agent_id, chain_id)
);
