import type Database from 'better-sqlite3';

export function getContextCursor(
  db: Database.Database,
  agentId: string,
  chainId: number,
): bigint {
  const row = db
    .prepare('SELECT last_block FROM context_cursor WHERE agent_id = ? AND chain_id = ?')
    .get(agentId, chainId) as { last_block: number | bigint } | undefined;
  return row ? BigInt(row.last_block) : 0n;
}

export function setContextCursor(
  db: Database.Database,
  agentId: string,
  chainId: number,
  lastBlock: bigint,
): void {
  db.prepare(
    `INSERT INTO context_cursor (agent_id, chain_id, last_block, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(agent_id, chain_id) DO UPDATE SET last_block = excluded.last_block, updated_at = excluded.updated_at`,
  ).run(agentId, chainId, lastBlock, Math.floor(Date.now() / 1000));
}
