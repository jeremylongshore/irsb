# x402-IRSB Integration Pack

Bridge between the x402 HTTP Payment Protocol and the IRSB accountability layer. Transforms x402 payment artifacts into IRSB ReceiptV2 structures with EIP-712 dual attestation, escrow integration, and EIP-7702 delegated payments via on-chain caveat enforcers.

~~~meta
version: 1.0.0
auth: none
errors: standard
~~~

## Global Types

```typescript
// --- Identifiers ---
type Address = `0x${string}`;
type Bytes32 = `0x${string}`;
type Signature = `0x${string}`;

// --- Enums ---

enum PrivacyLevel {
  Public = 0,      // Full receipt visible on-chain
  SemiPublic = 1,  // Commitment on-chain, payload gated
  Private = 2,     // Commitment only, payload encrypted
}

enum X402Mode {
  /** Payment settles immediately via x402; receipt is for reputation and disputes */
  Micropayment = "micropayment",
  /** Payment escrowed; released on receipt finalization */
  Commerce = "commerce",
}

enum EscrowStatus {
  Active = 0,
  Released = 1,
  Refunded = 2,
}

// --- x402 Payload Types ---

interface X402Service {
  serviceId: string;     // e.g. "acme-api-v1"
  endpoint: string;      // e.g. "POST /api/generate"
  domain: string;        // e.g. "api.example.com"
}

interface X402Payment {
  paymentRef: string;    // Transaction hash or facilitator reference
  asset: string;         // Token symbol or address ("ETH", "USDC", "0x...")
  amount: string;        // Amount as string for precision (wei for ETH)
  chainId: number;
}

interface X402Request {
  requestId: string;           // UUID
  requestFingerprint: string;  // Hash of canonical request
}

interface X402Response {
  resultPointer: string;   // CID or URL to response artifact
  resultDigest: string;    // Hash of response content
}

interface X402Timing {
  issuedAt: number;    // Unix timestamp
  expiry: number;      // Unix timestamp
  nonce: string;       // Unique per-receipt
}

interface X402ReceiptPayload {
  version: string;          // Schema version ("1.0.0")
  service: X402Service;
  payment: X402Payment;
  request: X402Request;
  response: X402Response;
  timing: X402Timing;
}

// --- Receipt V2 Types ---

interface IntentReceiptV2 {
  intentHash: Bytes32;
  constraintsHash: Bytes32;
  routeHash: Bytes32;
  outcomeHash: Bytes32;
  evidenceHash: Bytes32;
  metadataCommitment: Bytes32;
  ciphertextPointer: string;     // IPFS CID or bytes32 digest
  privacyLevel: PrivacyLevel;
  escrowId: Bytes32;             // 0x0 if no escrow
  createdAt: bigint;
  expiry: bigint;
  solverId: Bytes32;
  solverSig: Signature;
  clientSig: Signature;
}

interface EIP712TypedData {
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

// --- Delegation Types ---

interface EnforcerAddresses {
  spendLimit: Address;
  timeWindow: Address;
  allowedTargets: Address;
  allowedMethods: Address;
  nonce: Address;
}

interface CaveatConfig {
  enforcerAddresses: EnforcerAddresses;
  spendLimit?: { token: Address; dailyCap: bigint; perTxCap: bigint };
  timeWindow?: { notBefore: bigint; notAfter: bigint };
  allowedTargets?: { targets: Address[] };
  allowedMethods?: { selectors: Address[] };
  nonce?: { startNonce: bigint };
}

interface BuyerSetupConfig {
  delegator: Address;
  walletDelegateAddress: Address;
  chainId: number;
  caveats: CaveatConfig;
  salt?: bigint;
  nonce?: bigint;
}

interface DelegationResult {
  delegation: {
    delegator: Address;
    delegate: Address;
    authority: Bytes32;
    caveats: Array<{ enforcer: Address; terms: Bytes32 }>;
    salt: bigint;
  };
  typedData: EIP712TypedData;
  delegationHash: Bytes32;
}

interface PaymentResult {
  delegationHash: Bytes32;
  settlementParams: {
    paymentHash: Bytes32;
    token: Address;
    amount: bigint;
    seller: Address;
    buyer: Address;
    receiptId: Bytes32;
    intentHash: Bytes32;
    proof: Bytes32;
    expiry: bigint;
  };
  functionName: string;  // "settleDelegated"
  args: unknown[];
}

interface DelegationStatusInfo {
  isValid: boolean;
  timeValid: boolean;
  issues: string[];
  caveats: {
    hasSpendLimit: boolean;
    hasTimeWindow: boolean;
    hasTargetAllowlist: boolean;
    hasMethodAllowlist: boolean;
    hasNonce: boolean;
  };
}

interface EscrowInfo {
  receiptId: Bytes32;
  depositor: Address;
  token: Address;
  amount: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: EscrowStatus;
}

interface NetworkConfig {
  chainId: number;
  hubAddress: Address;
  escrowAddress: Address;
  registryAddress: Address;
  explorerUrl: string;
}

interface PostReceiptResult {
  txHash: string;
  receiptId: Bytes32;
}
```

