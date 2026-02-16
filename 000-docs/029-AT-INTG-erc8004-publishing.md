# ERC-8004 Reputation Publishing Guide

How IRSB publishes solver reputation to the ERC-8004 Validation Registry standard.

## Overview

ERC-8004 defines a standard for on-chain agent credibility signals. IRSB publishes solver performance data through the `ERC8004Adapter`, enabling:

- Cross-protocol reputation portability
- Standardized credibility queries
- IntentScore computation

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ IntentReceiptHub│────▶│  ERC8004Adapter │────▶│ Credibility     │
│ SolverRegistry  │     │                 │     │ Registry        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
   finalize()              signalFinalized()       recordValidation()
   slash()                 signalSlashed()         getIntentScore()
```

## Validation Outcomes

IRSB emits four outcome types:

| Outcome | Trigger | Impact |
|---------|---------|--------|
| `Finalized` | Receipt successfully completed | Positive (+) |
| `DisputeWon` | Solver won dispute | Positive (+) |
| `DisputeLost` | Solver lost dispute | Negative (-) |
| `Slashed` | Solver bond slashed | Severe Negative (--) |

## For Solvers: Registering with IRSB

### Step 1: Register as Solver

```solidity
// Register with minimum bond
solverRegistry.registerSolver{value: 0.1 ether}(
    operatorAddress,    // Your operator EOA
    "ipfs://metadata"   // Metadata URI (optional)
);

// Your solver ID
bytes32 solverId = solverRegistry.operatorToSolver(operatorAddress);
```

### Step 2: Deposit Bond

```solidity
// Deposit additional bond for higher limits
solverRegistry.depositBond{value: 1 ether}(solverId);
```

### Step 3: Post Receipts

When you complete intents, post receipts to build reputation:

```solidity
// Build and sign receipt
Types.IntentReceipt memory receipt = buildReceipt(...);

// Post to hub
intentReceiptHub.postReceipt(receipt);
```

### Step 4: Wait for Finalization

After the challenge window (1 hour), receipts auto-finalize:

```solidity
// Anyone can call finalize after challenge window
intentReceiptHub.finalize(receiptId);
// → ERC8004Adapter.signalFinalized() is called
// → Your IntentScore increases
```

## IntentScore Computation

IntentScore is computed from four factors:

```
IntentScore = 40% × SuccessRate
            + 25% × DisputeScore
            + 20% × StakeScore
            + 15% × LongevityScore
```

### Components

| Component | Formula | Range |
|-----------|---------|-------|
| SuccessRate | `finalized / (finalized + slashed)` | 0-100 |
| DisputeScore | `100 - (disputes × 100 / finalized)` | 0-100 |
| StakeScore | `min(stake / 10 ETH × 100, 100)` | 0-100 |
| LongevityScore | `min(finalized × 5, 100)` | 0-100 |

### Example Calculation

```
Solver stats:
- 100 finalized receipts
- 5 disputes (lost)
- 2 ETH staked

SuccessRate = 100 / 105 × 100 = 95%
DisputeScore = 100 - (5 × 100 / 100) = 95%
StakeScore = min(2 / 10 × 100, 100) = 20%
LongevityScore = min(100 × 5, 100) = 100%

IntentScore = (95 × 40 + 95 × 25 + 20 × 20 + 100 × 15) / 100
            = (3800 + 2375 + 400 + 1500) / 100
            = 80.75
```

## Querying Reputation

### Via ERC8004Adapter

```solidity
// Get IntentScore (0-10000 basis points)
uint256 score = adapter.getSolverIntentScore(solverId);

// Get success rate
uint256 rate = adapter.getSolverSuccessRate(solverId);

// Check threshold
bool eligible = adapter.solverMeetsThreshold(
    solverId,
    7500,  // Min IntentScore (75%)
    500    // Max slash rate (5%)
);

// Get full reputation snapshot
ICredibilityRegistry.ReputationSnapshot memory rep =
    adapter.getSolverReputation(solverId);
