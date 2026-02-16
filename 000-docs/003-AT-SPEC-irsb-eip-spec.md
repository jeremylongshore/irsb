---
eip: XXXX
title: Intent Receipts & Solver Bonds (IRSB)
description: A standardized accountability layer for intent-based transaction systems
author: Jeremy Longshore (@jeremylongshore)
discussions-to: https://ethereum-magicians.org/t/eip-xxxx-intent-receipts-solver-bonds
status: Draft
type: Standards Track
category: ERC
created: 2026-01-13
requires: 7683
---

## Abstract

This EIP defines a standardized accountability layer for intent-based transaction systems. It introduces **Intent Receipts**—canonical, on-chain-verifiable records proving intent execution—and **Solver Bonds**—staked collateral subject to slashing for provable violations. Together, these primitives enable deterministic enforcement of intent execution guarantees, providing economic protection for users and reputation signals for solvers.

## Motivation

Intent-based architectures (as standardized in [ERC-7683](./eip-7683.md)) delegate execution to third-party "solvers" who find optimal paths to fulfill user-specified outcomes. While this model improves UX by abstracting complexity, it introduces trust assumptions:

1. **No execution guarantee**: Users cannot verify that solvers executed intents as promised
2. **No economic recourse**: Users have no compensation mechanism when solvers fail or misbehave
3. **No reputation signal**: Protocols cannot differentiate reliable solvers from unreliable ones
4. **No standardized evidence**: Disputes rely on ad-hoc, protocol-specific mechanisms

As intent adoption grows—accelerated by account abstraction (EIP-7702) and cross-chain standardization (ERC-7683)—these gaps become critical infrastructure risks. IRSB addresses them by providing:

- **Canonical receipts** that prove execution claims
- **Bonded collateral** that can be slashed for violations
- **Deterministic enforcement** for provable constraint violations
- **Reputation primitives** derived from on-chain execution history

## Specification

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119 and RFC 8174.

### Definitions

| Term | Definition |
|------|------------|
| Intent | A user's desired outcome, not a specific execution path |
| Solver | An entity that executes intents on behalf of users |
| Receipt | An on-chain record claiming intent execution |
| Bond | Collateral staked by a solver, subject to slashing |
| Constraint | A condition that must hold for valid execution |
| Evidence | Off-chain data proving execution details |

### Core Data Structures

#### IntentReceipt

```solidity
struct IntentReceipt {
    bytes32 intentHash;        // Hash of the original intent
    bytes32 constraintsHash;   // Hash of execution constraints
    bytes32 routeHash;         // Hash of execution route/path
    bytes32 outcomeHash;       // Hash of claimed outcome
    bytes32 evidenceHash;      // Hash of off-chain evidence bundle
    uint64 createdAt;          // Timestamp of receipt creation
    uint64 expiry;             // Deadline for dispute window
    bytes32 solverId;          // Unique solver identifier
    bytes solverSig;           // Solver's signature over receipt
}
```

#### ConstraintEnvelope

The canonical off-chain encoding that hashes to `constraintsHash`:

```solidity
struct ConstraintEnvelope {
    uint256[] chainIds;        // Allowed execution chains
    address[] tokensIn;        // Input token addresses
    address[] tokensOut;       // Output token addresses
    uint256[] minAmountsOut;   // Minimum output amounts
    uint256 maxSlippageBps;    // Maximum slippage in basis points
    uint64 deadline;           // Execution deadline
    address[] allowedVenues;   // OPTIONAL: Whitelisted venues
    bytes32[] requiredProofs;  // OPTIONAL: Required proof types
}
```

#### OutcomeEnvelope

The canonical off-chain encoding that hashes to `outcomeHash`:

```solidity
struct OutcomeEnvelope {
    uint256 finalChainId;      // Chain where settlement occurred
    address tokenOut;          // Output token address
    uint256 amountOut;         // Actual output amount
    address recipient;         // Recipient address
    bytes32[] txHashes;        // Settlement transaction hashes
    uint64 settledAt;          // Settlement timestamp
}
```

#### Solver

