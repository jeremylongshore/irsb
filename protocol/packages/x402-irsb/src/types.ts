/**
 * x402 ↔ IRSB Integration Types
 *
 * Core type definitions for integrating x402 HTTP Payment Protocol
 * with IRSB ReceiptV2 system.
 */

/**
 * Schema version for forward compatibility
 */
export const X402_PAYLOAD_VERSION = '1.0.0';

/**
 * Privacy levels matching IRSB ReceiptV2
 */
export enum PrivacyLevel {
  /** Full receipt visible on-chain */
  Public = 0,
  /** Commitment visible, payload gated via Lit or similar */
  SemiPublic = 1,
  /** Commitment only, fully encrypted payload */
  Private = 2,
}

/**
 * Service identification for x402 endpoint
 */
export interface X402Service {
  /** Unique service identifier (e.g., "acme-api-v1") */
  serviceId: string;
  /** HTTP method + path (e.g., "POST /api/generate") */
  endpoint: string;
  /** Host domain (e.g., "api.example.com") */
  domain: string;
}

/**
 * Payment details from x402 transaction
 */
export interface X402Payment {
  /** Transaction hash or facilitator reference (NOT raw proof) */
  paymentRef: string;
  /** Token symbol or address (e.g., "ETH", "USDC", "0x...") */
  asset: string;
  /** Amount as string for precision (wei for ETH) */
  amount: string;
  /** Chain ID where payment occurred */
  chainId: number;
}

/**
 * Request identification
 */
export interface X402Request {
  /** UUID for this request */
  requestId: string;
  /** Hash of canonical request components */
  requestFingerprint: string;
}

/**
 * Response artifact pointers
 */
export interface X402Response {
  /** CID or URL to response artifact (off-chain storage) */
  resultPointer: string;
  /** Hash of response content for verification */
  resultDigest: string;
}

/**
 * Timing information for replay prevention
 */
export interface X402Timing {
  /** Unix timestamp when receipt was issued */
  issuedAt: number;
  /** Unix timestamp when receipt expires */
  expiry: number;
  /** Unique per-receipt nonce */
  nonce: string;
}

/**
 * Complete x402 receipt payload
 *
 * This is the canonical structure for x402 payment receipts.
 * The entire payload is committed on-chain as a hash, with
 * the full data stored off-chain (IPFS/Arweave).
 */
export interface X402ReceiptPayload {
  /** Schema version */
  version: string;
  /** Service identification */
  service: X402Service;
  /** Payment details */
  payment: X402Payment;
  /** Request identification */
  request: X402Request;
  /** Response artifact pointers */
  response: X402Response;
  /** Timing for replay prevention */
  timing: X402Timing;
}

/**
 * IRSB ReceiptV2 structure (matching Solidity struct)
 */
export interface IntentReceiptV2 {
  intentHash: string;
  constraintsHash: string;
  routeHash: string;
  outcomeHash: string;
  evidenceHash: string;
  metadataCommitment: string;
  ciphertextPointer: string;
  privacyLevel: PrivacyLevel;
  escrowId: string;
  createdAt: bigint;
  expiry: bigint;
  solverId: string;
  solverSig: string;
  clientSig: string;
}

/**
 * Parameters for building ReceiptV2 from x402 payload
 */
export interface X402ToReceiptParams {
  /** The x402 receipt payload */
  payload: X402ReceiptPayload;
  /** CID or digest string for off-chain ciphertext */
  ciphertextPointer: string;
  /** Privacy level (default: SemiPublic) */
  privacyLevel?: PrivacyLevel;
  /** Optional escrow ID for commerce mode */
  escrowId?: string;
  /** Registered IRSB solver ID */
  solverId: string;
}

/**
 * Result of building a ReceiptV2
 */
export interface X402ReceiptResult {
  /** The built receipt (unsigned) */
  receiptV2: IntentReceiptV2;
  /** EIP-712 signing payloads for solver and client */
  signingPayloads: {
    solver: EIP712TypedData;
    client: EIP712TypedData;
  };
  /** Debug information */
  debug: {
    metadataCommitment: string;
    intentHash: string;
    constraintsHash: string;
    routeHash: string;
  };
}

/**
 * EIP-712 typed data structure
 */
export interface EIP712TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

/**
 * Options for posting receipt to IRSB Hub
 */
