import type Database from 'better-sqlite3';
import type { Signal } from '../schemas/index.js';
import type { IdentityConfig } from './identityConfig.js';
import type { CardFetchResult } from './identityTypes.js';
import { sortEvidence } from '../utils/sort.js';
import {
  getLatestEventForAgent,
  getDistinctCardHashes,
} from './identityStore.js';
import { parseAgentId } from './identityTypes.js';

interface SignalContext {
  agentId: string;
  fetchResult: CardFetchResult;
  agentUri: string;
}

/**
 * Derive deterministic identity signals for an agent.
 *
 * Level 1 signals:
 * - ID_NEWBORN: agent registered less than config.newbornAgeSeconds ago
 * - ID_CARD_UNREACHABLE: card fetch failed (UNREACHABLE/TIMEOUT/SSRF_BLOCKED)
 * - ID_CARD_SCHEMA_INVALID: card JSON fails Zod validation
 * - ID_CARD_CHURN: more than config.churnThreshold distinct card hashes in config.churnWindowSeconds
 */
export function deriveIdentitySignals(
  db: Database.Database,
  ctx: SignalContext,
  config: IdentityConfig,
  observedAt: number,
): Signal[] {
  const signals: Signal[] = [];
  const parsed = parseAgentId(ctx.agentId);
  if (!parsed) return signals;

  const baseEvidence = [
    { type: 'agentId', ref: ctx.agentId },
    { type: 'registryAddress', ref: parsed.registryAddress },
    { type: 'tokenId', ref: parsed.tokenId },
  ];

  // ID_NEWBORN: check if agent registration is recent
  const latestEvent = getLatestEventForAgent(
    db,
    parsed.chainId,
    parsed.registryAddress,
    parsed.tokenId,
  );
  if (latestEvent) {
    // Estimate registration time from block number (rough: ~12s per block on Ethereum)
    // We use the discovered_at timestamp since we don't have block timestamps in our store
    const ageSeconds = observedAt - latestEvent.discovered_at;
    if (ageSeconds < config.newbornAgeSeconds) {
      signals.push({
        signalId: 'ID_NEWBORN',
        severity: 'MEDIUM',
        weight: 0.3,
        observedAt,
        evidence: sortEvidence([
          ...baseEvidence,
          { type: 'ageSeconds', ref: String(ageSeconds) },
          { type: 'blockNumber', ref: String(latestEvent.block_number) },
        ]),
      });
    }
  }

  // ID_CARD_UNREACHABLE: fetch failed
  if (
    ctx.fetchResult.status === 'UNREACHABLE' ||
    ctx.fetchResult.status === 'TIMEOUT' ||
    ctx.fetchResult.status === 'SSRF_BLOCKED'
  ) {
    signals.push({
      signalId: 'ID_CARD_UNREACHABLE',
      severity: 'HIGH',
      weight: 0.8,
      observedAt,
      evidence: sortEvidence([
        ...baseEvidence,
        { type: 'agentUri', ref: ctx.agentUri },
        { type: 'fetchStatus', ref: ctx.fetchResult.status },
        ...(ctx.fetchResult.error ? [{ type: 'error', ref: ctx.fetchResult.error }] : []),
      ]),
    });
  }

  // ID_CARD_SCHEMA_INVALID: card JSON fails Zod parse
  if (ctx.fetchResult.status === 'INVALID_SCHEMA') {
    signals.push({
      signalId: 'ID_CARD_SCHEMA_INVALID',
      severity: 'HIGH',
      weight: 0.8,
      observedAt,
      evidence: sortEvidence([
        ...baseEvidence,
        { type: 'agentUri', ref: ctx.agentUri },
        ...(ctx.fetchResult.error ? [{ type: 'validationError', ref: ctx.fetchResult.error }] : []),
      ]),
    });
  }

  // ID_CARD_CHURN: too many distinct card hashes in churn window
  const sinceTimestamp = observedAt - config.churnWindowSeconds;
  const distinctHashes = getDistinctCardHashes(db, ctx.agentId, sinceTimestamp);
  if (distinctHashes.length >= config.churnThreshold) {
    signals.push({
      signalId: 'ID_CARD_CHURN',
      severity: 'MEDIUM',
      weight: 0.5,
      observedAt,
      evidence: sortEvidence([
        ...baseEvidence,
        { type: 'distinctCardHashes', ref: String(distinctHashes.length) },
        { type: 'windowSeconds', ref: String(config.churnWindowSeconds) },
      ]),
    });
  }

  return signals;
}
