import type Database from 'better-sqlite3';
import { sha256Hex } from '../utils/canonical.js';
import type { IdentityRegistrationEvent } from './identityTypes.js';

// ── Cursor ──────────────────────────────────────────────────────────────

export function getCursor(
  db: Database.Database,
  chainId: number,
  registryAddress: string,
): bigint {
  const row = db
    .prepare('SELECT last_block FROM identity_cursor WHERE chain_id = ? AND registry_address = ?')
    .get(chainId, registryAddress.toLowerCase()) as { last_block: number } | undefined;
  return row ? BigInt(row.last_block) : 0n;
}

export function setCursor(
  db: Database.Database,
  chainId: number,
  registryAddress: string,
  lastBlock: bigint,
): void {
  db.prepare(
    `INSERT INTO identity_cursor (chain_id, registry_address, last_block, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(chain_id, registry_address) DO UPDATE SET
       last_block = excluded.last_block,
       updated_at = excluded.updated_at`,
  ).run(chainId, registryAddress.toLowerCase(), Number(lastBlock), Math.floor(Date.now() / 1000));
}

// ── Identity Events ─────────────────────────────────────────────────────

export function insertIdentityEvent(
  db: Database.Database,
  chainId: number,
  registryAddress: string,
  event: IdentityRegistrationEvent,
): void {
  const eventId = sha256Hex(
    `${chainId}:${event.txHash.toLowerCase()}:${event.logIndex}`,
  );
  db.prepare(
    `INSERT OR IGNORE INTO identity_events
     (event_id, chain_id, registry_address, agent_token_id, agent_uri, owner_address,
      event_type, block_number, tx_hash, log_index, discovered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    eventId,
    chainId,
    registryAddress.toLowerCase(),
    event.agentTokenId,
    event.agentUri,
    event.ownerAddress.toLowerCase(),
    event.eventType,
    Number(event.blockNumber),
    event.txHash.toLowerCase(),
    event.logIndex,
    Math.floor(Date.now() / 1000),
  );
}

export function getLatestEventForAgent(
  db: Database.Database,
  chainId: number,
  registryAddress: string,
  tokenId: string,
): IdentityEventRow | undefined {
  return db
    .prepare(
      `SELECT * FROM identity_events
       WHERE chain_id = ? AND registry_address = ? AND agent_token_id = ?
       ORDER BY block_number DESC LIMIT 1`,
    )
    .get(chainId, registryAddress.toLowerCase(), tokenId) as IdentityEventRow | undefined;
}

export function getDistinctAgentTokenIds(
  db: Database.Database,
  chainId: number,
  registryAddress: string,
): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT agent_token_id FROM identity_events
       WHERE chain_id = ? AND registry_address = ?
       ORDER BY agent_token_id`,
    )
    .all(chainId, registryAddress.toLowerCase()) as Array<{ agent_token_id: string }>;
  return rows.map((r) => r.agent_token_id);
}

// ── Identity Snapshots ──────────────────────────────────────────────────

export interface IdentitySnapshotRow {
  snapshot_id: string;
  agent_id: string;
  agent_uri: string;
  fetch_status: string;
  card_hash: string | null;
  card_json: string | null;
  fetched_at: number;
  http_status: number | null;
  error_message: string | null;
}

export function insertIdentitySnapshot(
  db: Database.Database,
  row: IdentitySnapshotRow,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO identity_snapshots
     (snapshot_id, agent_id, agent_uri, fetch_status, card_hash, card_json,
      fetched_at, http_status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.snapshot_id,
    row.agent_id,
    row.agent_uri,
    row.fetch_status,
    row.card_hash,
    row.card_json,
    row.fetched_at,
    row.http_status,
    row.error_message,
  );
}

export function getLatestIdentitySnapshots(
  db: Database.Database,
  agentId: string,
  limit = 10,
): IdentitySnapshotRow[] {
  return db
    .prepare(
      `SELECT * FROM identity_snapshots
       WHERE agent_id = ? ORDER BY fetched_at DESC LIMIT ?`,
    )
    .all(agentId, limit) as IdentitySnapshotRow[];
}

export function getDistinctCardHashes(
  db: Database.Database,
  agentId: string,
  sinceTimestamp: number,
): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT card_hash FROM identity_snapshots
       WHERE agent_id = ? AND fetched_at >= ? AND card_hash IS NOT NULL
       ORDER BY card_hash`,
    )
    .all(agentId, sinceTimestamp) as Array<{ card_hash: string }>;
  return rows.map((r) => r.card_hash);
}

// ── Row type for events ─────────────────────────────────────────────────

export interface IdentityEventRow {
  event_id: string;
  chain_id: number;
  registry_address: string;
  agent_token_id: string;
  agent_uri: string;
  owner_address: string;
  event_type: string;
  block_number: number;
  tx_hash: string;
  log_index: number;
  discovered_at: number;
}