```solidity
struct Solver {
    bytes32 id;                // Unique solver identifier
    address operator;          // Current operator address
    string metadataURI;        // Off-chain metadata (name, description, etc.)
    uint256 bondBalance;       // Available bond balance
    uint256 lockedBalance;     // Bond locked in active disputes
    SolverStatus status;       // Current status
    uint256 totalFilled;       // Lifetime fill count
    uint256 totalDisputes;     // Lifetime dispute count
    uint256 totalSlashed;      // Lifetime slashed amount
}

enum SolverStatus {
    Inactive,   // Registered but not bonded
    Active,     // Bonded and operational
    Jailed,     // Temporarily suspended
    Banned      // Permanently banned
}
```

#### DisputeReason

```solidity
enum DisputeReason {
    Timeout,              // 0: Expiry passed without settlement
    MinOutViolation,      // 1: amountOut < minAmountOut
    WrongToken,           // 2: Incorrect output token
    WrongChain,           // 3: Settled on disallowed chain
    WrongRecipient,       // 4: Sent to wrong address
    ReceiptMismatch,      // 5: Receipt fields don't match evidence
    InvalidSignature,     // 6: Invalid solver signature
    VenueViolation,       // 7: Used disallowed venue
    Custom                // 8: Protocol-specific reason
}
```

### Interfaces

#### ISolverRegistry

```solidity
interface ISolverRegistry {
    /// @notice Emitted when a solver registers
    event SolverRegistered(
        bytes32 indexed solverId,
        address indexed operator,
        string metadataURI
    );

    /// @notice Emitted when bond is deposited
    event BondDeposited(
        bytes32 indexed solverId,
        uint256 amount,
        uint256 newBalance
    );

    /// @notice Emitted when bond is withdrawn
    event BondWithdrawn(
        bytes32 indexed solverId,
        uint256 amount,
        uint256 newBalance
    );

    /// @notice Emitted when solver status changes
    event SolverStatusChanged(
        bytes32 indexed solverId,
        SolverStatus oldStatus,
        SolverStatus newStatus
    );

    /// @notice Emitted when operator key is rotated
    event OperatorRotated(
        bytes32 indexed solverId,
        address oldOperator,
        address newOperator
    );

    /// @notice Register a new solver
    /// @param metadataURI URI pointing to solver metadata JSON
    /// @param operator Address authorized to sign receipts
    /// @return solverId The unique identifier for this solver
    function registerSolver(
        string calldata metadataURI,
        address operator
    ) external returns (bytes32 solverId);

    /// @notice Deposit bond collateral
    /// @param solverId The solver to deposit for
    function depositBond(bytes32 solverId) external payable;

    /// @notice Withdraw available bond collateral
    /// @param solverId The solver to withdraw from
    /// @param amount Amount to withdraw
    function withdrawBond(bytes32 solverId, uint256 amount) external;

    /// @notice Rotate the operator key
    /// @param solverId The solver to update
    /// @param newOperator New operator address
    function setOperator(bytes32 solverId, address newOperator) external;

    /// @notice Get solver details
    /// @param solverId The solver to query
    /// @return solver The solver struct
    function getSolver(bytes32 solverId) external view returns (Solver memory);

    /// @notice Check if solver is active and sufficiently bonded
    /// @param solverId The solver to check
    /// @param minBond Minimum required bond
    /// @return True if solver is active with sufficient bond
    function isActiveSolver(
        bytes32 solverId,
        uint256 minBond
    ) external view returns (bool);
}
```

#### IIntentReceiptHub