---

## Capability: Build Receipt V2 from x402

~~~meta
id: receipt.build-v2
transport: INTERNAL
~~~

### Intention

Transform an x402 payment payload into an unsigned IRSB ReceiptV2 structure. This is the first step in the receipt posting flow. Call this after completing an x402 payment to create the receipt for on-chain posting.

Returns the receipt struct plus EIP-712 signing payloads for both solver and client. After building, use `receipt.sign-dual` to collect signatures, then `receipt.post` to submit on-chain.

**Workflow:** `receipt.build-v2` -> `receipt.sign-dual` -> `receipt.post`

For the common case of building and posting in a single operation, use `receipt.post-from-x402` instead.

### Input

```typescript
interface BuildReceiptV2Input {
  /** The complete x402 receipt payload */
  payload: X402ReceiptPayload;
  /** CID or digest for off-chain ciphertext storage */
  ciphertextPointer: string;
  /** Privacy level (default: SemiPublic) */
  privacyLevel?: PrivacyLevel;
  /** Optional escrow ID for commerce mode */
  escrowId?: Bytes32;
  /** Registered IRSB solver ID */
  solverId: Bytes32;
}
```

### Output

```typescript
interface BuildReceiptV2Output {
  receiptV2: IntentReceiptV2;
  signingPayloads: {
    solver: EIP712TypedData;
    client: EIP712TypedData;
  };
  debug: {
    metadataCommitment: Bytes32;
    intentHash: Bytes32;
    constraintsHash: Bytes32;
    routeHash: Bytes32;
  };
}
```

### Logic Constraints

- `ciphertextPointer` must be a valid IPFS CID or 64-char hex string
- `solverId` must be a registered solver ID in the SolverRegistry
- `payload.timing.expiry` must be in the future

---

## Capability: Sign Receipt Dual

~~~meta
id: receipt.sign-dual
transport: INTERNAL
~~~

### Intention

Collect both solver and client EIP-712 signatures for a V2 receipt. V2 receipts require dual attestation — both the solver (who executed) and the client (who requested) must sign. This prevents receipt forgery.

Call this after `receipt.build-v2` with the signing payloads it returned. The solver signs first (as the service provider), then the client (as the payer/requester).

### Input

```typescript
interface SignDualInput {
  /** EIP-712 typed data for solver */
  solverPayload: EIP712TypedData;
  /** EIP-712 typed data for client */
  clientPayload: EIP712TypedData;
  /** Solver's private key or ethers Signer */
  solverSigner: string;
  /** Client's private key or ethers Signer (optional for micropayment mode) */
  clientSigner?: string;
}
```

### Output

```typescript
interface SignDualOutput {
  solverSig: Signature;
  clientSig: Signature;
}
```

---

## Capability: Post Receipt V2

~~~meta
id: receipt.post
transport: INTERNAL
idempotent: false
~~~

### Intention

Submit a signed V2 receipt to the IntentReceiptHub contract. This is the final step of the receipt flow — the receipt is now on-chain and the challenge/finalization process begins.

Use this when you have already built and signed the receipt via `receipt.build-v2` and `receipt.sign-dual`. For the one-shot convenience method, use `receipt.post-from-x402` instead.

### Input

```typescript
interface PostReceiptV2Input {
  /** Fully signed ReceiptV2 */
  receipt: IntentReceiptV2;
  /** RPC URL for the target chain */
  rpcUrl: string;
  /** IntentReceiptHub contract address */
  hubAddress: Address;
  /** Solver's private key (for the posting transaction) */
  solverSigner: string;
  /** Gas limit override */
  gasLimit?: bigint;
}
```

### Output

```typescript
type PostReceiptV2Output = PostReceiptResult;
```

### Logic Constraints

