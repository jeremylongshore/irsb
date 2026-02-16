import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WebhookSink,
  generateSignature,
  verifySignature,
  generateDeliveryId,
  createWebhookSink,
} from '../src/index.js';

describe('Webhook', () => {
  const validSecret = 'this-is-a-valid-secret-key-32chars!';

  describe('generateSignature', () => {
    it('generates consistent signatures for same input', () => {
      const payload = '{"test": "data"}';
      const timestamp = 1700000000;
      const sig1 = generateSignature(payload, timestamp, validSecret);
      const sig2 = generateSignature(payload, timestamp, validSecret);
      expect(sig1).toBe(sig2);
    });

    it('generates different signatures for different payloads', () => {
      const timestamp = 1700000000;
      const sig1 = generateSignature('{"a": 1}', timestamp, validSecret);
      const sig2 = generateSignature('{"a": 2}', timestamp, validSecret);
      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different timestamps', () => {
      const payload = '{"test": "data"}';
      const sig1 = generateSignature(payload, 1700000000, validSecret);
      const sig2 = generateSignature(payload, 1700000001, validSecret);
      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different secrets', () => {
      const payload = '{"test": "data"}';
      const timestamp = 1700000000;
      const sig1 = generateSignature(payload, timestamp, validSecret);
      const sig2 = generateSignature(payload, timestamp, 'another-secret-that-is-32-chars!');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('verifies valid signature', () => {
      const payload = '{"test": "data"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(payload, timestamp, validSecret);
      const header = `t=${timestamp},v1=${signature}`;

      const result = verifySignature(payload, header, validSecret);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid signature format', () => {
      const result = verifySignature('payload', 'invalid-header', validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature header format');
    });

    it('rejects missing timestamp', () => {
      const result = verifySignature('payload', 'v1=signature', validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature header format');
    });

    it('rejects missing signature', () => {
      const result = verifySignature('payload', 't=1700000000', validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature header format');
    });

    it('rejects invalid timestamp', () => {
      const result = verifySignature('payload', 't=invalid,v1=sig', validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid timestamp in signature header');
    });

    it('rejects timestamp that is too old', () => {
      const payload = '{"test": "data"}';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const signature = generateSignature(payload, oldTimestamp, validSecret);
      const header = `t=${oldTimestamp},v1=${signature}`;

      const result = verifySignature(payload, header, validSecret, 300);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Timestamp too old');
    });

    it('rejects timestamp in the future', () => {
      const payload = '{"test": "data"}';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 120; // 2 minutes in future
      const signature = generateSignature(payload, futureTimestamp, validSecret);
      const header = `t=${futureTimestamp},v1=${signature}`;

      const result = verifySignature(payload, header, validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Timestamp in the future');
    });

    it('allows small clock skew into future', () => {
      const payload = '{"test": "data"}';
      const nearFutureTimestamp = Math.floor(Date.now() / 1000) + 30; // 30 seconds in future
      const signature = generateSignature(payload, nearFutureTimestamp, validSecret);
      const header = `t=${nearFutureTimestamp},v1=${signature}`;

      const result = verifySignature(payload, header, validSecret);
      expect(result.valid).toBe(true);
    });

    it('rejects wrong signature', () => {
      const payload = '{"test": "data"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const header = `t=${timestamp},v1=wrongsignature`;

      const result = verifySignature(payload, header, validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature mismatch');
    });

    it('rejects tampered payload', () => {
      const originalPayload = '{"test": "data"}';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateSignature(originalPayload, timestamp, validSecret);
      const header = `t=${timestamp},v1=${signature}`;

      const tamperedPayload = '{"test": "hacked"}';
      const result = verifySignature(tamperedPayload, header, validSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature mismatch');
    });
  });

  describe('generateDeliveryId', () => {
    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateDeliveryId());
      }
      expect(ids.size).toBe(100);
    });

    it('generates IDs with wh_ prefix', () => {
      const id = generateDeliveryId();
      expect(id.startsWith('wh_')).toBe(true);
    });
  });

  describe('WebhookSink', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('throws if secret is too short', () => {
      expect(() => createWebhookSink({ url: 'https://example.com', secret: 'short' }))
        .toThrow('Webhook secret must be at least 32 characters');
    });

    it('creates sink with valid config', () => {
      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });
      expect(sink).toBeInstanceOf(WebhookSink);
    });

    it('sends webhook with correct headers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });

      await sink.send('test.event', { foo: 'bar' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://example.com/webhook');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-Watchtower-Signature']).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
      expect(options.headers['X-Watchtower-Delivery-Id']).toMatch(/^wh_\d+_[a-f0-9]{16}$/);
      expect(options.headers['X-Watchtower-Event']).toBe('test.event');
    });

    it('includes correct payload structure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });

      await sink.send('test.event', { foo: 'bar' });

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.event).toBe('test.event');
      expect(body.deliveryId).toMatch(/^wh_/);
      expect(body.timestamp).toBeTypeOf('number');
      expect(body.data).toEqual({ foo: 'bar' });
    });

    it('returns success result on 2xx response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });

      const result = await sink.send('test.event', { foo: 'bar' });
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.attempts).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('retries on 5xx errors', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway' })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
        retryDelayMs: 10, // Fast retries for testing
      });

      const result = await sink.send('test.event', {});
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('retries on 429 rate limit', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
        retryDelayMs: 10,
      });

      const result = await sink.send('test.event', {});
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('does not retry on 4xx errors (except 429)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
        maxRetries: 3,
      });

      const result = await sink.send('test.event', {});
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns failure after max retries', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
        maxRetries: 2,
        retryDelayMs: 10,
      });

      const result = await sink.send('test.event', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 503: Service Unavailable');
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('retries on network errors', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
        retryDelayMs: 10,
      });

      const result = await sink.send('test.event', {});
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('handles timeout errors', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetchMock.mockRejectedValue(abortError);

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
        maxRetries: 0,
        timeoutMs: 100,
      });

      const result = await sink.send('test.event', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });

    it('sendFindings wraps data correctly', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });

      const findings = [{ id: '1', title: 'Test Finding' }];
      await sink.sendFindings(findings);

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.event).toBe('findings.detected');
      expect(body.data.findings).toEqual(findings);
      expect(body.data.count).toBe(1);
    });

    it('sendActionResult wraps data correctly', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });

      const actionResult = { action: 'OPEN_DISPUTE', txHash: '0x123' };
      await sink.sendActionResult(actionResult);

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.event).toBe('action.executed');
      expect(body.data).toEqual(actionResult);
    });

    it('sendHeartbeat wraps data correctly', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const sink = createWebhookSink({
        url: 'https://example.com/webhook',
        secret: validSecret,
      });

      const status = { chainId: 11155111, lastBlock: '1000000', uptime: 3600 };
      await sink.sendHeartbeat(status);

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.event).toBe('heartbeat');
      expect(body.data).toEqual(status);
    });
  });
});
