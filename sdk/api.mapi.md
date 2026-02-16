# IRSB Protocol SDK

The accountability layer for intent-based transactions. This SDK provides TypeScript bindings for the IRSB protocol contracts: solver registration, bond management, receipt posting (V1 single-sig and V2 dual attestation), dispute resolution, escrow, and reputation queries.

~~~meta
version: 1.0.0
auth: none
errors: standard
~~~

## Global Types

```typescript
// --- Identifiers ---

/** Ethereum address (0x-prefixed, 40 hex chars) */
type Address = string;

/** Keccak-256 hash (0x-prefixed, 64 hex chars) */
type Bytes32 = string;

/** EIP-712 or ECDSA signature (0x-prefixed) */
type Signature = string;

/** ethers.js TransactionResponse — returned by all write operations */
type TransactionResponse = import("ethers").TransactionResponse;

// --- Enums ---

enum SolverStatus {
  Inactive = 0,   // Registered but below minimum bond
  Active = 1,     // Bond >= 0.1 ETH, can post receipts
  Jailed = 2,     // Slashed, must pay penalty to unjail
  Banned = 3,     // 3+ jails, permanently banned
}

enum ReceiptStatus {
  None = 0,        // No receipt exists for this intent
  Posted = 1,      // Receipt posted, within challenge window
  Challenged = 2,  // Receipt has an active challenge
  Finalized = 3,   // Challenge window passed, no dispute
  Slashed = 4,     // Solver slashed for this receipt
}

enum DisputeReason {
  None = 0x00,
  Timeout = 0x01,           // Solver missed deadline
  MinOutViolation = 0x02,   // Output below minimum
  WrongToken = 0x03,        // Wrong token delivered
  WrongChain = 0x04,        // Wrong destination chain
  WrongRecipient = 0x05,    // Sent to wrong address
  ReceiptForgery = 0x06,    // Fabricated receipt
  InvalidSignature = 0x07,  // Bad signature
}

enum DisputeStatus {
  None = 0,
  Open = 1,
  EvidenceSubmitted = 2,
  Escalated = 3,
  Resolved = 4,
}

enum DisputeResolution {
  None = 0,
  SolverWins = 1,
  ChallengerWins = 2,
  Split = 3,
  Timeout = 4,
}

enum PrivacyLevel {
  Public = 0,      // Full receipt visible on-chain
  SemiPublic = 1,  // Commitment visible, payload gated
  Private = 2,     // Commitment only, encrypted off-chain
}

enum ReceiptV2Status {
  None = 0,
  Pending = 1,
  Disputed = 2,
  Finalized = 3,
  Slashed = 4,
}

enum OptimisticDisputeStatus {
  None = 0,
  Open = 1,
  Contested = 2,
  ChallengerWins = 3,
  SolverWins = 4,
}

enum EscrowStatus {
  Active = 0,
  Released = 1,
  Refunded = 2,
}

enum DelegationStatus {
  None = 0,
  Active = 1,
  Revoked = 2,
}

// --- Structs ---

interface SolverInfo {
  bondAmount: bigint;            // Total bond deposited (wei)
  lockedAmount: bigint;          // Bond locked in active disputes
  reputation: bigint;            // IntentScore (0-10000 basis points)
  registrationTime: bigint;      // Unix timestamp
  lastActiveTime: bigint;        // Last receipt posted
  totalIntents: bigint;          // Lifetime intent count
  successfulIntents: bigint;     // Finalized without dispute
  jailCount: number;             // 0-3, banned at 3
  status: SolverStatus;
  pendingWithdrawal: bigint;     // Amount requested for withdrawal
  withdrawalRequestTime: bigint; // When withdrawal was requested
}

interface IntentReceipt {
  solver: Address;
  intentHash: Bytes32;
  constraintsHash: Bytes32;
  outcomeHash: Bytes32;
  evidenceHash: Bytes32;
  postedAt: bigint;       // Unix timestamp
  deadline: bigint;       // Expiry timestamp
  solverSig: Signature;   // Single solver attestation
  status: ReceiptStatus;
}

interface IntentReceiptV2 {
  intentHash: Bytes32;
  constraintsHash: Bytes32;
  routeHash: Bytes32;
  outcomeHash: Bytes32;
  evidenceHash: Bytes32;
  createdAt: bigint;
  expiry: bigint;
  solverId: Bytes32;
  client: Address;
  metadataCommitment: Bytes32;   // Hash of off-chain metadata
  ciphertextPointer: string;     // IPFS CID or bytes32 digest
  privacyLevel: PrivacyLevel;
  escrowId: Bytes32;             // 0x0 if no escrow
  solverSig: Signature;          // EIP-712 from solver
  clientSig: Signature;          // EIP-712 from client
}

interface Challenge {
  challenger: Address;
  reason: DisputeReason;
  bond: bigint;          // Challenger bond amount (wei)
  timestamp: bigint;     // When challenge was filed
}

interface OptimisticDispute {
  receiptId: Bytes32;
  solverId: Bytes32;
  challenger: Address;
  challengerBond: bigint;
  counterBond: bigint;
  evidenceHash: Bytes32;
  openedAt: bigint;
  counterBondDeadline: bigint;
  arbitrationDeadline: bigint;
  status: OptimisticDisputeStatus;
}

interface Escrow {
  receiptId: Bytes32;
  depositor: Address;
  token: Address;        // 0x0 = native ETH
  amount: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: EscrowStatus;
}

interface Caveat {
  enforcer: Address;     // ICaveatEnforcer contract
  terms: string;         // ABI-encoded enforcer params
}

interface Delegation {
  delegator: Address;
  delegate: Address;     // WalletDelegate contract
  authority: Bytes32;    // Parent delegation hash (0x0 for root)
  caveats: Caveat[];
  salt: bigint;
  signature: Signature;  // EIP-712 from delegator
}

interface RiskScore {
  executor: string;
  score: number;         // 0-100
  bondLevel: string;     // "low" | "medium" | "high"
  recentDisputes: number;
  successRate: number;   // 0.0-1.0
}

// --- Input Types ---

interface PostReceiptParams {
  intentHash: Bytes32;
  constraintsHash: Bytes32;
  outcomeHash: Bytes32;
  evidenceHash: Bytes32;
  deadline: bigint;
  solverSig: Signature;
}

interface IRSBClientConfig {
  /** Chain name ('sepolia') or custom ChainConfig object */
  chain: string | ChainConfig;
  /** Ethers signer for write operations */
  signer?: import("ethers").Signer;
  /** Ethers provider for read operations (optional if signer provided) */
  provider?: import("ethers").Provider;
}

interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  nativeToken: string;
  solverRegistry: Address;
  intentReceiptHub: Address;
  disputeModule: Address;
}

interface VerifyResult {
  valid: boolean;
  receipt: IntentReceipt | null;
  solver: SolverInfo | null;
  issues: string[];
}
```

