/**
 * Prometheus metrics for observability.
 *
 * Exposes counters, histograms, and gauges for the solver.
 * All labels are low-cardinality (status, jobType only).
 */

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

/**
 * Custom registry for all solver metrics.
 */
export const metricsRegistry = new Registry();

/**
 * Initialize default metrics (process, Node.js internals).
 */
export function initDefaultMetrics(): void {
  collectDefaultMetrics({ register: metricsRegistry });
}

// ─────────────────────────────────────────────────────────────────
// Counters
// ─────────────────────────────────────────────────────────────────

/**
 * Total intents received by the solver.
 */
export const intentsReceivedTotal = new Counter({
  name: "solver_intents_received_total",
  help: "Total number of intents received",
  registers: [metricsRegistry],
});

/**
 * Total intents refused by policy.
 */
export const intentsRefusedTotal = new Counter({
  name: "solver_intents_refused_total",
  help: "Total number of intents refused by policy",
  registers: [metricsRegistry],
});

/**
 * Total runs by status and job type.
 */
export const runsTotal = new Counter({
  name: "solver_runs_total",
  help: "Total number of runs by status and job type",
  labelNames: ["status", "jobType"] as const,
  registers: [metricsRegistry],
});

/**
 * Total receipts written by status.
 */
export const receiptsWrittenTotal = new Counter({
  name: "solver_receipts_written_total",
  help: "Total receipts written by status",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

/**
 * Total evidence bundles created.
 */
export const evidenceBundlesTotal = new Counter({
  name: "solver_evidence_bundles_total",
  help: "Total evidence bundles created",
  registers: [metricsRegistry],
});

/**
 * Total errors by type.
 */
export const errorsTotal = new Counter({
  name: "solver_errors_total",
  help: "Total errors by type",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────
// Histograms
// ─────────────────────────────────────────────────────────────────

/**
 * Run duration in milliseconds by job type.
 */
export const runDurationMs = new Histogram({
  name: "solver_run_duration_ms",
  help: "Run duration in milliseconds by job type",
  labelNames: ["jobType"] as const,
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry],
});

// ─────────────────────────────────────────────────────────────────
// Gauges
// ─────────────────────────────────────────────────────────────────

/**
 * Process start time (Unix timestamp in seconds).
 */
export const processStartTime = new Gauge({
  name: "solver_process_start_time_seconds",
  help: "Unix timestamp when the process started",
  registers: [metricsRegistry],
});

// Set process start time on module load
processStartTime.set(Date.now() / 1000);

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Records metrics for a successful run.
 */
export function recordRunSuccess(jobType: string, durationMs: number): void {
  runsTotal.labels({ status: "SUCCESS", jobType }).inc();
  runDurationMs.labels({ jobType }).observe(durationMs);
  evidenceBundlesTotal.inc();
  receiptsWrittenTotal.labels({ status: "SUCCESS" }).inc();
}

/**
 * Records metrics for a failed run.
 */
export function recordRunFailure(jobType: string, durationMs: number, errorType: string): void {
  runsTotal.labels({ status: "FAILED", jobType }).inc();
  runDurationMs.labels({ jobType }).observe(durationMs);
  errorsTotal.labels({ type: errorType }).inc();
}

/**
 * Records metrics for a refused intent.
 */
export function recordRefusal(jobType: string): void {
  intentsRefusedTotal.inc();
  runsTotal.labels({ status: "REFUSED", jobType }).inc();
}

/**
 * Records an intent received.
 */
export function recordIntentReceived(): void {
  intentsReceivedTotal.inc();
}

/**
 * Records an error by type.
 */
export function recordError(errorType: string): void {
  errorsTotal.labels({ type: errorType }).inc();
}

/**
 * Gets all metrics in Prometheus text format.
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Gets the content type for metrics response.
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
