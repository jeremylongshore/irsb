/**
 * Policy gate with real refusal reasons.
 *
 * Checks:
 * - jobType allowlisted
 * - expiresAt not in the past
 * - requester allowlist (if configured)
 * - size guard: serialized inputs within bound
 */

import type { ResolvedConfig } from "../config.js";
import type { NormalizedIntent } from "../types/intent.js";
import { canonicalJson } from "../utils/canonicalJson.js";

/**
 * Policy evaluation result
 */
export interface PolicyResult {
  allowed: boolean;
  reasons: string[];
}

/**
 * Refusal record for JSONL storage
 */
export interface RefusalRecord {
  timestamp: string;
  intentId: string;
  runId: string;
  jobType: string;
  requester: string;
  reasons: string[];
  intentVersion: string;
}

/**
 * Evaluates policy for an intent.
 * Returns { allowed: true, reasons: [] } if all checks pass.
 * Returns { allowed: false, reasons: [...] } with all failure reasons.
 */
export function evaluatePolicy(
  intent: NormalizedIntent,
  config: ResolvedConfig
): PolicyResult {
  const reasons: string[] = [];

  // Check 1: jobType allowlisted
  if (!config.POLICY_JOBTYPE_ALLOWLIST.includes(intent.jobType)) {
    reasons.push(
      `jobType '${intent.jobType}' not in allowlist [${config.POLICY_JOBTYPE_ALLOWLIST.join(", ")}]`
    );
  }

  // Check 2: expiresAt not in the past
  if (intent.expiresAt) {
    const expiresAt = new Date(intent.expiresAt);
    if (expiresAt.getTime() < Date.now()) {
      reasons.push(`intent expired at ${intent.expiresAt}`);
    }
  }

  // Check 3: requester allowlist (if configured)
  if (config.POLICY_REQUESTER_ALLOWLIST) {
    if (!config.POLICY_REQUESTER_ALLOWLIST.includes(intent.requester)) {
      reasons.push(
        `requester '${intent.requester}' not in allowlist`
      );
    }
  }

  // Check 4: size guard
  const inputsJson = canonicalJson(intent.inputs);
  const maxBytes = config.POLICY_MAX_ARTIFACT_MB * 1024 * 1024;
  if (inputsJson.length > maxBytes) {
    reasons.push(
      `inputs size ${String(inputsJson.length)} bytes exceeds max ${String(maxBytes)} bytes (${String(config.POLICY_MAX_ARTIFACT_MB)} MB)`
    );
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

/**
 * Creates a refusal record for JSONL storage.
 */
export function createRefusalRecord(
  intent: NormalizedIntent,
  runId: string,
  reasons: string[]
): RefusalRecord {
  return {
    timestamp: new Date().toISOString(),
    intentId: intent.intentId,
    runId,
    jobType: intent.jobType,
    requester: intent.requester,
    reasons,
    intentVersion: intent.intentVersion,
  };
}
