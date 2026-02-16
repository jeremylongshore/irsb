import type Database from 'better-sqlite3';
import type { Agent } from '../schemas/index.js';

export function upsertAgent(db: Database.Database, agent: Agent): void {
  const status = agent.status ?? null;
  const labelsJson = agent.labels ? JSON.stringify(agent.labels) : null;

  db.prepare(
    `INSERT INTO agents (agent_id, created_at, status, labels_json)
     VALUES (?, ?, COALESCE(?, 'ACTIVE'), COALESCE(?, '[]'))
     ON CONFLICT(agent_id) DO UPDATE SET
       status = COALESCE(?, agents.status),
       labels_json = COALESCE(?, agents.labels_json)`,
  ).run(
    agent.agentId,
    agent.createdAt ?? Math.floor(Date.now() / 1000),
    status,
    labelsJson,
    status,
    labelsJson,
  );
}

export function getAgent(db: Database.Database, agentId: string): Agent | undefined {
  const row = db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as
    | { agent_id: string; created_at: number; status: string; labels_json: string }
    | undefined;

  if (!row) return undefined;

  return {
    agentId: row.agent_id,
    createdAt: row.created_at,
    status: row.status as Agent['status'],
    labels: JSON.parse(row.labels_json) as string[],
  };
}

export function listAgents(db: Database.Database): Agent[] {
  const rows = db.prepare('SELECT * FROM agents ORDER BY agent_id').all() as Array<{
    agent_id: string;
    created_at: number;
    status: string;
    labels_json: string;
  }>;

  return rows.map((row) => ({
    agentId: row.agent_id,
    createdAt: row.created_at,
    status: row.status as Agent['status'],
    labels: JSON.parse(row.labels_json) as string[],
  }));
}
