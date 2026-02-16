#!/usr/bin/env node
/**
 * IRSB Solver Server Entry Point
 *
 * Starts the HTTP server with:
 * - /healthz (liveness)
 * - /readyz (readiness)
 * - /metrics (Prometheus)
 */

import { loadConfig } from "./config.js";
import { initLogger, getLogger } from "./obs/index.js";
import { startServer } from "./server/index.js";

/**
 * Main entry point.
 */
function main(): void {
  try {
    // Load configuration
    const config = loadConfig();

    // Initialize logger
    initLogger(config.LOG_LEVEL);
    const logger = getLogger();

    logger.info(
      {
        nodeEnv: config.NODE_ENV,
        port: config.PORT,
        metricsEnabled: config.METRICS_ENABLED,
        dataDir: config.DATA_DIR,
      },
      "Starting irsb-solver server"
    );

    // Start server
    const server = startServer(config);

    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info({ signal }, "Received shutdown signal");

      // Force exit after timeout
      const timeoutId = setTimeout(() => {
        logger.warn("Forcing exit after timeout");
        process.exit(1);
      }, 10000);

      server.close(() => {
        clearTimeout(timeoutId);
        logger.info("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => {
      shutdown("SIGTERM");
    });
    process.on("SIGINT", () => {
      shutdown("SIGINT");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
