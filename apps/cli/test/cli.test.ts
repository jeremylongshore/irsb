import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cliPath = join(__dirname, '../src/cli.ts');
const cliContent = readFileSync(cliPath, 'utf-8');

describe('CLI', () => {
  describe('command structure', () => {
    it('has health command', () => {
      expect(cliContent).toContain("command('health')");
      expect(cliContent).toContain('Check RPC connectivity and contract access');
    });

    it('has check-config command', () => {
      expect(cliContent).toContain("command('check-config')");
      expect(cliContent).toContain('Validate environment configuration');
    });

    it('has simulate command', () => {
      expect(cliContent).toContain("command('simulate')");
      expect(cliContent).toContain('Preview receipts in scan range');
    });
  });

  describe('version', () => {
    it('displays version 0.2.0', () => {
      expect(cliContent).toContain("version('0.2.0')");
    });
  });

  describe('program metadata', () => {
    it('has proper program name', () => {
      expect(cliContent).toContain("name('irsb-watchtower')");
    });

    it('has description', () => {
      expect(cliContent).toContain('CLI utilities for IRSB Watchtower');
    });
  });

  describe('health command implementation', () => {
    it('checks configuration', () => {
      expect(cliContent).toContain('loadConfig');
    });

    it('checks RPC connectivity', () => {
      expect(cliContent).toContain('getBlockNumber');
      expect(cliContent).toContain('RpcProvider');
    });

    it('checks chain ID', () => {
      expect(cliContent).toContain('getChainId');
      expect(cliContent).toContain('Chain ID Match');
    });

    it('checks IRSB contracts', () => {
      expect(cliContent).toContain('IrsbClient');
      expect(cliContent).toContain('IRSB Contracts');
    });

    it('supports verbose flag', () => {
      expect(cliContent).toContain("option('-v, --verbose'");
    });
  });

  describe('check-config command implementation', () => {
    it('loads and displays configuration', () => {
      expect(cliContent).toContain('loadConfig');
      expect(cliContent).toContain('RPC_URL');
      expect(cliContent).toContain('CHAIN_ID');
    });

    it('shows registered rules', () => {
      expect(cliContent).toContain('createDefaultRegistry');
      expect(cliContent).toContain('Registered Rules');
    });

    it('supports env-file option', () => {
      expect(cliContent).toContain('--env-file');
    });
  });

  describe('simulate command implementation', () => {
    it('fetches receipt events', () => {
      expect(cliContent).toContain('getReceiptPostedEvents');
    });

    it('fetches dispute events', () => {
      expect(cliContent).toContain('getDisputeOpenedEvents');
    });

    it('supports blocks option', () => {
      expect(cliContent).toContain("option('-b, --blocks");
    });

    it('supports from-block option', () => {
      expect(cliContent).toContain('--from-block');
    });

    it('indicates dry run mode', () => {
      expect(cliContent).toContain('Dry Run');
      expect(cliContent).toContain('no on-chain actions taken');
    });
  });
});
