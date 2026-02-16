import type Database from 'better-sqlite3';
import type { IdentityEventSource } from './identityTypes.js';
import type { IdentityConfig } from './identityConfig.js';
import { getCursor, setCursor, insertIdentityEvent } from './identityStore.js';

export interface PollResult {
  fromBlock: bigint;
  toBlock: bigint;
  eventsFound: number;
  skipped: boolean;
}

/**
 * Reorg-safe identity event poller.
 *
 * - Reads cursor from DB, applies overlap for reorg safety
 * - Respects confirmations (only polls finalized blocks)
 * - Events stored idempotently via INSERT OR IGNORE
 * - Cursor advanced to toBlock after successful batch
 */
export async function pollIdentityEvents(
  db: Database.Database,
  source: IdentityEventSource,
  config: IdentityConfig,
): Promise<PollResult> {
  const cursor = getCursor(db, config.chainId, config.registryAddress);
  const latestBlock = await source.getLatestBlockNumber();

  // fromBlock: max(startBlock, cursor - overlap)
  const cursorMinusOverlap = cursor > BigInt(config.overlapBlocks)
    ? cursor - BigInt(config.overlapBlocks)
    : 0n;
  const fromBlock = cursor === 0n
    ? BigInt(config.startBlock)
    : (cursorMinusOverlap > BigInt(config.startBlock) ? cursorMinusOverlap : BigInt(config.startBlock));

  // toBlock: min(fromBlock + batchSize - 1, latestBlock - confirmations)
  const safeHead = latestBlock - BigInt(config.confirmations);
  const batchEnd = fromBlock + BigInt(config.batchSize) - 1n;
  const toBlock = batchEnd < safeHead ? batchEnd : safeHead;

  if (fromBlock > toBlock) {
    return { fromBlock, toBlock, eventsFound: 0, skipped: true };
  }

  const events = await source.getRegistrationEvents(fromBlock, toBlock);

  for (const event of events) {
    insertIdentityEvent(db, config.chainId, config.registryAddress, event);
  }

  setCursor(db, config.chainId, config.registryAddress, toBlock);

  return { fromBlock, toBlock, eventsFound: events.length, skipped: false };
}
