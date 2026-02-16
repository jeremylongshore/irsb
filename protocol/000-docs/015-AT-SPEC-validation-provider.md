# IRSB as an ERC-8004 Validation Provider

This document describes how IRSB Protocol functions as a **Validation Provider** in the ERC-8004 ecosystem, enabling portable trust signals that external systems can consume.

## Overview

IRSB is not a competing "phonebook" or registry - it's a **credible accountability engine** that generates high-signal outcomes. The ERC-8004 Adapter allows these outcomes to be consumed by external validation registries, creating portable reputation across the ecosystem.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IRSB Core Protocol                            │
├─────────────────┬───────────────────┬───────────────────────────────┤
│ SolverRegistry  │ IntentReceiptHub  │ OptimisticDisputeModule       │
│ (Bonds)         │ (Receipts)        │ (Disputes)                    │
└────────┬────────┴─────────┬─────────┴───────────────┬───────────────┘
         │                  │                         │
         │                  ▼                         │
         │         ┌─────────────────┐                │
         │         │ ERC8004Adapter  │◄───────────────┘
         │         │                 │
         │         │ Validation      │
         │         │ Provider        │
         │         └────────┬────────┘
         │                  │
         │                  ▼
         │         ┌─────────────────┐
         │         │ External        │
         │         │ Registry        │
         │         │ (Optional)      │
         │         └─────────────────┘
         │
         ▼
  Portable Trust Signals
```

## Signal Types

IRSB emits four validation outcome signals:

| Outcome | Description | Registry Success |
|---------|-------------|------------------|
| `Finalized` | Receipt completed challenge window successfully | `true` |
| `Slashed` | Solver was slashed (deterministic or optimistic) | `false` |
| `DisputeWon` | Solver won a dispute against challenger | `true` |
| `DisputeLost` | Solver lost a dispute (challenger won) | `false` |

## Integration Architecture

### Components

**ERC8004Adapter** (`src/adapters/ERC8004Adapter.sol`)
- Receives signals from IntentReceiptHub and OptimisticDisputeModule
- Emits standardized `ValidationSignalEmitted` events
- Optionally pushes to external registry (non-reverting)
- Maintains local signal statistics

**IValidationRegistry** (`src/interfaces/IValidationRegistry.sol`)
- Standard interface for external registries
- Methods: `recordValidation`, `getValidationCount`, `getValidation`, `isValidated`

**MockERC8004Registry** (`src/mocks/MockERC8004Registry.sol`)
- Test implementation of IValidationRegistry
- Includes failure simulation for robustness testing

### Non-Reverting Design

**Critical**: The adapter is designed to NEVER block core IRSB operations.

```solidity
// Registry calls use try/catch to prevent failures from reverting
if (address(registry) != address(0)) {
    try registry.recordValidation(taskId, agentId, success) {
        emit ValidationRecorded(taskId, agentId, address(registry));
    } catch {
        // Registry call failed - emit but don't revert
        // This ensures IRSB core operations are never blocked
    }
}
```

This means:
- If the registry is unavailable, signals still emit locally
- Registry bugs cannot halt IRSB operations
- External dependencies cannot grief the protocol

## Events

### ValidationSignalEmitted

```solidity
event ValidationSignalEmitted(
    bytes32 indexed taskId,   // Receipt ID
    bytes32 indexed agentId,  // Solver ID
    ValidationOutcome outcome, // Finalized/Slashed/DisputeWon/DisputeLost
    uint256 timestamp
);
```

Indexed by `taskId` and `agentId` for efficient filtering.

### ValidationRecorded

```solidity
event ValidationRecorded(
    bytes32 indexed taskId,
    bytes32 indexed agentId,
    address indexed registry
);
```

Emitted when a validation is successfully written to an external registry.

## Usage Patterns

### For IRSB Protocol (Internal)

The IntentReceiptHub and OptimisticDisputeModule call the adapter when:

1. **Receipt Finalization**
   ```solidity
   adapter.signalFinalized(receiptId, solverId);
   ```

2. **Deterministic Slash**
   ```solidity
   adapter.signalSlashed(receiptId, solverId, slashAmount);
   ```

3. **Optimistic Dispute Won (Solver Wins)**
   ```solidity
   adapter.signalDisputeWon(receiptId, solverId);
   ```

4. **Optimistic Dispute Lost (Challenger Wins)**
   ```solidity
   adapter.signalDisputeLost(receiptId, solverId, slashAmount);
   ```

### For External Indexers

External systems can consume signals by:

1. **Watching Events**
   ```typescript
   // Using ethers.js
   const adapter = new Contract(ADAPTER_ADDRESS, ERC8004AdapterABI, provider);

   adapter.on('ValidationSignalEmitted', (taskId, agentId, outcome, timestamp) => {
     console.log(`Signal: ${taskId} -> ${agentId} = ${outcome}`);
   });
   ```

2. **Querying Statistics**
   ```typescript
   const [finalized, slashed, disputeWon, disputeLost] =
     await adapter.getAllOutcomeStats();

   console.log(`Total Finalized: ${finalized}`);
   console.log(`Total Slashed: ${slashed}`);
   ```

3. **Via External Registry**
   ```typescript
   const registry = new Contract(REGISTRY_ADDRESS, RegistryABI, provider);

   const [total, successful] = await registry.getValidationCount(solverId);
   const successRate = (successful * 100n) / total;
   ```

## Subgraph Integration

For efficient querying, deploy a subgraph that indexes `ValidationSignalEmitted` events:

```yaml
# subgraph.yaml
dataSources:
  - kind: ethereum/contract
    name: ERC8004Adapter
    source:
      address: "0x..."
      abi: ERC8004Adapter
    mapping:
      eventHandlers:
        - event: ValidationSignalEmitted(indexed bytes32,indexed bytes32,uint8,uint256)
          handler: handleValidationSignal