- Solver must be Active in the SolverRegistry
- Receipt `intentHash` must not already exist on-chain
- Both `solverSig` and `clientSig` must be valid EIP-712 signatures

---

## Capability: Post Receipt from x402

~~~meta
id: receipt.post-from-x402
transport: INTERNAL
idempotent: false
~~~

### Intention

One-shot convenience: build, sign, and post a V2 receipt from raw x402 payment data. Use this when you want the simplest integration path — provide the x402 payload and signing keys, and this handles the full flow internally.

For fine-grained control over each step, use the separate `receipt.build-v2` -> `receipt.sign-dual` -> `receipt.post` workflow.

### Input

```typescript
interface PostFromX402Input {
  /** The x402 receipt payload */
  payload: X402ReceiptPayload;
  /** CID or digest for off-chain storage */
  ciphertextPointer: string;
  /** Registered IRSB solver ID */
  solverId: Bytes32;
  /** RPC URL */
  rpcUrl: string;
  /** Hub contract address */
  hubAddress: Address;
  /** Solver's private key */
  solverSigner: string;
  /** Client's private key (optional) */
  clientSigner?: string;
  /** Privacy level (default: SemiPublic) */
  privacyLevel?: PrivacyLevel;
}
```

### Output

```typescript
type PostFromX402Output = PostReceiptResult;
```

---

## Capability: Setup Buyer Delegation

~~~meta
id: delegation.setup
transport: INTERNAL
~~~

### Intention

Set up an EIP-7702 delegation allowing an agent or dapp to auto-pay for x402 API calls on a user's behalf. This is the core buyer-side integration: the user's wallet delegates execution rights to the WalletDelegate contract, constrained by on-chain caveat enforcers (spend limits, time windows, allowed targets).

Returns signing payloads that the user's wallet must sign. The user signs once; subsequent payments happen automatically within the enforcer constraints.

**Flow:** `delegation.setup` -> user signs authorization + delegation -> `payment.delegated` for each payment

This replaces off-chain approval flows with transparent, on-chain policy enforcement.

### Input

```typescript
type DelegationSetupInput = BuyerSetupConfig;
```

### Output

```typescript
interface DelegationSetupOutput {
  /** EIP-7702 authorization for wallet to sign */
  authorization: { chainId: number; address: Address; nonce: bigint };
  /** Delegation struct for EIP-712 signing */
  delegation: DelegationResult["delegation"];
  /** EIP-712 typed data for wallet to sign */
  typedData: EIP712TypedData;
  /** Hash identifying this delegation */
  delegationHash: Bytes32;
  /** ERC-7715 permission request for wallet UX */
  permissionRequest: {
    chainId: number;
    address: Address;
    permissions: Array<{ type: string; data: Record<string, unknown> }>;
    expiry: number;
  };
  /** Human-readable summary */
  summary: string;
}
```

### Logic Constraints

- At least one caveat must be configured (spend limit, time window, allowed targets, or allowed methods)
- `walletDelegateAddress` must point to a deployed WalletDelegate contract
- `enforcerAddresses` must all be deployed enforcer contracts on the same chain
- Time window `notAfter` must be in the future

---

## Capability: Get Delegation Status

~~~meta
id: delegation.status
transport: INTERNAL
~~~

### Intention

Check whether an existing delegation is still valid. Evaluates time constraints, identifies expired or not-yet-active delegations, and lists which caveats are configured. Use this before making a delegated payment to verify the delegation hasn't expired.

### Input

```typescript
interface DelegationStatusInput {
  caveats: CaveatConfig;
}
```

### Output

```typescript
type DelegationStatusOutput = DelegationStatusInfo;
```

---

## Capability: Make Delegated Payment

~~~meta
id: payment.delegated
transport: INTERNAL
~~~

### Intention

Build the transaction data for a delegated payment through the X402Facilitator contract. This uses an active EIP-7702 delegation to pay a seller on behalf of a buyer, settling the x402 HTTP payment on-chain.

Returns encoded calldata for `X402Facilitator.settleDelegated()` — you still need to submit this transaction to the network. The delegation's caveat enforcers (spend limits, time windows, etc.) are verified on-chain during execution.

**Prerequisites:** Active delegation from `delegation.setup`. Valid solver registration.

### Input

