# Finding Schema

## Overview

A **Finding** represents a detected issue or notable event discovered by the watchtower's rule engine. Findings are the primary output of the monitoring system.

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Finding",
  "type": "object",
  "required": [
    "id", "ruleId", "title", "description", "severity",
    "category", "timestamp", "blockNumber", "recommendedAction",
    "actedUpon"
  ],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique identifier for this finding"
    },
    "ruleId": {
      "type": "string",
      "description": "ID of the rule that generated this finding"
    },
    "title": {
      "type": "string",
      "description": "Human-readable title"
    },
    "description": {
      "type": "string",
      "description": "Detailed description of the finding"
    },
    "severity": {
      "type": "string",
      "enum": ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    },
    "category": {
      "type": "string",
      "enum": ["RECEIPT", "BOND", "DISPUTE", "SOLVER", "ESCROW", "SYSTEM"]
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "When the finding was created"
    },
    "blockNumber": {
      "type": "string",
      "description": "Block number where issue was detected (as string for bigint)"
    },
    "txHash": {
      "type": "string",
      "description": "Transaction hash if applicable"
    },
    "contractAddress": {
      "type": "string",
      "description": "Contract address involved"
    },
    "solverId": {
      "type": "string",
      "description": "Solver ID if applicable"
    },
    "receiptId": {
      "type": "string",
      "description": "Receipt ID if applicable"
    },
    "recommendedAction": {
      "type": "string",
      "enum": ["NONE", "OPEN_DISPUTE", "SUBMIT_EVIDENCE", "ESCALATE", "NOTIFY", "MANUAL_REVIEW"]
    },
    "metadata": {
      "type": "object",
      "description": "Additional context as key-value pairs"
    },
    "actedUpon": {
      "type": "boolean",
      "description": "Whether this finding has been acted upon"
    },
    "actionTxHash": {
      "type": "string",
      "description": "Transaction hash of action taken (if any)"
    }
  }
}
```

## Severity Levels

| Level | Description | Example |
|-------|-------------|---------|
| INFO | Informational, no action needed | Solver registered |
| LOW | Monitor situation | Solver bond below optimal |
| MEDIUM | May require action | Receipt approaching deadline |
| HIGH | Action recommended | Receipt violated constraints |
| CRITICAL | Immediate action required | Solver bond slashed to zero |

## Categories

| Category | Description |
|----------|-------------|
| RECEIPT | Receipt-related violations |
| BOND | Bond-related violations |
| DISPUTE | Dispute-related findings |
| SOLVER | Solver behavior findings |
| ESCROW | Escrow-related findings |
| SYSTEM | System/operational findings |

## Recommended Actions

| Action | Description |
|--------|-------------|
| NONE | No action needed |
| OPEN_DISPUTE | Open a dispute against receipt |
| SUBMIT_EVIDENCE | Submit evidence for existing dispute |
| ESCALATE | Escalate to arbitration |
| NOTIFY | Notify operator/user |
| MANUAL_REVIEW | Human review required |

## Examples

### Receipt Approaching Challenge Deadline

```json
{
  "id": "SAMPLE-001-1000000-1699996400000",
  "ruleId": "SAMPLE-001",
  "title": "Receipt abc123... approaching challenge deadline",
  "description": "Receipt 0xabc123... from solver 0xdef456... will reach its challenge deadline in 5 minutes. If this receipt contains violations, a dispute should be opened now.",
  "severity": "MEDIUM",
  "category": "RECEIPT",
  "timestamp": "2024-11-14T10:00:00.000Z",
  "blockNumber": "1000000",
  "receiptId": "0xabc123...",
  "solverId": "0xdef456...",
  "txHash": "0x789abc...",
  "recommendedAction": "MANUAL_REVIEW",
  "metadata": {
    "challengeDeadline": "2024-11-14T10:05:00.000Z",
    "timeUntilDeadlineMs": 300000,
    "intentHash": "0xfed987..."
  },
  "actedUpon": false
}
```

### Solver Slashed (Critical)

```json
{
  "id": "BOND-001-1000500-1699996500000",
  "ruleId": "BOND-001",
  "title": "Solver 0xdef456... bond slashed",
  "description": "Solver bond was slashed from 0.1 ETH to 0.02 ETH following dispute resolution. Solver may be unable to process new intents.",
  "severity": "CRITICAL",
  "category": "BOND",
  "timestamp": "2024-11-14T10:01:40.000Z",
  "blockNumber": "1000500",
  "solverId": "0xdef456...",
  "txHash": "0x999aaa...",
  "contractAddress": "0xB6ab964832808E49635fF82D1996D6a888ecB745",
  "recommendedAction": "NOTIFY",
  "metadata": {
    "previousBond": "100000000000000000",
    "currentBond": "20000000000000000",
    "slashAmount": "80000000000000000",
    "reason": "Timeout violation"
  },
  "actedUpon": false
}
```

### Mock Finding (Testing)

```json
{
  "id": "MOCK-ALWAYS-FIND-1000000-1699996400000",
  "ruleId": "MOCK-ALWAYS-FIND",
  "title": "Mock finding for testing",
  "description": "This is a mock finding produced for testing purposes.",
  "severity": "INFO",
  "category": "SYSTEM",
  "timestamp": "2024-11-14T10:00:00.000Z",
  "blockNumber": "1000000",
  "recommendedAction": "NONE",
  "metadata": {
    "mockData": true,
    "evaluatedAt": "2024-11-14T10:00:00.000Z"
  },
  "actedUpon": false
}
```

## Serialization

When transmitting Findings (API responses, logs), `bigint` values are serialized as strings:

```typescript
function serializeFinding(finding: Finding): Record<string, unknown> {
  return {
    ...finding,
    blockNumber: finding.blockNumber.toString(),
    timestamp: finding.timestamp.toISOString(),
  };
}
```

## ID Format

Finding IDs follow the pattern: `{ruleId}-{blockNumber}-{timestamp}`

This ensures:
- Uniqueness across rules and blocks
- Traceability back to the generating rule
- Rough ordering by time