```

```typescript
// mappings/adapter.ts
export function handleValidationSignal(event: ValidationSignalEmitted): void {
  let id = event.params.taskId.toHexString();

  let signal = new ValidationSignal(id);
  signal.taskId = event.params.taskId;
  signal.agentId = event.params.agentId;
  signal.outcome = event.params.outcome;
  signal.timestamp = event.params.timestamp;
  signal.save();

  // Update agent statistics
  let agent = Agent.load(event.params.agentId.toHexString());
  if (agent) {
    agent.totalSignals = agent.totalSignals.plus(BigInt.fromI32(1));
    if (event.params.outcome == 1 || event.params.outcome == 3) {
      // Finalized or DisputeWon
      agent.successfulSignals = agent.successfulSignals.plus(BigInt.fromI32(1));
    }
    agent.save();
  }
}
```

## Authorization Model

```
┌─────────────┐
│   Owner     │ Can: setAuthorizedHub, setRegistry
└──────┬──────┘
       │ grants
       ▼
┌─────────────┐
│ Authorized  │ Can: emit signals (signalFinalized, signalSlashed, etc.)
│ Hubs        │
└─────────────┘
```

- Only authorized hubs (IntentReceiptHub, DisputeModule) can emit signals
- Owner can also emit signals directly (for administrative purposes)
- Registry address can be changed by owner (including set to zero to disable)

## Security Considerations

### Trust Boundaries

1. **Signal Source**: Signals are only as trustworthy as the IRSB protocol itself
2. **Registry Independence**: External registries should validate signals, not blindly trust
3. **No Private Data**: Signals contain only public identifiers, no sensitive metadata

### Attack Vectors Mitigated

| Attack | Mitigation |
|--------|------------|
| Signal Spoofing | Only authorized hubs can emit |
| Registry Griefing | Non-reverting registry calls |
| Signal Flooding | Rate limited by IRSB operations |
| Metadata Leakage | Only IDs emitted, no payloads |

### Recommended Registry Practices

If implementing an external registry that consumes IRSB signals:

1. **Verify Signal Source**: Only accept signals from known adapter addresses
2. **Cross-Reference**: Compare with on-chain IRSB state for high-value decisions
3. **Rate Limiting**: Implement per-agent signal rate limits
4. **Dispute Buffer**: Don't finalize reputation until challenge window passes

## Deployment

### Initial Setup

```bash
# Deploy adapter with IntentReceiptHub as initial authorized hub
forge script script/DeployAdapter.s.sol --broadcast

# Or manually:
ERC8004Adapter adapter = new ERC8004Adapter(hubAddress);
```

### Adding Dispute Module

```solidity
// After deploying OptimisticDisputeModule
adapter.setAuthorizedHub(address(optimisticDisputeModule), true);
```

### Connecting Registry

```solidity
// Connect to external registry
adapter.setRegistry(registryAddress);

// Disable registry (signals still emit locally)
adapter.setRegistry(address(0));
```

## Statistics & Monitoring

The adapter maintains on-chain statistics:

```solidity
// Total signals emitted
uint256 public totalSignals;

// Breakdown by outcome
mapping(ValidationOutcome => uint256) public signalsByOutcome;

// Convenience view
function getAllOutcomeStats() external view returns (
    uint256 finalized,
    uint256 slashed,
    uint256 disputeWon,
    uint256 disputeLost
);
```

### Monitoring Checklist

- [ ] Track `ValidationSignalEmitted` events for real-time signals
- [ ] Monitor `totalSignals` growth rate
- [ ] Alert on unusual `Slashed` / `DisputeLost` ratios
- [ ] Verify registry writes with `ValidationRecorded` events
- [ ] Check for registry disconnections (signals without records)

## Future Extensions

### Multi-Registry Support

The current design supports a single registry. A future version could support multiple:

```solidity
// Not implemented yet - potential extension
mapping(address => bool) public activeRegistries;

function addRegistry(address registry) external onlyOwner;
function removeRegistry(address registry) external onlyOwner;
```

### Signal Batching

For gas optimization with high signal volume:

```solidity
// Not implemented yet - potential extension
function signalBatch(ValidationSignal[] calldata signals) external onlyAuthorizedHub;
```

### Cross-Chain Signals

Using messaging protocols to propagate signals cross-chain:

```solidity
// Not implemented yet - potential extension
function bridgeSignal(uint256 destChainId, bytes32 taskId, bytes32 agentId) external;
```

## Related Documents

- [IRSB Protocol Overview](./001-RL-PROP-irsb-solver-accountability.md)
- [Privacy Architecture](./PRIVACY.md)
- [Receipt Schema](./007-AT-SPEC-irsb-receipt-schema.md)

## References

- [ERC-8004 Proposal](https://eips.ethereum.org/EIPS/eip-8004) (Draft)
- [ERC-7683 Cross Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)
