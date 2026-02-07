/**
 * Signing Gateway Server
 *
 * Cloud Run entrypoint for the IRSB Agent Passkey service.
 */

import Fastify from 'fastify';
import pino from 'pino';
import { routes } from './routes.js';

const logger = pino({
  name: 'agent-passkey-gateway',
  level: process.env['LOG_LEVEL'] ?? 'info',
});

async function main(): Promise<void> {
  const fastify = Fastify({
    logger: true,
    loggerInstance: logger,
  });

  // Register routes
  await fastify.register(routes);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Readiness check
  fastify.get('/ready', async () => {
    // TODO: Check KMS connectivity
    return { ready: true, timestamp: Date.now() };
  });

  const port = parseInt(process.env['PORT'] ?? '8080', 10);
  const host = process.env['HOST'] ?? '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    logger.info({ port, host }, 'Agent Passkey Gateway started');
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
