import {
  createFinding,
  type Finding,
  Severity,
  FindingCategory,
  ActionType,
} from '../finding.js';
import type { Rule, RuleMetadata, ChainContext } from './rule.js';

/**
 * Configuration for the Delegation Payment rule
 */
export interface DelegationPaymentRuleConfig {
  /** Maximum settlement amount to auto-approve (above triggers MANUAL_REVIEW) */
  maxAutoApproveAmount: bigint;

  /** Maximum number of settlements per epoch before alerting */
  maxSettlementsPerEpoch: number;

  /** Monitored X402Facilitator contract address */
  facilitatorAddress: string;

  /** Number of blocks to look back for events (default: 100) */
  blockWindow?: number;
}

/**
 * Delegation Payment Rule
 *
 * Monitors EIP-7702 delegated payments through the X402Facilitator contract.
 * Detects:
 * 1. Delegated settlements exceeding auto-approve thresholds
 * 2. High-frequency settlement patterns (potential abuse)
 *
 * This rule provides defense-in-depth monitoring for the delegation system,
 * complementing the on-chain caveat enforcers.
 */
export class DelegationPaymentRule implements Rule {
  readonly metadata: RuleMetadata = {
    id: 'DELEGATION_PAYMENT',
    name: 'Delegation Payment Monitor',
    description: 'Monitors EIP-7702 delegated payments for anomalies and threshold violations',
    defaultSeverity: Severity.MEDIUM,
    category: FindingCategory.RECEIPT,
    enabledByDefault: true,
    version: '1.0.0',
  };

  private config: DelegationPaymentRuleConfig;

  constructor(config: DelegationPaymentRuleConfig) {
    this.config = config;
  }

  async evaluate(context: ChainContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const blockWindow = BigInt(this.config.blockWindow ?? 100);

    // Get events from the facilitator contract
    const events = await context.getEvents(
      context.currentBlock - blockWindow,
      context.currentBlock,
    );

    // Track settlement counts per delegation hash
    const settlementCounts = new Map<string, number>();
    const settlementAmounts = new Map<string, bigint>();

    for (const event of events) {
      // Filter by event name for DelegatedPaymentSettled
      if (event.name !== 'DelegatedPaymentSettled') {
        continue;
      }

      // Filter by contract address (stored in event.args by the chain provider)
      const eventAddress = event.args.address as string | undefined;
      if (eventAddress && eventAddress.toLowerCase() !== this.config.facilitatorAddress.toLowerCase()) {
        continue;
      }

      // Skip events without a valid delegationHash
      const delegationHash = event.args.delegationHash as string | undefined;
      if (!delegationHash) {
        continue;
      }

      const amount = event.args.amount ? BigInt(event.args.amount as string | number | bigint) : 0n;

      // Track settlement frequency
      const count = (settlementCounts.get(delegationHash) ?? 0) + 1;
      settlementCounts.set(delegationHash, count);

      const totalAmount = (settlementAmounts.get(delegationHash) ?? 0n) + amount;
      settlementAmounts.set(delegationHash, totalAmount);

      // Check 1: Large settlement detection
      if (amount > this.config.maxAutoApproveAmount) {
        findings.push(createFinding({
          ruleId: this.metadata.id,
          title: `Large delegated payment: ${amount} exceeds threshold`,
          description:
            `A delegated payment of ${amount} was settled through delegation ${delegationHash}. ` +
            `This exceeds the auto-approve threshold of ${this.config.maxAutoApproveAmount}. ` +
            `Manual review recommended.`,
          severity: Severity.HIGH,
          category: FindingCategory.RECEIPT,
          blockNumber: context.currentBlock,
          txHash: event.txHash,
          contractAddress: this.config.facilitatorAddress,
          recommendedAction: ActionType.MANUAL_REVIEW,
          metadata: {
            delegationHash,
            amount: amount.toString(),
            threshold: this.config.maxAutoApproveAmount.toString(),
            eventType: 'DelegatedPaymentSettled',
          },
        }));
      }
    }

    // Check 2: High-frequency settlement detection
    for (const [delegationHash, count] of settlementCounts) {
      if (count > this.config.maxSettlementsPerEpoch) {
        const totalAmount = settlementAmounts.get(delegationHash) ?? 0n;

        findings.push(createFinding({
          ruleId: this.metadata.id,
          title: `High-frequency settlements on delegation ${delegationHash.slice(0, 10)}...`,
          description:
            `Delegation ${delegationHash} has ${count} settlements in the last ${blockWindow} blocks ` +
            `(threshold: ${this.config.maxSettlementsPerEpoch}). ` +
            `Total amount: ${totalAmount}. Possible abuse pattern.`,
          severity: Severity.MEDIUM,
          category: FindingCategory.RECEIPT,
          blockNumber: context.currentBlock,
          contractAddress: this.config.facilitatorAddress,
          recommendedAction: ActionType.NOTIFY,
          metadata: {
            delegationHash,
            settlementCount: count,
            totalAmount: totalAmount.toString(),
            maxPerEpoch: this.config.maxSettlementsPerEpoch,
          },
        }));
      }
    }

    return findings;
  }
}

/**
 * Create a DelegationPaymentRule with the given config
 */
export function createDelegationPaymentRule(
  config: DelegationPaymentRuleConfig,
): DelegationPaymentRule {
  return new DelegationPaymentRule(config);
}