```solidity
interface IIntentReceiptHub {
    /// @notice Emitted when a receipt is posted
    event ReceiptPosted(
        bytes32 indexed receiptId,
        bytes32 indexed intentHash,
        bytes32 indexed solverId,
        uint64 expiry
    );

    /// @notice Emitted when a dispute is opened
    event DisputeOpened(
        bytes32 indexed receiptId,
        address indexed challenger,
        DisputeReason reason,
        bytes32 evidenceHash
    );

    /// @notice Emitted when a solver is slashed
    event SolverSlashed(
        bytes32 indexed solverId,
        bytes32 indexed receiptId,
        uint256 amount,
        DisputeReason reason
    );

    /// @notice Emitted when a receipt is finalized
    event ReceiptFinalized(
        bytes32 indexed receiptId,
        bool successful
    );

    /// @notice Post an intent receipt
    /// @param receipt The receipt to post
    /// @return receiptId The unique identifier for this receipt
    function postReceipt(
        IntentReceipt calldata receipt
    ) external returns (bytes32 receiptId);

    /// @notice Open a dispute against a receipt
    /// @param receiptId The receipt to dispute
    /// @param reason The dispute reason code
    /// @param evidenceHash Hash of evidence bundle
    function openDispute(
        bytes32 receiptId,
        DisputeReason reason,
        bytes32 evidenceHash
    ) external;

    /// @notice Resolve a deterministic dispute
    /// @dev Can only resolve disputes with on-chain verifiable outcomes
    /// @param receiptId The receipt under dispute
    function resolveDeterministic(bytes32 receiptId) external;

    /// @notice Finalize a receipt after dispute window
    /// @param receiptId The receipt to finalize
    function finalize(bytes32 receiptId) external;

    /// @notice Get receipt details
    /// @param receiptId The receipt to query
    /// @return receipt The receipt struct
    /// @return status Current receipt status
    function getReceipt(
        bytes32 receiptId
    ) external view returns (IntentReceipt memory receipt, ReceiptStatus status);

    /// @notice Compute receipt ID from receipt data
    /// @param receipt The receipt to hash
    /// @return The receipt ID
    function computeReceiptId(
        IntentReceipt calldata receipt
    ) external pure returns (bytes32);
}

enum ReceiptStatus {
    None,       // Receipt does not exist
    Posted,     // Receipt posted, dispute window open
    Disputed,   // Under active dispute
    Slashed,    // Solver was slashed
    Finalized   // Successfully finalized
}
```

#### IDisputeModule

```solidity
interface IDisputeModule {
    /// @notice Check if a dispute reason is deterministically resolvable
    /// @param reason The dispute reason
    /// @return True if can be resolved without external input
    function isDeterministic(DisputeReason reason) external pure returns (bool);

    /// @notice Verify a deterministic violation
    /// @param receipt The receipt under dispute
    /// @param reason The claimed violation
    /// @param evidence Additional evidence data
    /// @return violated True if violation is proven
    /// @return slashAmount Amount to slash (0 if not violated)
    function verifyViolation(
        IntentReceipt calldata receipt,
        DisputeReason reason,
        bytes calldata evidence
    ) external view returns (bool violated, uint256 slashAmount);
}
```

### Canonical Hash Functions

All hashes MUST use keccak256 with tightly packed ABI encoding:

```solidity
function computeIntentHash(
    // Intent-specific fields per ERC-7683
) external pure returns (bytes32);

function computeConstraintsHash(
    ConstraintEnvelope calldata constraints
) external pure returns (bytes32) {
    return keccak256(abi.encode(constraints));
}

function computeOutcomeHash(
    OutcomeEnvelope calldata outcome
) external pure returns (bytes32) {
    return keccak256(abi.encode(outcome));
}

function computeReceiptId(
    IntentReceipt calldata receipt
) external pure returns (bytes32) {
    return keccak256(abi.encode(
        receipt.intentHash,
        receipt.constraintsHash,
        receipt.solverId,
        receipt.createdAt
    ));
}
```

### Solver Signature

The `solverSig` field MUST be an EIP-712 typed signature over:

```solidity
bytes32 constant RECEIPT_TYPEHASH = keccak256(
    "IntentReceipt(bytes32 intentHash,bytes32 constraintsHash,bytes32 routeHash,bytes32 outcomeHash,bytes32 evidenceHash,uint64 createdAt,uint64 expiry,bytes32 solverId)"
);

bytes32 domainSeparator = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256("IRSB"),
    keccak256("1"),
    block.chainid,
    address(this)
));
```

### Slashing Rules

#### Deterministic Slashing (MUST implement)

| Reason | Condition | Slash % |
|--------|-----------|---------|
| Timeout | `block.timestamp > expiry && !settled` | 100% of relevant bond |
| MinOutViolation | `outcome.amountOut < constraints.minAmountsOut[i]` | Pro-rata to shortfall |
| WrongToken | `outcome.tokenOut != constraints.tokensOut[i]` | 100% |
| WrongRecipient | `outcome.recipient != intent.recipient` | 100% |
| InvalidSignature | `!verifySignature(receipt, solverSig)` | Reject + jail |

