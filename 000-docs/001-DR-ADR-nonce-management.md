# ADR-001: Nonce Management

**Status:** Accepted
**Date:** 2026-02-06
**Decision Makers:** Jeremy Longshore

## Context

IRSB agents (solvers, watchtowers) need to submit signed transactions to Ethereum. Each transaction requires a nonce - a sequential counter that prevents replay attacks.

Multiple agents sharing nonce management creates race conditions:
- Two agents could try to use the same nonce simultaneously
- Failed transactions leave "holes" in the nonce sequence
- Nonce reservation tokens add significant complexity

## Decision

**The signing gateway (agent-passkey) owns nonce management.**

### Implementation

1. **Centralized Nonce Counter**: The gateway maintains a per-agent nonce counter in memory, backed by persistent storage for recovery.

2. **Transaction Building**: The gateway builds the complete transaction (not just signs a digest). This includes:
   - Nonce assignment
   - Gas estimation (or using provided values)
   - EIP-155 chain ID encoding
   - Full RLP encoding

3. **Idempotency**: Each signing request has a unique `requestId`. The gateway tracks used IDs to prevent double-signing.

4. **Nonce Recovery**: On transaction failure (revert/drop), the gateway reclaims the nonce for reuse.

### API Impact

Agents submit high-level `IrsbAction` objects, not raw transaction data:

```typescript
// Agent sends:
{
  requestId: "uuid",
  agentId: "solver-1",
  role: "SOLVER",
  chainId: 1,
  to: "0x...",
  action: {
    action: "SUBMIT_RECEIPT",
    intentId: "0x...",
    receiptHash: "0x...",
    evidenceHash: "0x..."
  },
  value: "0",
  expiresAt: 1234567890
}

// Gateway returns:
{
  requestId: "uuid",
  signedTx: "0x...",
  txHash: "0x...",
  auditId: "uuid"
}
```

## Consequences

### Positive

- **No nonce races**: Single source of truth for each agent's nonce
- **Simpler agent code**: Agents don't manage transaction details
- **Better audit trail**: All transactions flow through one point
- **Easier recovery**: Gateway can detect and fix nonce gaps

### Negative

- **Single point of failure**: Gateway downtime blocks all signing
- **State to manage**: Nonce counters need persistent storage
- **Latency**: Extra round-trip compared to local signing

### Mitigations

- **High availability**: Deploy gateway as multi-replica Cloud Run service
- **Persistent storage**: Use Redis or Firestore for nonce state
- **Chain sync**: Periodically sync nonce with on-chain state

## Alternatives Considered

### 1. Agent-Managed Nonces

Each agent manages its own nonce counter.

**Rejected because:**
- Race conditions when multiple agent instances run
- Harder to implement reliable recovery
- Duplicates nonce logic across all agent types

### 2. Nonce Reservation Tokens

Gateway issues "nonce reservation tokens" that agents use when building transactions.

**Rejected because:**
- Adds complexity without solving the core problem
- Still requires coordination on token expiry
- Doesn't prevent the gateway from knowing the nonce anyway

### 3. Transaction-as-a-Service

Agents submit intents, gateway submits transactions.

**Rejected for MVP because:**
- Larger scope change
- Conflates signing authority with execution
- May be a future enhancement (H2 phase)

## References

- [EIP-155: Simple Replay Attack Protection](https://eips.ethereum.org/EIPS/eip-155)
- [Nonce Management in Ethereum](https://docs.alchemy.com/docs/how-to-manage-nonces)