---

## Capability: Initialize Client

~~~meta
id: client.init
transport: INTERNAL
~~~

### Intention

Create an IRSBClient instance to interact with IRSB protocol contracts. This is the entry point for all SDK operations. Use `chain: 'sepolia'` for the testnet deployment. Provide a `signer` for write operations (posting receipts, registering, staking). Read-only operations work with just a `provider`.

### Input

```typescript
interface InitClientInput {
  config: IRSBClientConfig;
}
```

### Output

```typescript
// Returns an IRSBClient instance
type InitClientOutput = IRSBClient;
```

### Example

```typescript
import { IRSBClient } from '@irsb/sdk';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const client = new IRSBClient({ chain: 'sepolia', signer });
```

---

## Capability: Register Solver

~~~meta
id: solver.register
transport: INTERNAL
idempotent: false
~~~

### Intention

Register the signer as a new solver on the IRSB protocol. Requires sending at least 0.1 ETH as an initial bond. The signer's address becomes the solver identity. After registration, the solver status becomes `Active` and the solver can post receipts.

Use this once during onboarding. If the solver was previously jailed, use `solver.unjail` instead.

### Input

```typescript
interface RegisterInput {
  /** ETH to deposit as initial bond (must be >= 0.1 ETH) */
  value: bigint;
}
```

