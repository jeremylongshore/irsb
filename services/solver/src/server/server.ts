/**
 * HTTP server for health endpoints, metrics, and discovery.
 *
 * Provides:
 * - /healthz (liveness)
 * - /readyz (readiness)
 * - /metrics (Prometheus)
 * - /.well-known/agent-card.json (ERC-8004 discovery)
 */

import express, { type Express, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { existsSync, accessSync, constants } from "node:fs";
import { dirname } from "node:path";
import type { ResolvedConfig } from "../config.js";
import { getLogger } from "../obs/logger.js";
import {
  getMetrics,
  getMetricsContentType,
  initDefaultMetrics,
} from "../obs/metrics.js";
import { generateAgentCard } from "../erc8004/index.js";

/**
 * Rate limiter for endpoints that perform I/O.
 * Prevents DoS via filesystem access abuse.
 */
const ioRateLimiter = rateLimit({
  windowMs: 1000, // 1 second window
  max: 10, // max 10 requests per second
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests" },
});

/**
 * Service metadata.
 */
const SERVICE_NAME = "irsb-solver";
const SERVICE_VERSION = "0.1.0";

/**
 * Process start time for uptime calculation.
 */
const PROCESS_START_TIME = Date.now();

/**
 * Try to get git commit from environment.
 */
function getGitCommit(): string | undefined {
  return process.env.GIT_COMMIT ?? process.env.GITHUB_SHA;
}

/**
 * Check if a path is writable.
 */
function isWritable(path: string): boolean {
  try {
    // Check if file exists and is writable
    if (existsSync(path)) {
      accessSync(path, constants.W_OK);
      return true;
    }
    // Check if parent directory is writable (file can be created)
    const dir = dirname(path);
    if (existsSync(dir)) {
      accessSync(dir, constants.W_OK);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Creates the Express app with routes.
 */
export function createApp(config: ResolvedConfig): Express {
  const app = express();

  // Initialize default metrics
  if (config.METRICS_ENABLED) {
    initDefaultMetrics();
  }

  /**
   * GET /healthz - Liveness probe
   */
  app.get("/healthz", (_req: Request, res: Response) => {
    const uptimeSeconds = Math.floor((Date.now() - PROCESS_START_TIME) / 1000);

    res.json({
      ok: true,
      service: SERVICE_NAME,
      serviceVersion: SERVICE_VERSION,
      gitCommit: getGitCommit(),
      uptimeSeconds,
    });
  });

  /**
   * GET /readyz - Readiness probe
   * Rate limited to prevent filesystem access abuse.
   */
  app.get("/readyz", ioRateLimiter, (_req: Request, res: Response) => {
    const reasons: string[] = [];

    // Check data directory
    if (!existsSync(config.DATA_DIR)) {
      reasons.push(`DATA_DIR not found: ${config.DATA_DIR}`);
    } else {
      try {
        accessSync(config.DATA_DIR, constants.W_OK);
      } catch {
        reasons.push(`DATA_DIR not writable: ${config.DATA_DIR}`);
      }
    }

    // Check receipts path writable
    if (!isWritable(config.RECEIPTS_PATH)) {
      reasons.push(`RECEIPTS_PATH not writable: ${config.RECEIPTS_PATH}`);
    }

    // Check refusals path writable
    if (!isWritable(config.REFUSALS_PATH)) {
      reasons.push(`REFUSALS_PATH not writable: ${config.REFUSALS_PATH}`);
    }

    if (reasons.length > 0) {
      res.status(503).json({
        ok: false,
        reasons,
      });
    } else {
      res.json({
        ok: true,
      });
    }
  });

  /**
   * GET /.well-known/agent-card.json - ERC-8004 Agent Discovery
   *
   * Returns the agent card with discovery metadata.
   * No authentication required.
   * Does not expose internal paths.
   */
  app.get("/.well-known/agent-card.json", (_req: Request, res: Response) => {
    const card = generateAgentCard();
    res.json(card);
  });

  /**
   * GET /metrics - Prometheus metrics
   */
  if (config.METRICS_ENABLED) {
    app.get("/metrics", async (_req: Request, res: Response) => {
      try {
        const metrics = await getMetrics();
        res.set("Content-Type", getMetricsContentType());
        res.end(metrics);
      } catch (error) {
        const logger = getLogger();
        logger.error({ error }, "Failed to collect metrics");
        res.status(500).end("Error collecting metrics");
      }
    });
  }

  return app;
}

/**
 * Starts the HTTP server.
 */
export function startServer(
  config: ResolvedConfig
): ReturnType<Express["listen"]> {
  const app = createApp(config);
  const logger = getLogger();

  const server = app.listen(config.PORT, () => {
    logger.info(
      {
        port: config.PORT,
        metricsEnabled: config.METRICS_ENABLED,
      },
      "Server started"
    );
  });

  return server;
}
