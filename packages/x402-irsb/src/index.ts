/**
 * x402 ↔ IRSB Integration Pack
 *
 * Transform x402 payment artifacts into IRSB ReceiptV2 structures
 * with proper field mapping, EIP-712 signing, and escrow integration.
 *
 * @packageDocumentation
 */

// Core types
export {
  X402_PAYLOAD_VERSION,
  PrivacyLevel,
  X402Mode,
  type X402Service,
  type X402Payment,
  type X402Request,
  type X402Response,
  type X402Timing,
  type X402ReceiptPayload,
  type IntentReceiptV2,
  type X402ToReceiptParams,
  type X402ReceiptResult,
  type EIP712TypedData,
  type PostX402ReceiptOptions,
  type X402EscrowParams,
} from './types.js';

// Schema and commitment functions
export {
  canonicalize,
  computePayloadCommitment,
  computeRequestFingerprint,
  computeTermsHash,
  computeIntentHash,
  computeRouteHash,
  computeEvidenceHash,
  isValidCID,
  formatCiphertextPointer,
  verifyCommitment,
  generateNonce,
  createPayload,
} from './schema.js';

// Receipt building
export {
  RECEIPT_V2_TYPES,
  getEIP712Domain,
  buildReceiptV2FromX402,
  createSigningPayload,
  computeReceiptV2Id,
  buildReceiptV2WithConfig,
  validateReceiptV2,
} from './receipt.js';

// Signing helpers
export {
  signAsService,
  signAsClient,
  signReceiptDual,
  recoverSigner,
  verifySolverSignature,
  verifyClientSignature,
  getReceiptTypedDataHash,
  getPersonalSignHash,
} from './signing.js';

// Posting helpers
export {
  postReceiptV2,
  postReceiptV2FromX402,
  estimatePostGas,
  receiptExists,
  type PostReceiptResult,
} from './post.js';

// Escrow helpers (commerce mode)
export {
  EscrowStatus,
  generateEscrowId,
  escrowIdFromPayment,
  createNativeEscrow,
  createERC20Escrow,
  approveERC20ForEscrow,
  getEscrowInfo,
  canCreateEscrow,
  calculateEscrowParams,
  createEscrowFromX402,
  type EscrowInfo,
  type CreateEscrowResult,
} from './escrow.js';

// Network configuration
export {
  SEPOLIA_CONFIG,
  getNetworkConfig,
  requireNetworkConfig,
  isSupportedChain,
  getSupportedChainIds,
  getTransactionUrl,
  getAddressUrl,
  getHubUrl,
  type NetworkConfig,
} from './config.js';

// Delegation helpers (EIP-7702)
export {
  buildDelegationAuthorization,
  buildDelegation,
  buildCaveats,
  computeDelegationHash,
  isDelegationTimeValid,
} from './delegation.js';

// ERC-7715 Permission helpers
export {
  buildPermissionRequest,
  parsePermissionResponse,
  setupFromPermissions,
} from './permissions.js';

// Buyer SDK (high-level)
export {
  setupBuyerDelegation,
  makeDelegatedPayment,
  getDelegationStatus,
} from './buyer.js';

// Delegation types
export {
  type CaveatConfig,
  type BuyerSetupConfig,
  type BuyerDelegationConfig,
  type EIP7702Authorization,
  type DelegationResult,
  type PaymentResult,
  type DelegationStatusInfo,
  type PermissionRequest,
  type PermissionResponse,
  type EnforcerAddresses,
} from './types.js';
