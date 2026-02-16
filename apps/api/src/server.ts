import Fastify from 'fastify';
import { getConfig } from './lib/config.js';
import { actionRoutes } from './routes/actions.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { scanRoutes } from './routes/scan.js';

/**
 * Build and configure the Fastify server
 */
export async function buildServer() {
  const config = getConfig();

  const server = Fastify({
    logger: {
      level: config.logging.level,
      ...(config.logging.format === 'pretty' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
    },
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(scanRoutes);
  await server.register(actionRoutes);
  await server.register(metricsRoutes);

  return server;
}

/**
 * Start the server
 */
async function start() {
  const config = getConfig();
  const server = await buildServer();

  try {
    await server.listen({
      port: config.api.port,
      host: config.api.host,
    });

    server.log.info(
      {
        port: config.api.port,
        host: config.api.host,
        actionsEnabled: config.api.enableActions,
      },
      'IRSB Watchtower API started'
    );
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Run if this is the main module
start();
