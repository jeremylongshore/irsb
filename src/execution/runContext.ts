/**
 * Run context for job execution.
 *
 * Provides the execution environment for job runners.
 */

import { join } from "node:path";
import type { JobType } from "../types/intent.js";

/**
 * Execution context passed to job runners.
 */
export interface RunContext {
  /** The intent ID being executed */
  intentId: string;

  /** The run ID for this execution */
  runId: string;

  /** The job type being executed */
  jobType: JobType;

  /** Base data directory */
  dataDir: string;

  /** Directory for this run's artifacts */
  artifactsDir: string;

  /** Requester identifier */
  requester: string;
}

/**
 * Creates a run context for job execution.
 */
export function createRunContext(params: {
  intentId: string;
  runId: string;
  jobType: JobType;
  dataDir: string;
  requester: string;
}): RunContext {
  const { intentId, runId, jobType, dataDir, requester } = params;

  return {
    intentId,
    runId,
    jobType,
    dataDir,
    artifactsDir: join(dataDir, "runs", runId, "artifacts"),
    requester,
  };
}
