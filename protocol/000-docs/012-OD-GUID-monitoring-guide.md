# IRSB Protocol Monitoring Checklist

This document outlines the monitoring strategy for IRSB protocol contracts and infrastructure.

## Critical Metrics to Monitor

### Contract State Metrics

| Metric | Threshold | Severity | Action |
|--------|-----------|----------|--------|
| Total solver bonds (wei) | < 1 ETH | Warning | Investigate low participation |
| Active solver count | < 3 | Warning | Marketing/outreach needed |
| Pending dispute count | > 10 | Warning | Review for griefing attacks |
| Unresolved escalations | > 5 | Critical | Arbitrator must act |
| Receipt finalization rate | < 95% | Warning | Investigate dispute patterns |

### Event Monitoring

Track these events for operational awareness:

```solidity
// SolverRegistry
event SolverRegistered(bytes32 indexed solverId, address indexed operator)
event BondDeposited(bytes32 indexed solverId, uint256 amount)
event SolverSlashed(bytes32 indexed solverId, uint256 amount)
event SolverJailed(bytes32 indexed solverId)
event SolverBanned(bytes32 indexed solverId)

// IntentReceiptHub
event ReceiptPosted(bytes32 indexed receiptId, bytes32 indexed intentHash)
event DisputeOpened(bytes32 indexed receiptId, address indexed challenger)
event DisputeResolved(bytes32 indexed receiptId, bool slashed)
event ChallengerBondForfeited(bytes32 indexed receiptId, address challenger)

// DisputeModule
event DisputeEscalated(bytes32 indexed disputeId, address indexed arbitrator)
event ArbitrationResolved(bytes32 indexed disputeId, bool solverFault)
event ArbitrationFeeForfeited(bytes32 indexed disputeId, address escalator)
```

## Alert Configuration

### P0 - Critical (Immediate Response Required)

| Alert | Condition | Response |
|-------|-----------|----------|
| Contract paused | `Paused` event emitted | Investigate immediately |
| Mass slashing | > 3 slashes in 1 hour | Check for exploit |
| Bond drain | Total bonds < 50% of previous day | Possible vulnerability |
| Arbitration timeout | Escalated dispute > 6 days old | Contact arbitrator |

### P1 - High (Response within 4 hours)

| Alert | Condition | Response |
|-------|-----------|----------|
| Solver banned | `SolverBanned` event | Review for false positive |
| Large slash | Slash > 0.5 ETH | Verify legitimate |
| Dispute spike | > 5 disputes in 1 hour | Check for griefing |
| Failed transaction | Contract reverts > 10/hour | Check gas limits |

### P2 - Medium (Response within 24 hours)

| Alert | Condition | Response |
|-------|-----------|----------|
| Low solver activity | < 5 receipts/day | Monitor trend |
| Evidence spam | > 20 evidence submissions/dispute | Review rate limiting |
| Bond withdrawal spike | > 50% of bonds withdrawn | Monitor solver exodus |

### P3 - Low (Weekly Review)

| Alert | Condition | Response |
|-------|-----------|----------|
| New solver registration | `SolverRegistered` event | Welcome, verify metadata |
| Treasury balance | Total forfeited fees | Schedule withdrawal |
| Gas price spikes | Avg gas > 100 gwei | Consider L2 expansion |

## Monitoring Infrastructure

### The Graph Subgraph

Primary indexing for contract events:

```yaml
# Check indexer health
dataSources:
  - kind: ethereum
    name: SolverRegistry
    network: sepolia
    source:
      address: "0x..."
      abi: SolverRegistry
      startBlock: 7840012

# Query for solver stats
query GetSolverMetrics {
  solvers(where: {status: ACTIVE}) {
    id
    bondBalance
    successRate
    totalVolume
  }
}
```

### RPC Endpoint Monitoring

Configure UptimeRobot or similar for:

- **Sepolia RPC**: Primary endpoint health
- **Amoy RPC**: Polygon testnet health
- **Subgraph endpoint**: GraphQL availability
- **Dashboard**: Frontend uptime

### Dashboard Metrics

Display these metrics on the IRSB dashboard:

```typescript
// Real-time metrics
interface DashboardMetrics {
  totalSolvers: number;
  activeSolvers: number;
  totalBondsStaked: bigint;
  pendingReceipts: number;
  activeDisputes: number;
  last24hReceipts: number;
  last24hDisputes: number;
  avgFinalizationTime: number;
}
```

## Log Aggregation

### Structured Logging Format

```json
{
  "timestamp": "2025-01-28T12:00:00Z",
  "level": "info",
  "event": "ReceiptPosted",
  "chain": "sepolia",
  "txHash": "0x...",
  "receiptId": "0x...",
  "solverId": "0x...",
  "intentHash": "0x...",
  "blockNumber": 7850000,
  "gasUsed": 180000
}
```

### Retention Policy

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Contract events | 1 year | BigQuery |
| Transaction logs | 90 days | CloudWatch |
| Subgraph data | Indefinite | The Graph |
| Dashboard analytics | 1 year | Firebase Analytics |

## Health Check Endpoints

### Subgraph Health

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ _meta { block { number } } }"}' \
  https://api.studio.thegraph.com/query/.../irsb-protocol/v0.0.1

# Expected: block number within 10 of current
```

### Contract State Check

```bash
# Verify contracts are not paused
cast call $SOLVER_REGISTRY "paused()" --rpc-url $RPC_URL
cast call $INTENT_HUB "paused()" --rpc-url $RPC_URL

# Expected: 0x0...0 (false)
```

## Escalation Matrix

| Severity | First Contact | Escalate To | SLA |
|----------|---------------|-------------|-----|
| P0 | On-call engineer | Core team lead | 15 min |
| P1 | On-call engineer | Protocol lead | 4 hours |
| P2 | Monitoring system | On-call engineer | 24 hours |
| P3 | Weekly report | Team review | 7 days |

## Runbooks

See `INCIDENT_PLAYBOOK.md` for response procedures.

### Quick Reference

| Issue | Runbook Section |
|-------|----------------|
| Contract exploit suspected | §1 - Emergency Response |
| Arbitrator unresponsive | §2 - Escalation Timeout |
| Subgraph out of sync | §3 - Infrastructure Issues |
| Gas price spike | §4 - Cost Optimization |
| Solver griefing | §5 - Abuse Prevention |
