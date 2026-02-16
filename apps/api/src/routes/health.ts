import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Health check response
 */
interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  version: string;
  uptime: number;
}

/**
 * Register health check routes
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const startTime = Date.now();

  /**
   * GET /health
   *
   * Liveness probe - returns 200 if the service is running
   */
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    return reply.send(response);
  });

  /**
   * GET /health/ready
   *
   * Readiness probe - checks if the service is ready to accept traffic
   */
  fastify.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Add more sophisticated readiness checks
    // - Chain provider connectivity
    // - Contract accessibility
    // - Signer health (if configured)

    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    return reply.send(response);
  });
}