```typescript
interface MakeDelegatedPaymentInput {
  delegationHash: Bytes32;
  paymentHash: Bytes32;        // Unique payment identifier
  token: Address;              // ERC20 token address
  amount: bigint;              // Payment amount in token units
  seller: Address;             // Payment recipient
  buyer: Address;              // Delegator address
  receiptId: Bytes32;          // IRSB receipt ID to post
  intentHash: Bytes32;         // Intent hash for receipt
  proof: Bytes32;              // x402 payment proof
  expiry: bigint;              // Settlement deadline (0 = no expiry)
}
```

### Output

```typescript
type MakeDelegatedPaymentOutput = PaymentResult;
```

### Logic Constraints

- Delegation must be Active (not revoked)
- All caveat enforcers must pass (spend limit not exceeded, within time window, target/method allowed)
- `amount` must not exceed per-transaction spend limit
- Cumulative daily spend must not exceed daily cap
- `token` must be an approved target or within the allowed targets list
- `expiry` of 0 means no deadline; non-zero must be in the future

---

## Capability: Create Escrow

~~~meta
id: escrow.create
transport: INTERNAL
idempotent: false
~~~

### Intention

Lock funds in the EscrowVault contract, tied to a specific receipt. Use this in `Commerce` mode where payment should only release after receipt finalization. The escrow holds ETH or ERC20 tokens until the receipt is finalized (funds released to solver) or disputed (funds refunded to depositor).

For native ETH escrows, use `escrow.create` directly. For ERC20 tokens, call `escrow.approve-erc20` first to grant the EscrowVault spending permission.

### Input

```typescript
interface CreateEscrowInput {
  /** Escrow ID (usually derived from payment ref) */
  escrowId: Bytes32;
  /** Receipt ID this escrow is linked to */
  receiptId: Bytes32;
  /** Token address (0x0 for native ETH) */
  token: Address;
  /** Amount to escrow */
  amount: bigint;
  /** Release deadline (must be >= receipt expiry) */
  deadline: bigint;
  /** RPC URL */
  rpcUrl: string;
  /** Depositor's private key or signer */
  depositorSigner: string;
}
```

### Output

```typescript
interface CreateEscrowOutput {
  txHash: string;
  escrowId: Bytes32;
}
```

### Logic Constraints

- `deadline` must be >= the linked receipt's expiry
- For native ETH: send the amount as `msg.value`
- For ERC20: must have prior approval via `escrow.approve-erc20`
- `escrowId` must be unique (not already used)

---

## Capability: Get Escrow Info

~~~meta
id: escrow.info
transport: INTERNAL
~~~

### Intention

Look up the status and details of an escrow by its ID. Returns the linked receipt, depositor, token, amount, deadline, and current status (Active, Released, or Refunded).

### Input

```typescript
interface GetEscrowInfoInput {
  escrowId: Bytes32;
  rpcUrl: string;
  escrowAddress: Address;
}
```

### Output

```typescript
type GetEscrowInfoOutput = EscrowInfo;
```

---

## Capability: Approve ERC20 for Escrow

~~~meta
id: escrow.approve-erc20
transport: INTERNAL
idempotent: true
~~~

### Intention

Grant the EscrowVault contract permission to spend ERC20 tokens on behalf of the depositor. Must be called before `escrow.create` when escrowing ERC20 tokens (not needed for native ETH).

### Input

```typescript
interface ApproveERC20Input {
  token: Address;       // ERC20 token address
  amount: bigint;       // Amount to approve
  rpcUrl: string;
  escrowAddress: Address;
  depositorSigner: string;
}
```

### Output

```typescript
interface ApproveERC20Output {
  txHash: string;
}
```

---

## Capability: Create Escrow from x402

~~~meta
id: escrow.create-from-x402
transport: INTERNAL
idempotent: false
~~~

### Intention

Convenience method: create an escrow directly from x402 payment data. Derives the escrow ID from the payment reference and calculates appropriate parameters. Use this in Commerce mode for the simplest escrow integration.

### Input

```typescript
interface CreateEscrowFromX402Input {
  payment: X402Payment;
  receiptId: Bytes32;
  depositor: Address;
  deadline: bigint;
  rpcUrl: string;
  escrowAddress: Address;
  depositorSigner: string;
}
```

### Output

```typescript
interface CreateEscrowFromX402Output {
  txHash: string;
  escrowId: Bytes32;
}
```

---

## Capability: Build Delegation Authorization

~~~meta
id: delegation.build-authorization
transport: INTERNAL
~~~

### Intention

Build the EIP-7702 authorization that designates the WalletDelegate contract as the execution handler for a user's EOA. This is the first signing step in the delegation setup — the user's wallet signs this to allow the WalletDelegate to execute on their behalf.

