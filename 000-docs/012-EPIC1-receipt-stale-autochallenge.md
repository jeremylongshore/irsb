# Epic 1: Receipt Stale Auto-Challenge

## Overview

This epic implements the first production rule for the IRSB Watchtower: detecting and optionally auto-challenging stale receipts that have passed their challenge deadline without being finalized.

## Problem Statement

When a solver posts an intent receipt to the IntentReceiptHub, there is a **challenge window** (typically 1 hour) during which anyone can dispute the receipt. If the receipt is not disputed within this window, it can be finalized, updating the solver's reputation.

**The Problem**: If a receipt passes its challenge deadline but is NOT finalized, this may indicate:
1. The solver failed to complete the intent execution
2. The solver posted an invalid receipt
3. There's a technical issue preventing finalization

Leaving such receipts unaddressed creates uncertainty and potential security issues.

## Solution: Receipt Stale Detection Rule

### Rule Logic

The `RECEIPT_STALE` rule detects receipts that:

1. **Have passed their challenge deadline** - `block.timestamp > receipt.challengeDeadline`
2. **Are NOT finalized** - `receipt.status != 'finalized'`
3. **Are NOT already disputed** - No existing dispute for this receipt
4. **Meet minimum age requirement** - Prevents false positives from timing edge cases

### Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `CHALLENGE_WINDOW_SECONDS` | 3600 | Must match contract parameter |
| `MIN_RECEIPT_AGE_SECONDS` | 3600 | Min time past deadline before flagging |
| `MAX_ACTIONS_PER_SCAN` | 3 | Rate limit on actions per cycle |
| `DRY_RUN` | true | If true, log but don't execute actions |
| `ACTION_ALLOWLIST_SOLVER_IDS` | "" | CSV of solver IDs to monitor (empty = all) |
| `ACTION_ALLOWLIST_RECEIPT_IDS` | "" | CSV of receipt IDs to monitor (empty = all) |
| `BLOCK_CONFIRMATIONS` | 6 | Reorg safety margin |
| `STATE_DIR` | .state | Directory for persistence |

### Safety Gates

Multiple layers of protection prevent unintended behavior:

1. **DRY_RUN Mode** (default: true)
   - Findings are logged but no actions taken
   - Toggle to `false` only after thorough testing

2. **Allowlists**
   - Empty = monitor all solvers/receipts
   - Set specific IDs for targeted monitoring

3. **Rate Limiting**
   - `MAX_ACTIONS_PER_SCAN` caps actions per cycle
   - Prevents spam/gas exhaustion

4. **Idempotency**
   - ActionLedger tracks all executed actions
   - Never acts on the same receipt twice

5. **Block Confirmations**
   - Waits for N confirmations before processing
   - Protects against reorg-induced false positives

## Architecture

### New Components

```
packages/core/
├── src/
│   ├── rules/
│   │   └── receiptStaleRule.ts    # Rule implementation
│   ├── state/
│   │   ├── actionLedger.ts        # Idempotency tracking
│   │   └── blockCursor.ts         # Scan resumption
│   └── actions/
│       └── actionExecutor.ts      # Action execution with safety
```

### Data Flow

```
                                    ┌─────────────────┐
                                    │  IRSB Contracts │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   RPC Provider  │
                                    └────────┬────────┘
                                             │
┌─────────────────────────────────────────────────────────────────┐
│                          Worker Loop                             │
│                                                                  │
│  1. Get current block ─────────────────────────────────────┐     │
│                                                            │     │
│  2. BlockCursor.getStartBlock() ◄──────────────────────────┤     │
│                                                            │     │
│  3. Fetch receipts in challenge window ◄───────────────────┤     │
│                                                            │     │
│  4. Run ReceiptStaleRule.evaluate() ──────────────────┐    │     │
│                                                       │    │     │
│  5. ActionExecutor.executeActions() ◄─────────────────┤    │     │
│     - Check DRY_RUN                                   │    │     │
│     - Check allowlists                                │    │     │
│     - Check rate limit                                │    │     │
│     - Check ActionLedger                              │    │     │
│                                                       │    │     │
│  6. Execute action (if all gates pass) ──────────────────►│     │
│                                                            │     │
│  7. Record to ActionLedger ◄───────────────────────────────┤     │
│                                                            │     │
│  8. Update BlockCursor ◄───────────────────────────────────┘     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Deployment Checklist

### Pre-Deployment

- [ ] Set `DRY_RUN=true` in production
- [ ] Review `MIN_RECEIPT_AGE_SECONDS` (recommend >= challenge window)
- [ ] Verify `CHALLENGE_WINDOW_SECONDS` matches contract
- [ ] Configure appropriate `BLOCK_CONFIRMATIONS`
- [ ] Set `STATE_DIR` to persistent storage

### Staged Rollout

1. **Stage 1: Observation**
   - Deploy with `DRY_RUN=true`
   - Monitor logs for findings
   - Verify no false positives over 24-48 hours

2. **Stage 2: Limited Scope**
   - Keep `DRY_RUN=true`
   - Set `ACTION_ALLOWLIST_SOLVER_IDS` to known test solvers
   - Validate findings match expectations

3. **Stage 3: Controlled Execution**
   - Set `DRY_RUN=false`
   - Keep solver allowlist
   - Set `MAX_ACTIONS_PER_SCAN=1`
   - Monitor action results

4. **Stage 4: Full Production**
   - Clear allowlists
   - Increase `MAX_ACTIONS_PER_SCAN` as needed
   - Continue monitoring

## Finding Schema

```typescript
{
  id: "RECEIPT_STALE-1000000-1234567890-abc123",
  ruleId: "RECEIPT_STALE",
  title: "Stale receipt detected: 0x1234abcd...",
  description: "Receipt 0x... from solver 0x... passed its challenge deadline...",
  severity: "HIGH",
  category: "RECEIPT",
  blockNumber: 1000000n,
  recommendedAction: "OPEN_DISPUTE",
  receiptId: "0x...",
  solverId: "0x...",
  metadata: {
    challengeDeadline: "2024-01-01T00:00:00.000Z",
    ageSeconds: 1800,
    intentHash: "0x...",
    receiptStatus: "pending"
  }
}
```

## Metrics to Monitor

1. **Findings per hour** - Should correlate with legitimate stale receipts
2. **False positive rate** - Track receipts that finalize after being flagged
3. **Action success rate** - Track dispute transaction success
4. **Gas consumption** - Monitor action costs
5. **Ledger size** - Track growth of action history

## Future Enhancements

1. **Evidence Collection** - Attach proof of non-completion to disputes
2. **Multi-sig Actions** - Require approval for high-value disputes
3. **Dynamic Thresholds** - Adjust parameters based on network conditions
4. **Alert Integration** - Push notifications for findings
5. **Dashboard** - Visualize findings and actions