#### Slash Distribution

Slashed funds MUST be distributed as:
- 80% to affected user(s)
- 15% to challenger (if external)
- 5% to protocol treasury

### Evidence Bundle Standard

Evidence bundles MUST be JSON objects stored at content-addressable URIs (IPFS, Arweave). Minimum required fields:

```json
{
  "version": "1.0.0",
  "intentPayload": { },
  "constraints": { },
  "route": {
    "venues": ["0x..."],
    "steps": [{ }]
  },
  "outcome": {
    "chainId": 1,
    "tokenOut": "0x...",
    "amountOut": "1000000000000000000",
    "recipient": "0x...",
    "txHashes": ["0x..."]
  },
  "proofs": {
    "settlementTx": { },
    "chainProofs": [{ }]
  },
  "solver": {
    "id": "0x...",
    "signature": "0x...",
    "timestamp": 1234567890
  }
}
```

### IntentScore Computation

Solver reputation MUST be computed as:

```
IntentScore = (SuccessRate * 0.4) + (SpeedScore * 0.2) + (VolumeScore * 0.2) + (DisputeScore * 0.2)

where:
  SuccessRate = finalized / (finalized + slashed)
  SpeedScore = normalize(avgTimeToFinalization)
  VolumeScore = normalize(log(totalVolume))
  DisputeScore = 1 - (disputesLost / totalDisputes)
```

Scores MUST be queryable on-chain via:

```solidity
function getIntentScore(bytes32 solverId) external view returns (uint256 score);
```

## Rationale

### Why Receipts?

Receipts create an auditable trail that transforms intent execution from "trust the solver" to "verify the solver's claim." By requiring solvers to commit to specific outcomes on-chain, we enable:
- Deterministic verification of execution claims
- Clear liability assignment
- Historical execution records for reputation

### Why Bonds?

Economic bonds align solver incentives with correct execution:
- Solvers have "skin in the game"
- Users have recourse beyond reputation damage
- Slashing creates credible threat for violations

### Why Deterministic First?

We prioritize deterministic disputes (timeout, minOut violation) over subjective disputes because:
- On-chain verification requires no external dependencies
- Resolution is immediate and trustless
- Reduces attack surface for dispute gaming

Subjective disputes (DisputeModule) are intentionally modular to allow protocol-specific arbitration mechanisms.

### Why ERC-7683 Integration?

ERC-7683 is the emerging standard for cross-chain intents. By building IRSB as a complementary layer:
- Intent protocols get plug-and-play accountability
- Solvers can operate across multiple protocols with unified reputation
- Users benefit from consistent protection guarantees

## Backwards Compatibility

This EIP introduces new contracts and does not modify existing standards. It is designed to work alongside:

- **ERC-7683**: IRSB receipts reference `intentHash` derived from ERC-7683 order structs
- **ERC-20**: Bonds can be denominated in ETH or any ERC-20 token
- **EIP-712**: Solver signatures use EIP-712 typed data

Existing intent protocols can integrate IRSB by:
1. Registering their solvers in `SolverRegistry`
2. Requiring receipt posting after settlement
3. Routing disputes through `IntentReceiptHub`

## Test Cases

### Test Case 1: Successful Receipt Flow

```solidity
function test_successfulReceipt() public {
    // Register solver
    bytes32 solverId = registry.registerSolver("ipfs://metadata", operator);
    registry.depositBond{value: 1 ether}(solverId);

    // Post receipt
    IntentReceipt memory receipt = IntentReceipt({
        intentHash: keccak256("intent"),
        constraintsHash: keccak256(abi.encode(constraints)),
        routeHash: keccak256("route"),
        outcomeHash: keccak256(abi.encode(outcome)),
        evidenceHash: keccak256("ipfs://evidence"),
        createdAt: uint64(block.timestamp),
        expiry: uint64(block.timestamp + 1 hours),
        solverId: solverId,
        solverSig: sign(receipt, operatorKey)
    });

    bytes32 receiptId = hub.postReceipt(receipt);

    // Wait for dispute window
    vm.warp(block.timestamp + 2 hours);

    // Finalize
    hub.finalize(receiptId);

    // Verify status
    (, ReceiptStatus status) = hub.getReceipt(receiptId);
    assertEq(uint8(status), uint8(ReceiptStatus.Finalized));
}
```

