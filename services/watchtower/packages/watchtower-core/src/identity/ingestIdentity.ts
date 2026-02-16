import type Database from 'better-sqlite3';
import type { IdentityEventSource } from './identityTypes.js';
import type { IdentityConfig } from './identityConfig.js';
import type { PollResult } from './identityPoller.js';
import { pollIdentityEvents } from './identityPoller.js';
import { makeAgentId } from './identityTypes.js';
import {
  getDistinctAgentTokenIds,
  getLatestEventForAgent,
  insertIdentitySnapshot,
} from './identityStore.js';
import { fetchAgentCard } from './agentCardFetcher.js';
import { deriveIdentitySignals } from './deriveIdentitySignals.js';
import { canonicalJson, sha256Hex } from '../utils/canonical.js';
import { sortSignals } from '../utils/sort.js';
import { upsertAgent, getAgent } from '../storage/agentStore.js';
import { insertSnapshot, getLatestSnapshots } from '../storage/snapshotStore.js';
import { insertRiskReport } from '../storage/reportStore.js';
import { insertAlerts } from '../storage/alertStore.js';
import { scoreAgent } from '../scoring/scoreAgent.js';

export interface SyncResult {
  poll: PollResult;
}

/**
 * Poll chain for new ERC-8004 identity events and store them.
 */
export async function syncIdentityEvents(
  db: Database.Database,
  source: IdentityEventSource,
  config: IdentityConfig,
): Promise<SyncResult> {
  const poll = await pollIdentityEvents(db, source, config);
  return { poll };
}

export interface FetchResult {
  agentId: string;
  agentUri: string;
  fetchStatus: string;
  overallRisk: number;
  reportId: string;
  alertCount: number;
  signalCount: number;
}

export interface FetchOptions {
  /** Only process this specific token ID (if set, skip others) */
  agentTokenId?: string;
  allowHttp?: boolean;
}

/**
 * For each known agent: fetch card, store identity snapshot, derive signals,
 * score and produce risk report + alerts.
 */
export async function fetchAndScoreIdentities(
  db: Database.Database,
  config: IdentityConfig,
  options?: FetchOptions,
): Promise<FetchResult[]> {
  const tokenIds = options?.agentTokenId
    ? [options.agentTokenId]
    : getDistinctAgentTokenIds(db, config.chainId, config.registryAddress);

  const results: FetchResult[] = [];

  for (const tokenId of tokenIds) {
    const agentId = makeAgentId(config.chainId, config.registryAddress, tokenId);

    // Get latest event to find agent URI
    const event = getLatestEventForAgent(
      db,
      config.chainId,
      config.registryAddress,
      tokenId,
    );
    if (!event) continue;

    const agentUri = event.agent_uri;
    const observedAt = Math.floor(Date.now() / 1000);

    // Fetch agent card
    const fetchResult = await fetchAgentCard(agentUri, {
      timeoutMs: config.fetchTimeoutMs,
      maxBytes: config.maxCardBytes,
      allowHttp: options?.allowHttp ?? config.allowHttp,
      maxRedirects: config.maxRedirects,
    });

    // Store identity snapshot
    const snapshotPayload = {
      agentId,
      agentUri,
      fetchStatus: fetchResult.status,
      cardHash: fetchResult.cardHash ?? null,
    };
    const snapshotId = sha256Hex(canonicalJson(snapshotPayload));

    insertIdentitySnapshot(db, {
      snapshot_id: snapshotId,
      agent_id: agentId,
      agent_uri: agentUri,
      fetch_status: fetchResult.status,
      card_hash: fetchResult.cardHash ?? null,
      card_json: fetchResult.cardJson ?? null,
      fetched_at: observedAt,
      http_status: fetchResult.httpStatus ?? null,
      error_message: fetchResult.error ?? null,
    });

    // Derive identity signals
    const signals = sortSignals(
      deriveIdentitySignals(
        db,
        { agentId, fetchResult, agentUri },
        config,
        observedAt,
      ),
    );

    // Upsert agent in W1 agent table
    upsertAgent(db, { agentId });

    // Store watchtower snapshot (signals)
    const wtSnapshotId = sha256Hex(canonicalJson({ agentId, signals }));
    insertSnapshot(db, {
      snapshotId: wtSnapshotId,
      agentId,
      observedAt,
      signals,
    });

    // Score agent
    const agent = getAgent(db, agentId)!;
    const snapshots = getLatestSnapshots(db, agentId);
    const generatedAt = Math.floor(Date.now() / 1000);
    const { report, newAlerts } = scoreAgent(agent, snapshots, generatedAt);

    insertRiskReport(db, report);
    if (newAlerts.length > 0) {
      insertAlerts(db, newAlerts);
    }

    results.push({
      agentId,
      agentUri,
      fetchStatus: fetchResult.status,
      overallRisk: report.overallRisk,
      reportId: report.reportId,
      alertCount: newAlerts.length,
      signalCount: signals.length,
    });
  }

  return results;
}
