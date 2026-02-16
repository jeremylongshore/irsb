/**
 * Execution plan computation and deterministic runId.
 *
 * runId formula:
 * sha256("run:" + intentId + ":" + jobType + ":" + canonicalJson(inputs))
 */

import type { ResolvedConfig } from "../config.js";
import type { NormalizedIntent } from "../types/intent.js";
import type { PolicyResult } from "../policy/policy.js";
import { canonicalJson } from "../utils/canonicalJson.js";
import { sha256 } from "../utils/hash.js";

/**
 * Execution plan output structure
 */
export interface ExecutionPlan {
  intentId: string;
  runId: string;
  jobType: string;
  paths: {
    receiptsPath: string;
    refusalsPath: string;
    evidenceDir: string;
  };
  policyDecision: PolicyResult;
}

/**
 * Computes the deterministic runId for an intent.
 */
export function computeRunId(intent: NormalizedIntent): string {
  const parts = [
    "run",
    intent.intentId,
    intent.jobType,
    canonicalJson(intent.inputs),
  ];

  return sha256(parts.join(":"));
}

/**
 * Creates an execution plan for an intent.
 * The plan includes paths and policy decision but does NOT execute anything.
 */
export function createExecutionPlan(
  intent: NormalizedIntent,
  config: ResolvedConfig,
  policyDecision: PolicyResult
): ExecutionPlan {
  const runId = computeRunId(intent);

  return {
    intentId: intent.intentId,
    runId,
    jobType: intent.jobType,
    paths: {
      receiptsPath: config.RECEIPTS_PATH,
      refusalsPath: config.REFUSALS_PATH,
      evidenceDir: config.EVIDENCE_DIR,
    },
    policyDecision,
  };
}

/**
 * Formats an execution plan for display.
 */
export function formatExecutionPlan(plan: ExecutionPlan): string {
  const lines = [
    "Execution Plan:",
    `  intentId: ${plan.intentId}`,
    `  runId: ${plan.runId}`,
    `  jobType: ${plan.jobType}`,
    "",
    "Paths:",
    `  receipts: ${plan.paths.receiptsPath}`,
    `  refusals: ${plan.paths.refusalsPath}`,
    `  evidence: ${plan.paths.evidenceDir}`,
    "",
    "Policy Decision:",
    `  allowed: ${String(plan.policyDecision.allowed)}`,
  ];

  if (plan.policyDecision.reasons.length > 0) {
    lines.push("  reasons:");
    for (const reason of plan.policyDecision.reasons) {
      lines.push(`    - ${reason}`);
    }
  }

  return lines.join("\n");
}