export interface PostX402ReceiptOptions {
  /** RPC URL for the target chain */
  rpcUrl: string;
  /** IntentReceiptHub contract address */
  hubAddress: string;
  /** Solver's private key or signer */
  solverSigner: string;
  /** Optional: Client's private key or signer for dual attestation */
  clientSigner?: string;
  /** Gas limit override */
  gasLimit?: bigint;
}

/**
 * Escrow creation parameters for commerce mode
 */
export interface X402EscrowParams {
  /** Escrow ID (usually derived from payment ref) */
  escrowId: string;
  /** Receipt ID this escrow is linked to */
  receiptId: string;
  /** Depositor address (client) */
  depositor: string;
  /** Token address (address(0) for native) */
  token: string;
  /** Amount to escrow */
  amount: bigint;
  /** Deadline for escrow (must be >= receipt expiry) */
  deadline: bigint;
}

/**
 * Operational mode for x402 integration
 */
export enum X402Mode {
  /** Payment settles immediately via x402, receipt is for reputation/disputes */
  Micropayment = 'micropayment',
  /** Payment goes to escrow, released on receipt finalization */
  Commerce = 'commerce',
}

/**
 * Configuration for x402-IRSB integration
 */
export interface X402IRSBConfig {
  /** Operational mode */
  mode: X402Mode;
  /** Chain ID for IRSB contracts */
  chainId: number;
  /** IntentReceiptHub address */
  hubAddress: string;
  /** EscrowVault address (required for commerce mode) */
  escrowAddress?: string;
  /** SolverRegistry address */
  registryAddress: string;
  /** Default privacy level */
  defaultPrivacyLevel: PrivacyLevel;
}

// ============ Delegation Types (EIP-7702 / ERC-7710) ============

/**
 * Deployed enforcer contract addresses
 */
export interface EnforcerAddresses {
  spendLimit: `0x${string}`;
  timeWindow: `0x${string}`;
  allowedTargets: `0x${string}`;
  allowedMethods: `0x${string}`;
  nonce: `0x${string}`;
}

/**
 * High-level caveat configuration for buyer delegations
 */
export interface CaveatConfig {
  enforcerAddresses: EnforcerAddresses;
  spendLimit?: {
    token: `0x${string}`;
    dailyCap: bigint;
    perTxCap: bigint;
  };
  timeWindow?: {
    notBefore: bigint;
    notAfter: bigint;
  };
  allowedTargets?: {
    targets: `0x${string}`[];
  };
  allowedMethods?: {
    selectors: `0x${string}`[];
  };
  nonce?: {
    startNonce: bigint;
  };
}

/**
 * Configuration for setting up a buyer delegation
 */
export interface BuyerSetupConfig {
  delegator: `0x${string}`;
  walletDelegateAddress: `0x${string}`;
  chainId: number;
  caveats: CaveatConfig;
  salt?: bigint;
  nonce?: bigint;
}

/**
 * Full delegation configuration (extends BuyerSetupConfig)
 */
export interface BuyerDelegationConfig extends BuyerSetupConfig {}

/**
 * EIP-7702 authorization for wallet signing
 */
export interface EIP7702Authorization {
  chainId: number;
  address: `0x${string}`;
  nonce: bigint;
}

/**
 * Result of building a delegation
 */
export interface DelegationResult {
  delegation: {
    delegator: `0x${string}`;
    delegate: `0x${string}`;
    authority: `0x${string}`;
    caveats: Array<{ enforcer: `0x${string}`; terms: `0x${string}` }>;
    salt: bigint;
  };
  typedData: EIP712TypedData;
  delegationHash: `0x${string}`;
}

/**
 * Result of making a delegated payment
 */
export interface PaymentResult {
  delegationHash: `0x${string}`;
  settlementParams: {
    paymentHash: `0x${string}`;
    token: `0x${string}`;
    amount: bigint;
    seller: `0x${string}`;
    buyer: `0x${string}`;
    receiptId: `0x${string}`;
    intentHash: `0x${string}`;
    proof: `0x${string}`;
    expiry: bigint;
  };
  functionName: string;
  args: unknown[];
}

/**
 * Delegation status information
 */
export interface DelegationStatusInfo {
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

/**
 * ERC-7715 permission request
 */
export interface PermissionRequest {
  chainId: number;
  address: `0x${string}`;
  permissions: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  expiry: number;
}

/**
 * ERC-7715 permission response from wallet
 */
export interface PermissionResponse {
  grants: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  context: {
    account: `0x${string}`;
    expiry: number;
  };
}
