import { metrics } from '@irsb-watchtower/metrics';
import type { FastifyInstance } from 'fastify';

/**
 * Prometheus metrics endpoint
 */
export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /metrics - Prometheus metrics endpoint
   */
  fastify.get('/metrics', async (_request, reply) => {
    const metricsOutput = await metrics.getMetrics();
    return reply
      .header('Content-Type', metrics.getContentType())
      .send(metricsOutput);
  });
}