For the full setup flow including delegation struct and permission request, use `delegation.setup` instead. Use this lower-level function only when you need fine-grained control.

### Input

```typescript
interface BuildAuthorizationInput {
  delegator: Address;
  walletDelegateAddress: Address;
  chainId: number;
  caveats: CaveatConfig;
}
```

### Output

```typescript
interface BuildAuthorizationOutput {
  chainId: number;
  address: Address;
  nonce: bigint;
}
```

---

## Capability: Build Delegation

~~~meta
id: delegation.build
transport: INTERNAL
~~~

### Intention

Build the delegation struct with caveat enforcers for EIP-712 signing. This creates the on-chain delegation that constrains what the WalletDelegate can do. Returns the delegation struct, EIP-712 typed data for signing, and the delegation hash.

For the full setup flow, use `delegation.setup`. Use this lower-level function when building custom delegation workflows.

### Input

```typescript
type BuildDelegationInput = BuyerSetupConfig;
```

### Output

```typescript
type BuildDelegationOutput = DelegationResult;
```

---

## Capability: Check Delegation Time Valid

~~~meta
id: delegation.time-valid
transport: INTERNAL
~~~

### Intention

Quick check whether a delegation's time window is currently valid. Returns `false` if the current time is before `notBefore` or after `notAfter`. Returns `true` if no time window caveat is configured.

### Input

```typescript
interface TimeValidInput {
  caveats: CaveatConfig;
}
```

### Output

```typescript
type TimeValidOutput = boolean;
```

---

## Capability: Build Permission Request

~~~meta
id: permissions.build-request
transport: INTERNAL
~~~

### Intention

Build an ERC-7715 permission request for wallet UX integration. Wallets that support ERC-7715 (`wallet_requestExecutionPermissions`) can display a structured permission prompt to users, showing exactly what the delegation allows. This is the recommended UX path for buyer delegation setup.

### Input

```typescript
type BuildPermissionRequestInput = BuyerSetupConfig;
```

### Output

```typescript
interface BuildPermissionRequestOutput {
  chainId: number;
  address: Address;
  permissions: Array<{ type: string; data: Record<string, unknown> }>;
  expiry: number;
}
```

---

## Capability: Compute Receipt V2 ID

~~~meta
id: receipt.compute-id
transport: INTERNAL
~~~

### Intention

Compute the deterministic ID for a V2 receipt from its fields. The receipt ID is a keccak256 hash of the EIP-712 struct data. Use this to predict the receipt ID before posting, or to verify that a posted receipt matches expected parameters.

### Input

```typescript
interface ComputeReceiptIdInput {
  receipt: IntentReceiptV2;
}
```

### Output

```typescript
type ComputeReceiptIdOutput = Bytes32;
```

---

## Capability: Verify Receipt V2 Signatures

~~~meta
id: receipt.verify-signatures
transport: INTERNAL
~~~

### Intention

Verify both the solver and client EIP-712 signatures on a V2 receipt. Returns `true` only if both signatures are valid for the given receipt data. Use this to validate receipts before trusting their claims.

### Input

```typescript
interface VerifySignaturesInput {
  receipt: IntentReceiptV2;
  solverAddress: Address;
  clientAddress: Address;
  chainId: number;
  hubAddress: Address;
}
```

### Output

```typescript
type VerifySignaturesOutput = boolean;
```

---

## Capability: Get Network Config

~~~meta
id: config.network
transport: INTERNAL
~~~

### Intention

Get the contract addresses and configuration for a supported chain. Currently supports Sepolia testnet. Returns hub, escrow, registry addresses and explorer URL.

### Input

```typescript
interface GetNetworkConfigInput {
  chainId: number;
}
```

### Output

```typescript
type GetNetworkConfigOutput = NetworkConfig;
```

### Logic Constraints

- Throws if `chainId` is not supported
- Use `config.is-supported-chain` to check first

---

## Capability: Check Supported Chain

~~~meta
id: config.is-supported-chain
transport: INTERNAL
~~~

### Intention

Check if a chain ID is supported by the x402-IRSB integration. Use before calling any chain-specific operation.

### Input

```typescript
interface IsSupportedChainInput {
  chainId: number;
}
```

### Output

```typescript
type IsSupportedChainOutput = boolean;
```

---

## Capability: Create x402 Payload

~~~meta
id: schema.create-payload
transport: INTERNAL
~~~

