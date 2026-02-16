import { type Finding, Severity, FindingCategory, ActionType, createFinding } from '../finding.js';
import type { Rule, RuleMetadata, ChainContext } from './rule.js';

/**
 * Sample rule for testing and demonstration
 *
 * This rule checks for receipts approaching their challenge deadline
 * without being finalized. In production, this would be replaced with
 * real violation detection logic.
 */
export class SampleRule implements Rule {
  metadata: RuleMetadata = {
    id: 'SAMPLE-001',
    name: 'Sample Challenge Window Rule',
    description:
      'Detects receipts that are approaching their challenge deadline. ' +
      'This is a sample rule for testing the watchtower infrastructure.',
    defaultSeverity: Severity.MEDIUM,
    category: FindingCategory.RECEIPT,
    enabledByDefault: true,
    version: '1.0.0',
  };

  async evaluate(context: ChainContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Get receipts in challenge window
    const receipts = await context.getReceiptsInChallengeWindow();

    for (const receipt of receipts) {
      // Check if deadline is approaching (within 10 minutes)
      const now = context.blockTimestamp;
      const timeUntilDeadline = receipt.challengeDeadline.getTime() - now.getTime();
      const tenMinutesMs = 10 * 60 * 1000;

      if (timeUntilDeadline > 0 && timeUntilDeadline < tenMinutesMs) {
        findings.push(
          createFinding({
            ruleId: this.metadata.id,
            title: `Receipt ${receipt.id.slice(0, 8)}... approaching challenge deadline`,
            description:
              `Receipt ${receipt.id} from solver ${receipt.solverId} will reach its ` +
              `challenge deadline in ${Math.round(timeUntilDeadline / 1000 / 60)} minutes. ` +
              `If this receipt contains violations, a dispute should be opened now.`,
            severity: Severity.MEDIUM,
            category: FindingCategory.RECEIPT,
            blockNumber: context.currentBlock,
            receiptId: receipt.id,
            solverId: receipt.solverId,
            txHash: receipt.txHash,
            recommendedAction: ActionType.MANUAL_REVIEW,
            metadata: {
              challengeDeadline: receipt.challengeDeadline.toISOString(),
              timeUntilDeadlineMs: timeUntilDeadline,
              intentHash: receipt.intentHash,
            },
          })
        );
      }
    }

    return findings;
  }
}

/**
 * Create a mock rule that always produces a finding (for testing)
 */
export class MockAlwaysFindRule implements Rule {
  metadata: RuleMetadata = {
    id: 'MOCK-ALWAYS-FIND',
    name: 'Mock Always Find Rule',
    description: 'Always produces a finding - for testing only',
    defaultSeverity: Severity.INFO,
    category: FindingCategory.SYSTEM,
    enabledByDefault: false,
    version: '1.0.0',
  };

  async evaluate(context: ChainContext): Promise<Finding[]> {
    return [
      createFinding({
        ruleId: this.metadata.id,
        title: 'Mock finding for testing',
        description: 'This is a mock finding produced for testing purposes.',
        severity: Severity.INFO,
        category: FindingCategory.SYSTEM,
        blockNumber: context.currentBlock,
        recommendedAction: ActionType.NONE,
        metadata: {
          mockData: true,
          evaluatedAt: new Date().toISOString(),
        },
      }),
    ];
  }
}
