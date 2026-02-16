# Rule Engine Architecture

## Overview

The rule engine is the core of the watchtower. It evaluates a set of rules against the current chain state and produces Findings.

## Design Principles

### 1. Deterministic
Given the same `ChainContext`, the same rules produce the same Findings. No randomness, no external state.

### 2. Idempotent
Running the same rules multiple times on the same state produces identical results. Safe to retry.

### 3. Isolated
Rules are independent. One rule's failure doesn't affect others.

### 4. Testable
Rules can be unit tested with mock ChainContext.

## Rule Interface

```typescript
interface Rule {
  metadata: RuleMetadata;
  evaluate(context: ChainContext): Promise<Finding[]>;
}

interface RuleMetadata {
  id: string;           // Unique rule identifier
  name: string;         // Human-readable name
  description: string;  // What the rule detects
  defaultSeverity: Severity;
  category: FindingCategory;
  enabledByDefault: boolean;
  version: string;
}
```

## Chain Context

The `ChainContext` provides a normalized view of chain state:

```typescript
interface ChainContext {
  currentBlock: bigint;
  blockTimestamp: Date;
  chainId: number;

  getReceiptsInChallengeWindow(): Promise<ReceiptInfo[]>;
  getActiveDisputes(): Promise<DisputeInfo[]>;
  getSolverInfo(solverId: string): Promise<SolverInfo | null>;
  getEvents(fromBlock: bigint, toBlock: bigint): Promise<ChainEvent[]>;
}
```

Rules receive the context and query what they need. The context implementation handles caching and batching.

## Rule Registry

Rules are registered in a `RuleRegistry`:

```typescript
const registry = new RuleRegistry();
registry.register(new SampleRule());
registry.register(new TimeoutRule());
registry.register(new BondThresholdRule());

// Get all enabled rules
const enabled = registry.getEnabled();

// Get specific rule
const rule = registry.get('SAMPLE-001');
```

## Engine Execution

```typescript
const engine = new RuleEngine(registry);

const result = await engine.execute(context, {
  ruleIds: ['SAMPLE-001'],  // Optional: specific rules only
  stopOnError: false,       // Continue if a rule fails
  ruleTimeoutMs: 30000,     // Timeout per rule
});

// Result structure:
{
  findings: Finding[];      // All findings from all rules
  ruleResults: RuleResult[]; // Per-rule results
  totalDurationMs: number;
  rulesExecuted: number;
  rulesFailed: number;
}
```

## Writing Rules

### Basic Rule Structure

```typescript
export class MyRule implements Rule {
  metadata: RuleMetadata = {
    id: 'MY-RULE-001',
    name: 'My Rule',
    description: 'Detects something important',
    defaultSeverity: Severity.MEDIUM,
    category: FindingCategory.RECEIPT,
    enabledByDefault: true,
    version: '1.0.0',
  };

  async evaluate(context: ChainContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Query chain state
    const receipts = await context.getReceiptsInChallengeWindow();

    // Evaluate conditions
    for (const receipt of receipts) {
      if (this.isViolation(receipt, context)) {
        findings.push(createFinding({
          ruleId: this.metadata.id,
          title: `Violation detected for ${receipt.id}`,
          description: `Detailed explanation...`,
          severity: this.metadata.defaultSeverity,
          category: this.metadata.category,
          blockNumber: context.currentBlock,
          receiptId: receipt.id,
          recommendedAction: ActionType.OPEN_DISPUTE,
        }));
      }
    }

    return findings;
  }

  private isViolation(receipt: ReceiptInfo, context: ChainContext): boolean {
    // Detection logic
    return false;
  }
}
```

### Rule Guidelines

1. **Keep rules focused**: One rule, one type of violation
2. **Be conservative**: Prefer false negatives over false positives
3. **Include context**: Findings should have enough detail for humans to verify
4. **Test thoroughly**: Unit tests with various chain states
5. **Document clearly**: Explain what the rule detects and why

## Built-in Rules

### SAMPLE-001: Challenge Window Monitor
Detects receipts approaching their challenge deadline.

**Triggers when**: Receipt challenge deadline is less than 10 minutes away

**Recommended action**: MANUAL_REVIEW

### MOCK-ALWAYS-FIND: Test Rule
Always produces a finding. Used for testing.

**Triggers when**: Always

**Recommended action**: NONE

## Future Rules (Not Yet Implemented)

- **TIMEOUT-001**: Receipt expired without finalization
- **BOND-001**: Solver bond below threshold
- **DISPUTE-001**: Dispute approaching resolution deadline
- **SLIPPAGE-001**: Execution outcome differs from intent constraints

## Error Handling

Rules should not throw exceptions for expected conditions. Exceptions indicate bugs:

```typescript
async evaluate(context: ChainContext): Promise<Finding[]> {
  try {
    // Rule logic
  } catch (error) {
    // Log error, return empty findings
    // The engine will record this as a failed rule
    throw error;
  }
}
```

The engine catches rule exceptions and:
1. Logs the error
2. Continues with remaining rules
3. Reports the failure in `ruleResults`

## Performance Considerations

- Rules should complete within the timeout (default 30s)
- Use batched queries when possible
- Cache repeated chain queries in the context
- Monitor rule execution times in production