```

### Via Credibility Registry Directly

```solidity
ICredibilityRegistry registry = ICredibilityRegistry(registryAddress);

// Get full reputation
ICredibilityRegistry.ReputationSnapshot memory rep =
    registry.getReputation(solverId);

// Check fields
uint256 totalTasks = rep.totalTasks;
uint256 successfulTasks = rep.successfulTasks;
uint256 disputedTasks = rep.disputedTasks;
uint256 totalSlashed = rep.totalSlashed;
uint256 intentScore = rep.intentScore;
```

## Signal Events

Monitor these events to track reputation changes:

```solidity
// Emitted on every signal
event ValidationSignalEmitted(
    bytes32 indexed taskId,
    bytes32 indexed agentId,
    ValidationOutcome outcome,
    uint256 timestamp,
    bytes32 evidenceHash,
    bytes metadata
);

// Emitted when recorded to registry
event ValidationRecorded(
    bytes32 indexed taskId,
    bytes32 indexed agentId,
    address indexed registry
);

// Emitted for credibility registry
event CredibilityRecorded(
    bytes32 indexed taskId,
    bytes32 indexed solverId,
    ICredibilityRegistry.OutcomeSeverity severity
);
```

### Indexing Example (The Graph)

```graphql
type ValidationSignal @entity {
  id: ID!
  taskId: Bytes!
  agentId: Bytes!
  outcome: Int!
  timestamp: BigInt!
  evidenceHash: Bytes
}

type SolverReputation @entity {
  id: ID! # solverId
  totalSignals: BigInt!
  finalized: BigInt!
  slashed: BigInt!
  disputeWon: BigInt!
  disputeLost: BigInt!
  intentScore: BigInt!
}
```

## Verifying Registry Updates

### On-Chain Verification

```solidity
// Check if signal was recorded
(uint256 finalized, uint256 slashed, , ) = adapter.getAllOutcomeStats();

// Verify specific solver
uint256 score = adapter.getSolverIntentScore(solverId);
require(score > 0, "Solver not in registry");
```

### Off-Chain Verification

```typescript
import { ethers } from 'ethers';

const adapter = new ethers.Contract(adapterAddress, ABI, provider);

// Listen for signals
adapter.on('ValidationSignalEmitted', (taskId, agentId, outcome, timestamp) => {
  console.log(`Signal: ${taskId} → ${outcome}`);
});

// Query current stats
const [finalized, slashed, disputeWon, disputeLost] =
  await adapter.getAllOutcomeStats();
console.log(`Stats: ${finalized} finalized, ${slashed} slashed`);
```

## Deployment Addresses

### Sepolia Testnet

| Contract | Address |
|----------|---------|
| ERC8004Adapter | `0x...` (deploy pending) |
| CredibilityRegistry | `0x...` (deploy pending) |

### Mainnet

| Contract | Address |
|----------|---------|
| ERC8004Adapter | TBD (post-audit) |
| CredibilityRegistry | TBD (post-audit) |

## Best Practices

### For Solvers

1. **Maintain high completion rate** - Finalized receipts boost score
2. **Avoid disputes** - Even winning disputes doesn't help as much as no disputes
3. **Stake appropriately** - Higher stake = higher score ceiling
4. **Build longevity** - More receipts = more trust

### For Protocols Integrating IRSB

1. **Set minimum IntentScore** for your use case:
   - Low-value: 5000+ (50%)
   - Medium-value: 7000+ (70%)
   - High-value: 8500+ (85%)

2. **Check slash rate** - `maxSlashRate` of 500 (5%) is reasonable

3. **Combine with other signals** - IntentScore is one input, not the only one

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| IntentScore is 0 | No registry configured | Check `credibilityRegistry` is set |
| Signal not recorded | Registry call failed | Check registry is deployed and authorized |
| Score not updating | Cached value | Wait for next block or call `getReputation()` directly |
| Missing events | Adapter not authorized | Check `authorizedHubs` mapping |
