/**
 * Job runner registry.
 *
 * Maps job types to their runner implementations.
 */

import type { JobType } from "../types/intent.js";
import type { JobRunner } from "./jobRunner.js";
import { safeReportRunner } from "./safeReportRunner.js";

/**
 * Registry of job runners by type.
 */
const runners = new Map<JobType, JobRunner>([
  ["SAFE_REPORT", safeReportRunner],
]);

/**
 * Gets the runner for a job type.
 *
 * @throws Error if no runner is registered for the job type
 */
export function getRunner(jobType: JobType): JobRunner {
  const runner = runners.get(jobType);
  if (!runner) {
    throw new Error(`No runner registered for job type: ${jobType}`);
  }
  return runner;
}

/**
 * Checks if a runner is registered for a job type.
 */
export function hasRunner(jobType: JobType): boolean {
  return runners.has(jobType);
}

/**
 * Gets all registered job types.
 */
export function getRegisteredJobTypes(): JobType[] {
  return Array.from(runners.keys());
}
