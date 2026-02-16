import type { FastifyInstance } from 'fastify';

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/healthz', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: '0.3.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });
}
