/**
 * Job runner interface and types.
 *
 * Defines the contract for all job type implementations.
 */

import type { JobType, Inputs } from "../types/intent.js";
import type { RunContext } from "./runContext.js";

/**
 * Artifact metadata in run result.
 */
export interface ArtifactInfo {
  /** Relative path from artifacts directory */
  path: string;

  /** Size in bytes */
  bytes: number;
}

/**
 * Run status.
 */
export type RunStatus = "SUCCESS" | "FAILED";

/**
 * Result of a job execution.
 */
export interface RunResult {
  /** Intent ID */
  intentId: string;

  /** Run ID */
  runId: string;

  /** Job type executed */
  jobType: JobType;

  /** Execution status */
  status: RunStatus;

  /** Artifacts produced (only on success) */
  artifacts: ArtifactInfo[];

  /** Error message (only on failure, sanitized) */
  error?: string;
}

/**
 * Job runner interface.
 *
 * Each job type implements this interface.
 */
export interface JobRunner<T extends Inputs = Inputs> {
  /** The job type this runner handles */
  readonly jobType: JobType;

  /**
   * Executes the job.
   *
   * @param inputs - The job inputs (typed per job type)
   * @param ctx - The execution context
   * @returns The run result
   */
  run(inputs: T, ctx: RunContext): Promise<RunResult>;
}

/**
 * Creates a success run result.
 */
export function successResult(
  ctx: RunContext,
  artifacts: ArtifactInfo[]
): RunResult {
  return {
    intentId: ctx.intentId,
    runId: ctx.runId,
    jobType: ctx.jobType,
    status: "SUCCESS",
    artifacts,
  };
}

/**
 * Creates a failure run result.
 */
export function failureResult(ctx: RunContext, error: string): RunResult {
  return {
    intentId: ctx.intentId,
    runId: ctx.runId,
    jobType: ctx.jobType,
    status: "FAILED",
    artifacts: [],
    error,
  };
}
