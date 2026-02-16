import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  initDbWithInlineMigrations,
  ensureKeyPair,
  loadKeyPair,
  keyFileExists,
} from '@irsb-watchtower/watchtower-core';
import { apiKeyAuth } from './middleware/auth.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { receiptRoutes } from './routes/receipts.js';
import { transparencyRoutes } from './routes/transparency.js';

export interface ServerConfig {
  port: number;
  host: string;
  dbPath: string;
  keyPath: string;
  logDir: string;
}

function getConfig(): ServerConfig {
  return {
    port: parseInt(process.env['WATCHTOWER_API_PORT'] ?? '3100', 10),
    host: process.env['WATCHTOWER_API_HOST'] ?? '127.0.0.1',
    dbPath: process.env['WATCHTOWER_DB_PATH'] ?? './data/watchtower.db',
    keyPath: process.env['WATCHTOWER_KEY_PATH'] ?? './data/watchtower-key.json',
    logDir: process.env['WATCHTOWER_LOG_DIR'] ?? './data/transparency',
  };
}

/**
 * Build and configure the Fastify server.
 * Exported for testing via server.inject().
 */
export async function buildServer(overrides?: Partial<ServerConfig>): Promise<FastifyInstance> {
  const config = { ...getConfig(), ...overrides };
  const db = initDbWithInlineMigrations(config.dbPath);

  // Load or create signing key
  let publicKey: string | undefined;
  if (keyFileExists(config.keyPath)) {
    publicKey = loadKeyPair(config.keyPath).publicKey;
  }

  const server = Fastify({ logger: false });

  // Optional API key auth on /v1/* routes
  server.addHook('onRequest', (request, reply, done) => {
    if (request.url.startsWith('/v1/')) {
      apiKeyAuth(request, reply, done);
    } else {
      done();
    }
  });

  // Register routes
  await server.register(healthRoutes);
  await server.register(agentRoutes, { db });
  await server.register(receiptRoutes, { db });
  await server.register(transparencyRoutes, { logDir: config.logDir, publicKey });

  // Graceful shutdown
  server.addHook('onClose', () => {
    db.close();
  });

  return server;
}

async function start(): Promise<void> {
  const config = getConfig();

  // Ensure keypair exists for transparency log signing
  ensureKeyPair(config.keyPath);

  const server = await buildServer();

  await server.listen({ port: config.port, host: config.host });
  console.log(`Watchtower API listening on ${config.host}:${config.port}`);
}

// Run if main module
const isMain = process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts');
if (isMain) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
