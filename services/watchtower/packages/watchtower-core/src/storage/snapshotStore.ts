import type Database from 'better-sqlite3';
import type { Snapshot } from '../schemas/index.js';

export function insertSnapshot(db: Database.Database, snapshot: Snapshot): void {
  db.prepare(
    `INSERT OR IGNORE INTO snapshots (snapshot_id, agent_id, observed_at, signals_json)
     VALUES (?, ?, ?, ?)`,
  ).run(snapshot.snapshotId, snapshot.agentId, snapshot.observedAt, JSON.stringify(snapshot.signals));
}

export function getLatestSnapshots(
  db: Database.Database,
  agentId: string,
  limit = 20,
): Snapshot[] {
  const rows = db
    .prepare(
      `SELECT * FROM snapshots WHERE agent_id = ? ORDER BY observed_at DESC LIMIT ?`,
    )
    .all(agentId, limit) as Array<{
    snapshot_id: string;
    agent_id: string;
    observed_at: number;
    signals_json: string;
  }>;

  return rows.map((row) => ({
    snapshotId: row.snapshot_id,
    agentId: row.agent_id,
    observedAt: row.observed_at,
    signals: JSON.parse(row.signals_json),
  }));
}
