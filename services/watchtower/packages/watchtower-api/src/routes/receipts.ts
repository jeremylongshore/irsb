import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { ingestReceipt } from '@irsb-watchtower/watchtower-core';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export async function receiptRoutes(fastify: FastifyInstance, opts: { db: Database.Database }): Promise<void> {
  const { db } = opts;

  /**
   * POST /v1/receipts/ingest
   * Ingest a solver evidence manifest.
   * Body: { agentId: string, manifest: object }
   */
  fastify.post<{ Body: { agentId: string; manifest: unknown } }>(
    '/v1/receipts/ingest',
    async (request, reply) => {
      const { agentId, manifest } = request.body ?? {};
      if (!agentId || !manifest) {
        return reply.status(400).send({ error: 'agentId and manifest are required' });
      }

      // Write manifest to a temp file so ingestReceipt can read it
      const reqTmpDir = join(tmpdir(), `wt-ingest-${randomUUID()}`);
      try {
        const evidenceDir = join(reqTmpDir, 'evidence');
        mkdirSync(evidenceDir, { recursive: true });
        const manifestPath = join(evidenceDir, 'manifest.json');
        writeFileSync(manifestPath, JSON.stringify(manifest), 'utf-8');

        const result = ingestReceipt(db, agentId, manifestPath, reqTmpDir);
        return reply.send(result);
      } catch (err) {
        return reply.status(422).send({
          error: err instanceof Error ? err.message : 'ingest failed',
        });
      } finally {
        rmSync(reqTmpDir, { recursive: true, force: true });
      }
    },
  );
}
