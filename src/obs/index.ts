/**
 * Observability module exports.
 *
 * Provides structured logging and Prometheus metrics.
 */

export {
  initLogger,
  getLogger,
  withContext,
  summarizeInputs,
  logError,
  type CorrelationContext,
} from "./logger.js";

export {
  metricsRegistry,
  initDefaultMetrics,
  intentsReceivedTotal,
  intentsRefusedTotal,
  runsTotal,
  receiptsWrittenTotal,
  evidenceBundlesTotal,
  errorsTotal,
  runDurationMs,
  processStartTime,
  recordRunSuccess,
  recordRunFailure,
  recordRefusal,
  recordIntentReceived,
  recordError,
  getMetrics,
  getMetricsContentType,
} from "./metrics.js";
