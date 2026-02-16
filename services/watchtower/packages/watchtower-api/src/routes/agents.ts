import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import {
  getAgent,
  getLatestRiskReport,
  listAlerts,
} from '@irsb-watchtower/watchtower-core';

export async function agentRoutes(fastify: FastifyInstance, opts: { db: Database.Database }): Promise<void> {
  const { db } = opts;

  /**
   * GET /v1/agents/:agentId/risk
   * Returns the latest risk report for an agent.
   */
  fastify.get<{ Params: { agentId: string } }>(
    '/v1/agents/:agentId/risk',
    async (request, reply) => {
      const { agentId } = request.params;
      const agent = getAgent(db, agentId);
      if (!agent) {
        return reply.status(404).send({ error: 'agent not found' });
      }

      const report = getLatestRiskReport(db, agentId);
      if (!report) {
        return reply.status(404).send({ error: 'no risk report found' });
      }

      return reply.send(report);
    },
  );

  /**
   * GET /v1/agents/:agentId/alerts
   * Returns alerts for an agent.
   */
  fastify.get<{ Params: { agentId: string }; Querystring: { activeOnly?: string } }>(
    '/v1/agents/:agentId/alerts',
    async (request, reply) => {
      const { agentId } = request.params;
      const agent = getAgent(db, agentId);
      if (!agent) {
        return reply.status(404).send({ error: 'agent not found' });
      }

      const activeOnly = request.query.activeOnly === 'true';
      const alerts = listAlerts(db, { agentId, activeOnly });

      return reply.send({ agentId, alerts });
    },
  );
}
