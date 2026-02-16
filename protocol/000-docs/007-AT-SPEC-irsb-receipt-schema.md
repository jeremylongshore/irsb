# IRSB Intent Receipt Schema Specification

**Document ID:** 007-AT-SPEC-irsb-receipt-schema
**Status:** Draft (ERC-7683 Extension Proposal)
**Created:** 2026-01-25
**Author:** IRSB Protocol Team

---

## 1. Abstract

This document specifies the canonical receipt format for Intent Receipts & Solver Bonds (IRSB) protocol. The schema is designed as a proposed extension to ERC-7683 Cross Chain Intents, providing standardized proof-of-execution that enables automated accountability.

## 2. Motivation

ERC-7683 defines cross-chain intents but lacks standardized proof-of-execution. This creates:

- No verifiable record of solver performance
- Manual, slow dispute resolution (21+ days via DAO votes)
- Inability to build portable solver reputation
- Wallets cannot make informed routing decisions

This receipt schema addresses these gaps by providing:

1. **Standardized proof format** - Consistent structure across all intent protocols
2. **Deterministic verification** - On-chain constraints enable automated checks
3. **Cross-protocol compatibility** - Works with Across, CoWSwap, 1inch, etc.
4. **Wallet integration** - Enables risk-aware solver selection

## 3. Receipt Structure

### 3.1 On-Chain Receipt (`IntentReceipt`)

```solidity
struct IntentReceipt {
    bytes32 intentHash;         // Unique identifier for the original intent
    bytes32 constraintsHash;    // Hash of execution constraints
    bytes32 routeHash;          // Hash of execution route/path
    bytes32 outcomeHash;        // Hash of actual execution result
    bytes32 evidenceHash;       // IPFS/Arweave CID of evidence bundle
    uint64 createdAt;           // Receipt creation timestamp
    uint64 expiry;              // Deadline for settlement proof
    bytes32 solverId;           // Solver identifier in registry
    bytes solverSig;            // ECDSA signature (EIP-712)
}
```

### 3.2 Field Specifications

#### `intentHash`
Uniquely identifies the original user intent. Computed from:
- Origin chain ID
- Origin token and amount
- Destination chain ID
- Recipient address
- Protocol-specific identifier (e.g., Across `depositId`)

```solidity
intentHash = keccak256(abi.encode(
    "INTENT_V1",
    originChainId,
    originToken,
    inputAmount,
    destinationChainId,
    recipient,
    protocolSpecificId
))
```

#### `constraintsHash`
Hash of the `ConstraintEnvelope` defining execution requirements:

```solidity
struct ConstraintEnvelope {
    uint256[] chainIds;         // Allowed execution chains
    address[] tokensIn;         // Input tokens
    address[] tokensOut;        // Output tokens
    uint256[] minOut;           // Minimum output amounts
    uint256 maxSlippageBps;     // Max slippage (basis points)
    uint64 deadline;            // Intent expiration
    address[] allowedVenues;    // Optional: allowed DEXs/bridges
    bytes32[] requiredProofs;   // Optional: required attestations
}
```

#### `routeHash`
Hash of execution path information:
- Source and destination chains
- Token pair
- Bridge/protocol used
- Intermediate hops (if any)

#### `outcomeHash`
Hash of the `OutcomeEnvelope` documenting actual execution:

```solidity
struct OutcomeEnvelope {
    uint256 finalChainId;       // Chain where settlement occurred
    address tokenOut;           // Actual output token
    uint256 amountOut;          // Actual output amount
    address recipient;          // Actual recipient
    bytes32[] txHashes;         // Settlement transaction hashes
}
```

#### `evidenceHash`
Content-addressed hash (IPFS CID or Arweave TX) pointing to:
- Full transaction data
- Block headers for cross-chain verification
- Merkle proofs if applicable
- Additional attestations

#### `solverId`
Bytes32 identifier linking to `SolverRegistry` entry. Computed at registration:

```solidity
solverId = keccak256(abi.encodePacked(
    operator,
    block.timestamp,
    totalSolvers
))
```