### Output

```typescript
type RegisterOutput = TransactionResponse;
```

### Logic Constraints

- `value` must be >= 0.1 ETH (100000000000000000 wei)
- Caller must not already be registered
- Reverts with `SolverAlreadyRegistered()` if already registered

---

## Capability: Deposit Bond

~~~meta
id: solver.deposit-bond
transport: INTERNAL
idempotent: true
~~~

### Intention

Add more ETH to your existing solver bond. Use this to increase your bond above the minimum, which improves your risk score for wallet integrations (0.5 ETH = medium, 1.0 ETH = high). Does NOT register a new solver — use `solver.register` for initial registration.

### Input

```typescript
interface DepositBondInput {
  /** Additional ETH to deposit */
  value: bigint;
}
```

### Output

```typescript
type DepositBondOutput = TransactionResponse;
```

---

## Capability: Request Withdrawal

~~~meta
id: solver.request-withdrawal
transport: INTERNAL
idempotent: false
~~~

### Intention

Begin withdrawing bond from the solver registry. This starts a 7-day cooldown period. After the cooldown, call `solver.execute-withdrawal` to complete. To cancel, use `solver.cancel-withdrawal`.

Use this when winding down solver operations. The solver remains active during the cooldown but the requested amount is locked.

### Input

```typescript
interface RequestWithdrawalInput {
  /** Amount to withdraw (wei). Must be <= available (unlocked) bond. */
  amount: bigint;
}
```

### Output

```typescript
type RequestWithdrawalOutput = TransactionResponse;
```

### Logic Constraints

- Amount must not exceed available (unlocked) bond
- Remaining bond must stay >= 0.1 ETH or solver becomes Inactive
- Cooldown is 7 days (604800 seconds)

---

## Capability: Execute Withdrawal

~~~meta
id: solver.execute-withdrawal
transport: INTERNAL
idempotent: false
~~~

### Intention

Complete a pending withdrawal after the 7-day cooldown. Must have called `solver.request-withdrawal` first and waited for the cooldown to pass. The ETH is returned to the solver's address.

### Output

```typescript
type ExecuteWithdrawalOutput = TransactionResponse;
```

### Logic Constraints

- Reverts if no pending withdrawal exists
- Reverts if cooldown has not passed (7 days)

---

## Capability: Cancel Withdrawal

~~~meta
id: solver.cancel-withdrawal
transport: INTERNAL
idempotent: true
~~~

### Intention

Cancel a pending bond withdrawal request. The bond becomes fully available again. Use this if you decide to continue solving.

### Output

```typescript
type CancelWithdrawalOutput = TransactionResponse;
```

---

## Capability: Unjail Solver

~~~meta
id: solver.unjail
transport: INTERNAL
idempotent: false
~~~

### Intention

Pay a penalty to return a jailed solver to Active status. Solvers get jailed when they lose a dispute (bond is slashed). After 3 jails, the solver is permanently banned and cannot unjail.

### Input

```typescript
interface UnjailInput {
  /** Penalty amount to pay (wei) */
  value: bigint;
}
```

### Output

```typescript
type UnjailOutput = TransactionResponse;
```

### Logic Constraints

- Solver status must be `Jailed` (not `Banned`)
- Solver with `jailCount >= 3` cannot unjail (permanently banned)

---

## Capability: Get Solver Info

~~~meta
id: solver.get
transport: INTERNAL
~~~

### Intention

Look up a solver's on-chain profile: bond amount, reputation, jail history, and status. Use this to evaluate solver trustworthiness before routing intents. For a simplified risk assessment, prefer `solver.risk-score`.

### Input

```typescript
interface GetSolverInput {
  /** Solver's Ethereum address */
  address: Address;
}
```

### Output

```typescript
type GetSolverOutput = SolverInfo;
```

---

## Capability: Check Solver Active

~~~meta
id: solver.is-active
transport: INTERNAL
~~~

### Intention

Quick boolean check whether an address is an active solver. Use this for fast go/no-go decisions before sending an intent. For full details, use `solver.get`.

