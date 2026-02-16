import { metrics, registry } from '@irsb-watchtower/metrics';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Metrics', () => {
  beforeEach(() => {
    // Reset all metrics before each test
    registry.resetMetrics();
  });

  describe('ticksTotal', () => {
    it('increments tick counter', async () => {
      metrics.recordTick(11155111);
      metrics.recordTick(11155111);
      metrics.recordTick(1);

      const output = await metrics.getMetrics();
      expect(output).toContain('watchtower_ticks_total{chainId="11155111"} 2');
      expect(output).toContain('watchtower_ticks_total{chainId="1"} 1');
    });
  });

  describe('alertsTotal', () => {
    it('increments alert counter with labels', async () => {
      metrics.recordAlert('RECEIPT_STALE', 'HIGH', 11155111);
      metrics.recordAlert('RECEIPT_STALE', 'HIGH', 11155111);
      metrics.recordAlert('BOND_LOW', 'MEDIUM', 11155111);

      const output = await metrics.getMetrics();
      expect(output).toContain('watchtower_alerts_total{ruleId="RECEIPT_STALE",severity="HIGH",chainId="11155111"} 2');
      expect(output).toContain('watchtower_alerts_total{ruleId="BOND_LOW",severity="MEDIUM",chainId="11155111"} 1');
    });
  });

  describe('errorsTotal', () => {
    it('increments error counter with type', async () => {
      metrics.recordError('rpc_failure', 11155111);
      metrics.recordError('rpc_failure', 11155111);
      metrics.recordError('timeout');

      const output = await metrics.getMetrics();
      expect(output).toContain('watchtower_errors_total{type="rpc_failure",chainId="11155111"} 2');
      expect(output).toContain('watchtower_errors_total{type="timeout",chainId="unknown"} 1');
    });
  });

  describe('lastBlock', () => {
    it('sets last block gauge', async () => {
      metrics.setLastBlock(11155111, 1000000n);
      metrics.setLastBlock(1, 20000000n);

      const output = await metrics.getMetrics();
      expect(output).toContain('watchtower_last_block{chainId="11155111"} 1000000');
      expect(output).toContain('watchtower_last_block{chainId="1"} 20000000');
    });

    it('updates last block value', async () => {
      metrics.setLastBlock(11155111, 1000000n);
      metrics.setLastBlock(11155111, 1000001n);

      const output = await metrics.getMetrics();
      expect(output).toContain('watchtower_last_block{chainId="11155111"} 1000001');
      expect(output).not.toContain('1000000');
    });
  });

  describe('actionsTotal', () => {
    it('increments action counter with status', async () => {
      metrics.recordAction('OPEN_DISPUTE', 'success', 11155111);
      metrics.recordAction('OPEN_DISPUTE', 'dry_run', 11155111);
      metrics.recordAction('SUBMIT_EVIDENCE', 'failure', 11155111);

      const output = await metrics.getMetrics();
      expect(output).toContain('watchtower_actions_total{actionType="OPEN_DISPUTE",status="success",chainId="11155111"} 1');
      expect(output).toContain('watchtower_actions_total{actionType="OPEN_DISPUTE",status="dry_run",chainId="11155111"} 1');
      expect(output).toContain('watchtower_actions_total{actionType="SUBMIT_EVIDENCE",status="failure",chainId="11155111"} 1');
    });
  });

  describe('activeScans', () => {
    it('tracks active scan count', async () => {
      metrics.scanStarted(11155111);
      metrics.scanStarted(11155111);

      let output = await metrics.getMetrics();
      expect(output).toContain('watchtower_active_scans{chainId="11155111"} 2');

      metrics.scanCompleted(11155111);

      output = await metrics.getMetrics();
      expect(output).toContain('watchtower_active_scans{chainId="11155111"} 1');
    });
  });

  describe('getContentType', () => {
    it('returns Prometheus content type', () => {
      const contentType = metrics.getContentType();
      expect(contentType).toContain('text/plain');
    });
  });
});