#### `solverSig`
ECDSA signature over receipt fields using EIP-712 typed data:

```solidity
bytes32 messageHash = keccak256(abi.encode(
    intentHash,
    constraintsHash,
    routeHash,
    outcomeHash,
    evidenceHash,
    createdAt,
    expiry,
    solverId
));
bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
// Sign with solver operator key
```

## 4. Receipt Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Posted    │────►│   Pending   │────►│  Finalized  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐     ┌─────────────┐
                   │  Disputed   │────►│   Slashed   │
                   └─────────────┘     └─────────────┘
```

### States

| State | Description | Duration |
|-------|-------------|----------|
| `Pending` | Posted, within challenge window | 1 hour (configurable) |
| `Disputed` | Challenge opened, under review | Up to 24 hours |
| `Finalized` | Challenge window passed, no disputes | Terminal |
| `Slashed` | Dispute upheld, solver penalized | Terminal |

## 5. Dispute Reason Codes

```solidity
enum DisputeReason {
    None,               // 0x00 - No dispute
    Timeout,            // 0x01 - Expiry passed without settlement
    MinOutViolation,    // 0x02 - amountOut < minOut
    WrongToken,         // 0x03 - Incorrect token delivered
    WrongChain,         // 0x04 - Settled on wrong chain
    WrongRecipient,     // 0x05 - Delivered to wrong address
    ReceiptMismatch,    // 0x06 - Receipt hash mismatch
    InvalidSignature,   // 0x07 - Solver signature invalid
    Subjective          // 0x08 - Requires arbitration
}
```

### Deterministic vs Subjective

| Code | Type | Resolution |
|------|------|------------|
| 0x01-0x07 | Deterministic | Automated on-chain |
| 0x08 | Subjective | Requires arbitrator |

## 6. Protocol Adapter Pattern

Different intent protocols encode intents differently. Adapters translate protocol-specific formats to IRSB receipts.

### 6.1 Across Protocol Adapter

```solidity
struct AcrossDeposit {
    uint256 originChainId;
    uint256 destinationChainId;
    address originToken;
    address destinationToken;
    uint256 inputAmount;
    uint256 outputAmount;
    address depositor;
    address recipient;
    uint256 fillDeadline;
    bytes32 depositId;
    uint256 exclusivityDeadline;
    address exclusiveRelayer;
    bytes message;
}

// Maps to IRSB:
intentHash = keccak256(abi.encode(
    "ACROSS_INTENT_V1",
    deposit.originChainId,
    deposit.originToken,
    deposit.inputAmount,
    deposit.destinationChainId,
    deposit.recipient,
    deposit.depositId
));
```

### 6.2 Future Adapters

| Protocol | Adapter Status | Notes |
|----------|---------------|-------|
| Across | Implemented | First pilot target |
| CoWSwap | Planned | Batch auction model |
| 1inch Fusion | Planned | RFQ-based |
| UniswapX | Planned | Dutch auction |

## 7. Wallet Integration API

Wallets query subgraph for solver risk assessment:

### 7.1 Risk Score Query

```graphql
query SolverRisk($executor: Bytes!) {
  solver(id: $executor) {
    riskScore
    bondBalance
    lockedBalance
    isAboveMinimum
    disputesLost
    totalSlashed
  }
}
```

### 7.2 Recent Receipts Query

```graphql
query RecentReceipts($executor: Bytes!, $limit: Int!) {
  receipts(
    where: { solverId: $executor }
    orderBy: postedAt
    orderDirection: desc
    first: $limit
  ) {
    id
    intentHash
    status
    postedAt
    finalizedAt
    settlementTime
  }
}
```

### 7.3 Bond Status Query

```graphql
query BondStatus($executor: Bytes!) {
  solver(id: $executor) {
    bondBalance
    lockedBalance
    isAboveMinimum
    coverageRatio
    bondEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
      eventType
      amount
      timestamp
    }
  }
}
```

## 8. Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MINIMUM_BOND` | 0.1 ETH | Solver activation threshold |
| `CHALLENGE_WINDOW` | 1 hour | Time to dispute receipt |
| `EVIDENCE_WINDOW` | 24 hours | Evidence submission period |
| `ARBITRATION_TIMEOUT` | 7 days | Default resolution deadline |
| `CHALLENGER_BOND_BPS` | 1000 (10%) | Anti-griefing bond |
| `DECAY_HALF_LIFE` | 30 days | Reputation decay rate |