### Test Case 2: Timeout Slashing

```solidity
function test_timeoutSlashing() public {
    // Setup solver with bond
    bytes32 solverId = setupSolverWithBond(1 ether);

    // Post receipt with short expiry
    IntentReceipt memory receipt = createReceipt(solverId, 1 hours);
    bytes32 receiptId = hub.postReceipt(receipt);

    // Wait past expiry without settlement proof
    vm.warp(block.timestamp + 2 hours);

    // Open timeout dispute
    hub.openDispute(receiptId, DisputeReason.Timeout, bytes32(0));

    // Resolve deterministically
    hub.resolveDeterministic(receiptId);

    // Verify slashing
    Solver memory solver = registry.getSolver(solverId);
    assertEq(solver.bondBalance, 0);
    assertEq(solver.totalSlashed, 1 ether);
}
```

### Test Case 3: MinOut Violation

```solidity
function test_minOutViolation() public {
    // Constraints require minOut of 100 tokens
    ConstraintEnvelope memory constraints = ConstraintEnvelope({
        chainIds: new uint256[](1),
        tokensIn: new address[](1),
        tokensOut: new address[](1),
        minAmountsOut: new uint256[](1),
        maxSlippageBps: 100,
        deadline: block.timestamp + 1 hours,
        allowedVenues: new address[](0),
        requiredProofs: new bytes32[](0)
    });
    constraints.minAmountsOut[0] = 100e18;

    // Outcome only delivered 90 tokens
    OutcomeEnvelope memory outcome = OutcomeEnvelope({
        finalChainId: 1,
        tokenOut: tokenAddress,
        amountOut: 90e18,  // Less than minOut!
        recipient: user,
        txHashes: new bytes32[](1),
        settledAt: block.timestamp
    });

    // Post receipt with mismatched outcome
    bytes32 receiptId = postReceiptWithOutcome(constraints, outcome);

    // Dispute for minOut violation
    hub.openDispute(receiptId, DisputeReason.MinOutViolation, evidenceHash);
    hub.resolveDeterministic(receiptId);

    // Verify partial slashing (pro-rata to shortfall)
    // Shortfall = 10/100 = 10%, slash 10% of bond
}
```

## Reference Implementation

A reference implementation is available at:

```
https://github.com/[TBD]/irsb-reference
```

Key files:
- `src/SolverRegistry.sol` - Solver registration and bond management
- `src/IntentReceiptHub.sol` - Receipt posting and dispute resolution
- `src/DisputeModule.sol` - Deterministic violation verification
- `src/libraries/HashLib.sol` - Canonical hash functions

## Security Considerations

### Front-Running

Receipt posting MAY be front-run by MEV searchers. Mitigations:
- Use private mempools (Flashbots Protect)
- Commit-reveal schemes for sensitive receipts
- Solver-signed nonces to prevent replay

### Bond Manipulation

Solvers MAY attempt to withdraw bonds before disputes resolve. Mitigations:
- Lock bonds for active receipts until finalization
- Require cooldown period for withdrawals
- Track "locked balance" separately from "available balance"

### Evidence Availability

Evidence bundles stored off-chain MAY become unavailable. Mitigations:
- Require redundant storage (IPFS + Arweave)
- Cache critical evidence on-chain for high-value intents
- Allow evidence submission during dispute window

### Griefing Attacks

Malicious actors MAY open frivolous disputes to lock solver bonds. Mitigations:
- Require dispute bonds from challengers
- Slash frivolous dispute bonds
- Rate-limit disputes per address

### Oracle Manipulation

Price-dependent slashing MAY be manipulated via oracle attacks. Mitigations:
- Use time-weighted average prices (TWAP)
- Require multiple oracle sources
- Cap slashing at deposited bond amount

### Signature Replay

Solver signatures MAY be replayed across chains or contracts. Mitigations:
- Include `chainId` in EIP-712 domain
- Include `verifyingContract` in domain
- Include unique `createdAt` timestamp in receipt

## Copyright

Copyright and related rights waived via [CC0](../LICENSE.md).