### Input

```typescript
interface IsActiveSolverInput {
  address: Address;
}
```

### Output

```typescript
type IsActiveSolverOutput = boolean;
```

---

## Capability: Get Solver Bond

~~~meta
id: solver.get-bond
transport: INTERNAL
~~~

### Intention

Get a solver's total bond amount in wei. For the unlocked (available) portion only, use `solver.get-available-bond`.

### Input

```typescript
interface GetSolverBondInput {
  address: Address;
}
```

### Output

```typescript
/** Bond amount in wei */
type GetSolverBondOutput = bigint;
```

---

## Capability: Get Available Bond

~~~meta
id: solver.get-available-bond
transport: INTERNAL
~~~

### Intention

Get the solver's unlocked bond — the amount not currently tied up in active disputes. This is the maximum amount available for withdrawal.

### Input

```typescript
interface GetAvailableBondInput {
  address: Address;
}
```

### Output

```typescript
/** Available (unlocked) bond in wei */
type GetAvailableBondOutput = bigint;
```

---

## Capability: Get Minimum Bond

~~~meta
id: solver.get-minimum-bond
transport: INTERNAL
~~~

### Intention

Get the protocol-level minimum bond required for solver registration. Currently 0.1 ETH. Use this to validate a bond amount before calling `solver.register`.

### Output

```typescript
/** Minimum bond in wei */
type GetMinimumBondOutput = bigint;
```

---

## Capability: Post Receipt (V1)

~~~meta
id: receipt.post
transport: INTERNAL
idempotent: false
~~~

### Intention

Submit a V1 single-attestation receipt after executing an intent. This is the core accountability action — it creates an on-chain record that the solver claims to have fulfilled the intent. After posting, a 1-hour challenge window opens during which anyone can dispute the receipt.

Use `receipt.post` for simple, single-solver intents. For intents requiring buyer co-signature (x402 payments, delegated execution), use the V2 receipt helpers in `@irsb/x402` instead.

**Prerequisites:** Solver must be Active (registered with bond >= 0.1 ETH). Generate `solverSig` using `receipt.sign` first.

### Input

```typescript
type PostReceiptInput = PostReceiptParams;
```

### Output

```typescript
type PostReceiptOutput = TransactionResponse;
```

### Logic Constraints

- Solver must be Active (reverts with `SolverNotActive()`)
- `intentHash` must not already have a receipt
- `deadline` must be in the future
- `solverSig` must be a valid signature from the solver over the receipt fields

---

## Capability: Sign Receipt

~~~meta
id: receipt.sign
transport: INTERNAL
~~~

### Intention

Generate a solver signature for a V1 receipt. Call this before `receipt.post` — it signs the packed hash of (intentHash, constraintsHash, outcomeHash, evidenceHash, deadline) using the client's signer. Returns the hex-encoded signature.

### Input

```typescript
interface SignReceiptInput {
  intentHash: Bytes32;
  constraintsHash: Bytes32;
  outcomeHash: Bytes32;
  evidenceHash: Bytes32;
  deadline: bigint;
}
```

### Output

```typescript
/** Hex-encoded ECDSA signature */
type SignReceiptOutput = Signature;
```

---

## Capability: Get Receipt

~~~meta
id: receipt.get
transport: INTERNAL
~~~

### Intention

Retrieve a posted receipt by its intent hash. Returns `null` if no receipt exists for this intent. Use this to check execution status, verify claims, or before filing a challenge.

### Input

```typescript
interface GetReceiptInput {
  intentHash: Bytes32;
}
```

### Output

```typescript
type GetReceiptOutput = IntentReceipt | null;
```

---

## Capability: Finalize Receipt

~~~meta
id: receipt.finalize
transport: INTERNAL
idempotent: true
~~~

### Intention

Finalize a receipt after the 1-hour challenge window passes without dispute. This transitions the receipt status to `Finalized` and updates the solver's reputation (increments successfulIntents). Anyone can call this — it does not require the solver's signer.

Do NOT call this during the challenge window — it will revert. Check `receipt.get` to see if `postedAt + challengeWindow` has passed.