## 9. Slash Distribution

| Recipient | Standard | Arbitration |
|-----------|----------|-------------|
| User | 80% | 70% |
| Challenger | 15% | 0% |
| Treasury | 5% | 20% |
| Arbitrator | 0% | 10% |

## 10. Gas Considerations

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Post Receipt | ~50,000 | Single receipt |
| Open Dispute | ~80,000 | Includes bond lock |
| Finalize | ~30,000 | Batch possible |
| Slash | ~100,000 | Includes transfer |

## 11. Security Considerations

### 11.1 Signature Verification
- EIP-712 typed data prevents cross-domain replay
- Message includes `solverId` preventing operator spoofing
- Timestamp binding prevents stale signature reuse

### 11.2 Front-Running Protection
- Receipt posting is permissioned (only solver operator)
- Challenge window provides finality assurance
- Challenger bond prevents griefing

### 11.3 Cross-Chain Verification
- Evidence hash links to provable settlement data
- Block headers enable light client verification
- Merkle proofs for transaction inclusion

## 12. Future Extensions

### 12.1 Batch Receipts
Multi-receipt posting for high-volume solvers:
```solidity
function batchPostReceipts(
    IntentReceipt[] calldata receipts
) external returns (bytes32[] memory);
```

### 12.2 Merkle Receipt Trees
Compress many receipts into single on-chain commitment:
```solidity
struct ReceiptTreeCommitment {
    bytes32 root;
    uint256 count;
    bytes32[] leaves;
}
```

### 12.3 ZK Validity Proofs
Replace evidence hash with zkSNARK proof of valid execution:
```solidity
struct ZKReceipt {
    bytes32 intentHash;
    bytes32 publicInputsHash;
    bytes proof;
}
```

## 13. References

- [ERC-7683: Cross Chain Intents](https://eips.ethereum.org/EIPS/eip-7683)
- [EIP-712: Typed Structured Data Hashing](https://eips.ethereum.org/EIPS/eip-712)
- [Across Protocol Documentation](https://docs.across.to/)
- IRSB Protocol Specification (003-AT-SPEC-irsb-eip-spec.md)

---

## Appendix A: TypeScript Types

```typescript
interface IntentReceipt {
  intentHash: string;      // bytes32
  constraintsHash: string; // bytes32
  routeHash: string;       // bytes32
  outcomeHash: string;     // bytes32
  evidenceHash: string;    // bytes32
  createdAt: bigint;       // uint64
  expiry: bigint;          // uint64
  solverId: string;        // bytes32
  solverSig: string;       // bytes
}

interface ConstraintEnvelope {
  chainIds: bigint[];
  tokensIn: string[];
  tokensOut: string[];
  minOut: bigint[];
  maxSlippageBps: bigint;
  deadline: bigint;
  allowedVenues?: string[];
  requiredProofs?: string[];
}

interface OutcomeEnvelope {
  finalChainId: bigint;
  tokenOut: string;
  amountOut: bigint;
  recipient: string;
  txHashes: string[];
}
```

## Appendix B: Example Receipt

```json
{
  "intentHash": "0x1234...abcd",
  "constraintsHash": "0x5678...efgh",
  "routeHash": "0x9abc...ijkl",
  "outcomeHash": "0xdef0...mnop",
  "evidenceHash": "0xQmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o",
  "createdAt": 1737849600,
  "expiry": 1737853200,
  "solverId": "0xabcd...1234",
  "solverSig": "0x..."
}
```

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01-25 | Initial draft |
