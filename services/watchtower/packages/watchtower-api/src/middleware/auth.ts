import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

/**
 * Optional API key authentication.
 * If WATCHTOWER_API_KEY env is set, requests must include a matching
 * `x-watchtower-key` header. If the env is unset, all requests pass through.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const expectedKey = process.env['WATCHTOWER_API_KEY'];
  if (!expectedKey) {
    done();
    return;
  }

  const providedKeyHeader = request.headers['x-watchtower-key'];
  if (typeof providedKeyHeader === 'string') {
    const providedBuf = Buffer.from(providedKeyHeader);
    const expectedBuf = Buffer.from(expectedKey);
    if (
      providedBuf.length === expectedBuf.length &&
      timingSafeEqual(providedBuf, expectedBuf)
    ) {
      done();
      return;
    }
  }

  reply.status(401).send({ error: 'unauthorized' });
}