### Output

```typescript
type FinalizeReceiptOutput = TransactionResponse;
```

### Input

```typescript
interface FinalizeReceiptInput {
  intentHash: Bytes32;
}
```

### Logic Constraints

- Receipt must be in `Posted` status
- Challenge window (1 hour) must have elapsed
- Reverts with `ChallengeWindowActive()` if called too early

---

## Capability: Challenge Receipt

~~~meta
id: receipt.challenge
transport: INTERNAL
idempotent: false
~~~

### Intention

Dispute a receipt within the 1-hour challenge window. Use this when you believe a solver submitted a fraudulent or incorrect receipt. Requires posting a challenger bond (10% of solver's bond). If the challenge succeeds, you receive 15% of the slashed amount plus your bond back.

Choose the appropriate `DisputeReason` — deterministic reasons (Timeout, WrongToken, WrongChain) can be auto-resolved; others may require evidence submission.

### Input

```typescript
interface ChallengeReceiptInput {
  intentHash: Bytes32;
  reason: DisputeReason;
  /** Challenger bond (must be >= 10% of solver's bond) */
  value: bigint;
}
```

### Output

```typescript
type ChallengeReceiptOutput = TransactionResponse;
```

### Logic Constraints

- Must be called within the challenge window (1 hour from posting)
- Challenger bond must be >= 10% of solver's bond (`CHALLENGER_BOND_BPS = 1000`)
- Receipt must be in `Posted` status
- Caller cannot challenge their own receipt

---

## Capability: Submit Evidence

~~~meta
id: dispute.submit-evidence
transport: INTERNAL
idempotent: false
~~~

### Intention

Submit evidence supporting your position in an active dispute. Both the solver (defending) and challenger (attacking) can submit evidence. Evidence is stored as a hash — the actual data (transaction logs, screenshots, state proofs) should be stored off-chain and referenced by this hash.

Must be called within the evidence window (24 hours for V1 disputes). For V2 optimistic disputes, the counter-bond mechanism replaces evidence submission.

### Input

```typescript
interface SubmitEvidenceInput {
  intentHash: Bytes32;
  /** Hash of evidence data (stored off-chain) */
  evidenceHash: Bytes32;
}
```

### Output

```typescript
type SubmitEvidenceOutput = TransactionResponse;
```

### Logic Constraints

- Dispute must be in `Open` or `EvidenceSubmitted` status
- Must be within the 24-hour evidence window
- Only the solver or challenger can submit evidence

---

## Capability: Escalate to Arbitration

~~~meta
id: dispute.escalate
transport: INTERNAL
idempotent: false
~~~

### Intention

Escalate a dispute to arbitration when the deterministic evidence is inconclusive. This triggers a 7-day arbitration window where the designated arbitrator reviews both sides and renders a binding decision. Use this only after both sides have submitted evidence and no automatic resolution is possible.

### Input

```typescript
interface EscalateInput {
  intentHash: Bytes32;
}
```

### Output

```typescript
type EscalateOutput = TransactionResponse;
```

### Logic Constraints

- Dispute must be in `EvidenceSubmitted` status
- Evidence deadline must have passed
- Only the challenger can escalate

---

## Capability: Get Dispute

~~~meta
id: dispute.get
transport: INTERNAL
~~~

### Intention

Retrieve full dispute details for an intent hash. Returns `null` if no dispute exists. Use this to check dispute status, evidence submissions, and resolution outcomes.

### Input

```typescript
interface GetDisputeInput {
  intentHash: Bytes32;
}
```

### Output

```typescript
// Returns dispute record or null
type GetDisputeOutput = Record<string, unknown> | null;
```

---

## Capability: Verify Receipt

~~~meta
id: receipt.verify
transport: INTERNAL
~~~

### Intention

Perform comprehensive off-chain verification of a receipt: checks signature validity, solver status, receipt existence, and challenge state. Returns a structured result with all issues found. Use this before trusting a receipt claim.

### Input

```typescript
interface VerifyReceiptInput {
  intentHash: Bytes32;
  options?: {
    /** Check solver bond meets minimum? Default: true */
    checkBond?: boolean;
    /** Check solver is not jailed? Default: true */
    checkStatus?: boolean;
  };
}
```

### Output

```typescript
type VerifyReceiptOutput = VerifyResult;
```

---

## Capability: Get Risk Score

~~~meta
id: solver.risk-score
transport: INTERNAL
~~~

### Intention

Get a wallet-grade risk assessment for a solver. Combines bond level, dispute history, and success rate into a 0-100 score. Use this in wallet UIs to show users whether a solver is trustworthy before approving an intent.

This queries The Graph subgraph — it requires an active subgraph deployment.

### Input

```typescript
interface GetRiskScoreInput {
  /** Solver address or solver ID */
  executor: string;
}
```

### Output

```typescript
type GetRiskScoreOutput = RiskScore;
```

---

## Capability: Check Solver Safety

~~~meta
id: solver.is-safe
transport: INTERNAL
~~~

### Intention

Quick boolean safety check combining bond level, dispute history, and reputation. Returns `true` if the solver passes all safety thresholds. Use this for automated agent decisions — if `false`, do not route intents to this solver.

For the detailed breakdown, use `solver.risk-score` instead.

### Input

```typescript
interface IsSolverSafeInput {
  /** Solver address or solver ID */
  executor: string;
}
```

### Output

```typescript
type IsSolverSafeOutput = boolean;
```

---

## Capability: Get Recent Receipts

~~~meta
id: solver.recent-receipts
transport: INTERNAL
~~~

### Intention

Fetch a solver's most recent receipts via The Graph subgraph. Use this to inspect a solver's execution history, verify past performance, or build a track record display.

### Input

```typescript
interface GetRecentReceiptsInput {
  /** Solver address or solver ID */
  executor: string;
  /** Max receipts to return. Default: 10 */
  limit?: number;
}
```

### Output

```typescript
interface RecentReceiptsResponse {
  receipts: Array<{
    intentHash: string;
    status: string;
    postedAt: string;
    challenged: boolean;
  }>;
  total: number;
}
```

---

## Capability: Get Active Bond Status

~~~meta
id: solver.active-bond
transport: INTERNAL
~~~

### Intention

Get a solver's bond status via The Graph subgraph: amount, level classification, and whether it meets protocol thresholds. Use this in wallet UIs to display bond information.

### Input

```typescript
interface GetActiveBondInput {
  /** Solver address or solver ID */
  executor: string;
}
```

### Output

```typescript
interface BondStatus {
  amount: string;       // Bond in ETH
  level: string;        // "low" | "medium" | "high"
  meetsMinimum: boolean;
}
```

---

## Capability: Get Challenge Window

~~~meta
id: receipt.get-challenge-window
transport: INTERNAL
~~~

### Intention

Get the protocol's challenge window duration in seconds (currently 3600 = 1 hour). Use this to calculate when a receipt becomes finalizable: `postedAt + challengeWindow`.

### Output

```typescript
/** Challenge window duration in seconds */
type GetChallengeWindowOutput = bigint;
```

---

## Capability: Calculate Challenger Bond

~~~meta
id: receipt.calculate-challenger-bond
transport: INTERNAL
~~~

### Intention

Calculate the minimum challenger bond required for a given slash amount. The challenger bond is 10% (1000 basis points) of the solver's bond. Use this before calling `receipt.challenge` to know how much ETH to send.

### Input

```typescript
interface CalculateChallengerBondInput {
  /** The solver's bond amount to calculate against */
  slashAmount: bigint;
}
```

### Output

```typescript
/** Required challenger bond in wei */
type CalculateChallengerBondOutput = bigint;
```

---

## Capability: Get Contract Addresses

~~~meta
id: client.get-addresses
transport: INTERNAL
~~~

### Intention

Get the deployed contract addresses for the current chain configuration. Useful for building direct contract interactions or for debugging.

### Output

```typescript
interface ContractAddresses {
  solverRegistry: Address;
  intentReceiptHub: Address;
  disputeModule: Address;
}
```