### Intention

Construct a complete x402 receipt payload from its component parts. Generates the nonce, sets the schema version, and assembles all fields. Use this to create the canonical payload structure before building a receipt.

### Input

```typescript
interface CreatePayloadInput {
  service: X402Service;
  payment: X402Payment;
  request: X402Request;
  response: X402Response;
  timing: { issuedAt: number; expiry: number };
}
```

### Output

```typescript
type CreatePayloadOutput = X402ReceiptPayload;
```

---

## Capability: Compute Payload Commitment

~~~meta
id: schema.compute-commitment
transport: INTERNAL
~~~

### Intention

Compute the keccak256 commitment hash of an x402 payload. This hash goes on-chain as the `metadataCommitment` field of the V2 receipt. The full payload stays off-chain (IPFS/Arweave) for privacy.

### Input

```typescript
interface ComputeCommitmentInput {
  payload: X402ReceiptPayload;
}
```

### Output

```typescript
type ComputeCommitmentOutput = Bytes32;
```

---

## Capability: Verify Commitment

~~~meta
id: schema.verify-commitment
transport: INTERNAL
~~~

### Intention

Verify that an x402 payload matches its on-chain commitment hash. Use this to validate that an off-chain payload is genuine — recompute the commitment and compare with the on-chain `metadataCommitment`.

### Input

```typescript
interface VerifyCommitmentInput {
  payload: X402ReceiptPayload;
  expectedCommitment: Bytes32;
}
```

### Output

```typescript
type VerifyCommitmentOutput = boolean;
```

---

## Capability: Recover Signer

~~~meta
id: signing.recover-signer
transport: INTERNAL
~~~

### Intention

Recover the Ethereum address that produced a signature on a V2 receipt. Use this to verify who actually signed a receipt when you have the signature but not the signer's address. Works for both solver and client signatures.

### Input

```typescript
interface RecoverSignerInput {
  receipt: IntentReceiptV2;
  signature: Signature;
  chainId: number;
  hubAddress: Address;
}
```

### Output

```typescript
/** Recovered signer address */
type RecoverSignerOutput = Address;
```

---

## Capability: Sign as Service

~~~meta
id: signing.sign-as-service
transport: INTERNAL
~~~

### Intention

Sign a V2 receipt as the solver (service provider) using a private key. Lower-level than `receipt.sign-dual` — use this when you need to sign only the solver side, or when solver and client signing happens asynchronously (e.g., client signs via wallet connect while solver signs server-side).

### Input

```typescript
interface SignAsServiceInput {
  receipt: IntentReceiptV2;
  privateKey: string;
  chainId: number;
  hubAddress: Address;
}
```

### Output

```typescript
/** EIP-712 signature */
type SignAsServiceOutput = Signature;
```

---

## Capability: Sign as Client

~~~meta
id: signing.sign-as-client
transport: INTERNAL
~~~

### Intention

Sign a V2 receipt as the client (payer/requester). Use this when the client signs separately from the solver — for example, when the client is an end-user wallet signing via EIP-712 in a browser, while the solver signs server-side.

### Input

```typescript
interface SignAsClientInput {
  receipt: IntentReceiptV2;
  privateKey: string;
  chainId: number;
  hubAddress: Address;
}
```

### Output

```typescript
/** EIP-712 signature */
type SignAsClientOutput = Signature;
```

---

## Capability: Validate Receipt V2

~~~meta
id: receipt.validate
transport: INTERNAL
~~~

### Intention

Validate that a V2 receipt struct has all required fields populated and well-formed before posting. Use this as a pre-flight check to catch missing fields, empty hashes, or invalid pointers before spending gas on a transaction.

### Input

```typescript
interface ValidateReceiptV2Input {
  receipt: IntentReceiptV2;
}
```

### Output

```typescript
interface ValidateReceiptV2Output {
  valid: boolean;
  issues: string[];
}
```

---

## Capability: Compute Request Fingerprint

~~~meta
id: schema.compute-request-fingerprint
transport: INTERNAL
~~~

### Intention

Compute a deterministic fingerprint from x402 request parameters for replay prevention. The fingerprint is a keccak256 hash of the canonical request components. Include this in the `X402Request.requestFingerprint` field.

### Input

```typescript
interface ComputeRequestFingerprintInput {
  service: X402Service;
  payment: X402Payment;
  requestId: string;
}
```

### Output

```typescript
type ComputeRequestFingerprintOutput = Bytes32;
```
