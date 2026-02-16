/**
 * Structured logging with pino.
 *
 * Features:
 * - JSON output for production
 * - Correlation fields (intentId, runId, receiptId, jobType)
 * - Sensitive data redaction
 */

import pino, { type Logger, type LoggerOptions } from "pino";
import type { LogLevel } from "../config.js";

/**
 * Correlation context for structured logs.
 */
export interface CorrelationContext {
  intentId?: string;
  runId?: string;
  receiptId?: string;
  jobType?: string;
  status?: string;
}

/**
 * Service metadata included in all logs.
 */
const SERVICE_NAME = "irsb-solver";
const SERVICE_VERSION = "0.1.0";

/**
 * Fields to redact from logs.
 */
const REDACT_PATHS = [
  "inputs.data",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.secret",
  "*.token",
  "*.apiKey",
  "*.privateKey",
];

/**
 * Creates logger options for the given log level.
 */
function createLoggerOptions(level: LogLevel): LoggerOptions {
  const isProduction = process.env.NODE_ENV === "production";

  const baseOptions: LoggerOptions = {
    level,
    base: {
      service: SERVICE_NAME,
      serviceVersion: SERVICE_VERSION,
      pid: process.pid,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
  };

  // Add pretty transport in development only
  if (!isProduction) {
    baseOptions.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };
  }

  return baseOptions;
}

/**
 * Root logger instance.
 */
let rootLogger: Logger | null = null;

/**
 * Initializes the root logger with the given log level.
 * Must be called before using getLogger().
 */
export function initLogger(level: LogLevel): Logger {
  rootLogger = pino(createLoggerOptions(level));
  return rootLogger;
}

/**
 * Gets the root logger. Initializes with 'info' if not already initialized.
 */
export function getLogger(): Logger {
  rootLogger ??= pino(createLoggerOptions("info"));
  return rootLogger;
}

/**
 * Creates a child logger with correlation context.
 */
export function withContext(ctx: CorrelationContext): Logger {
  const logger = getLogger();
  return logger.child(ctx);
}

/**
 * Summarizes inputs for safe logging.
 * Only logs subject and key counts, never raw data.
 */
export function summarizeInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  if (typeof inputs.subject === "string") {
    summary.subject = inputs.subject;
  }

  // Count keys in data object
  if (inputs.data && typeof inputs.data === "object") {
    const dataKeys = Object.keys(inputs.data);
    summary.dataKeyCount = dataKeys.length;
    summary.dataKeys = dataKeys.slice(0, 10).sort(); // First 10 keys, sorted
    if (dataKeys.length > 10) {
      summary.dataKeysTruncated = true;
    }
  }

  return summary;
}

/**
 * Logs an error with safe sanitization.
 */
export function logError(
  logger: Logger,
  error: unknown,
  message: string,
  ctx?: CorrelationContext
): void {
  const errorInfo: Record<string, unknown> = {};

  if (error instanceof Error) {
    errorInfo.errorName = error.name;
    errorInfo.errorMessage = error.message;
    // Don't include stack in production for security
    if (process.env.NODE_ENV !== "production") {
      errorInfo.stack = error.stack;
    }
  } else {
    errorInfo.error = String(error);
  }

  const logData = ctx ? { ...ctx, ...errorInfo } : errorInfo;
  logger.error(logData, message);
}
