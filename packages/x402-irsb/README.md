# @irsb/x402-integration

Transform x402 HTTP payment artifacts into IRSB ReceiptV2 structures with proper field mapping, EIP-712 signing, and escrow integration.

## Installation

```bash
npm install @irsb/x402-integration
# or
pnpm add @irsb/x402-integration
# or
yarn add @irsb/x402-integration
```

**Peer dependency:** ethers v6.x

## Quick Start

```typescript
import {
  createPayload,
  buildReceiptV2WithConfig,
  signAsService,
  postReceiptV2,
  SEPOLIA_CONFIG,
} from '@irsb/x402-integration';

// 1. Create x402 payload from payment artifacts
const payload = createPayload({
  service: {
    serviceId: 'my-api-v1',
    endpoint: 'POST /api/generate',
    domain: 'api.example.com',
  },
  payment: {
    paymentRef: '0x...txHash',
    asset: 'ETH',
    amount: '1000000000000000', // 0.001 ETH in wei
    chainId: 11155111,
  },
  request: { requestId: 'uuid-here' },
  response: {
    resultPointer: 'ipfs://Qm...',
    resultDigest: '0x...keccak256',
  },
});

// 2. Build ReceiptV2 with chain config
const { receiptV2, signingPayloads } = buildReceiptV2WithConfig(
  {
    payload,
    ciphertextPointer: 'ipfs://Qm...',
    solverId: '0x...your-registered-solver-id',
  },
  SEPOLIA_CONFIG.chainId,
  SEPOLIA_CONFIG.hubAddress
);

// 3. Sign as service (solver)
const solverSig = await signAsService(
  receiptV2,
  process.env.SOLVER_PRIVATE_KEY!,
  SEPOLIA_CONFIG.chainId,
  SEPOLIA_CONFIG.hubAddress
);

// 4. Post to IntentReceiptHub
const result = await postReceiptV2(
  { ...receiptV2, solverSig },
  {
    rpcUrl: 'https://rpc.sepolia.org',
    hubAddress: SEPOLIA_CONFIG.hubAddress,
    solverSigner: process.env.SOLVER_PRIVATE_KEY!,
  }
);

console.log('Receipt posted:', result.receiptId);
console.log('Transaction:', result.txHash);
```

## Features

### Schema & Commitments

```typescript
import {
  computePayloadCommitment,
  computeIntentHash,
  computeRouteHash,
  computeEvidenceHash,
  verifyCommitment,
  canonicalize,
} from '@irsb/x402-integration';

// Compute deterministic commitment from payload
const commitment = computePayloadCommitment(payload);

// Verify commitment matches payload
const isValid = verifyCommitment(payload, commitment);
```

### Receipt Building

```typescript
import {
  buildReceiptV2FromX402,
  buildReceiptV2WithConfig,
  validateReceiptV2,
  computeReceiptV2Id,
  PrivacyLevel,
} from '@irsb/x402-integration';

// Build with automatic hash computation
const result = buildReceiptV2WithConfig(
  {
    payload,
    ciphertextPointer: 'ipfs://Qm...',
    solverId: '0x...',
    privacyLevel: PrivacyLevel.SemiPublic,
    escrowId: '0x...', // Optional, for commerce mode
  },
  chainId,
  hubAddress
);

// Validate receipt fields
const isValid = validateReceiptV2(result.receiptV2);

// Compute receipt ID (matches on-chain computation)
const receiptId = computeReceiptV2Id(result.receiptV2);
```

### Signing

```typescript
import {
  signAsService,
  signAsClient,
  signReceiptDual,
  verifySolverSignature,
  verifyClientSignature,
} from '@irsb/x402-integration';

// Solver signs first
const solverSig = await signAsService(receipt, solverPrivateKey, chainId, hubAddress);

// Client counter-signs for dual attestation
const clientSig = await signAsClient(receipt, clientPrivateKey, chainId, hubAddress);

// Or sign both in one call
const signedReceipt = await signReceiptDual(
  receipt,
  solverPrivateKey,
  clientPrivateKey,
  chainId,
  hubAddress
);

// Verify signatures
const solverAddr = await verifySolverSignature(signedReceipt, chainId, hubAddress);
const clientAddr = await verifyClientSignature(signedReceipt, chainId, hubAddress);
```

### Posting to Hub

```typescript
import {
  postReceiptV2,
  postReceiptV2FromX402,
  estimatePostGas,
  receiptExists,
} from '@irsb/x402-integration';

// Post signed receipt
const result = await postReceiptV2(signedReceipt, {
  rpcUrl: 'https://rpc.sepolia.org',
  hubAddress: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
  solverSigner: process.env.SOLVER_PRIVATE_KEY!,
  clientSigner: process.env.CLIENT_PRIVATE_KEY, // Optional
});

// All-in-one: build, sign, and post
const result = await postReceiptV2FromX402(
  { payload, ciphertextPointer, solverId },
  { rpcUrl, hubAddress, solverSigner, clientSigner }
);

// Check if receipt already exists
const exists = await receiptExists(receiptId, rpcUrl, hubAddress);

// Estimate gas before posting
const gas = await estimatePostGas(signedReceipt, { rpcUrl, hubAddress, solverSigner });
```

### Escrow (Commerce Mode)

```typescript
import {
  generateEscrowId,
  escrowIdFromPayment,
  createNativeEscrow,
  createERC20Escrow,
  getEscrowInfo,
  createEscrowFromX402,
} from '@irsb/x402-integration';

// Generate escrow ID from payment reference
const escrowId = escrowIdFromPayment(payload.payment.paymentRef);

// Create escrow linked to receipt
const result = await createNativeEscrow({
  escrowId,
  receiptId,
  depositor: clientAddress,
  amount: BigInt(payload.payment.amount),
  deadline: receipt.expiry,
}, {
  rpcUrl,
  escrowAddress,
  depositorSigner: clientPrivateKey,
});
```

### Network Configuration

```typescript
import { SEPOLIA_CONFIG, getNetworkConfig } from '@irsb/x402-integration';

// Pre-configured Sepolia addresses
console.log(SEPOLIA_CONFIG);
// {
//   chainId: 11155111,
//   name: 'sepolia',
//   hubAddress: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
//   registryAddress: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
//   disputeModuleAddress: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
// }

// Get config by chain ID
const config = getNetworkConfig(11155111);
```

## Privacy Levels

| Level | On-Chain Data | Off-Chain Data |
|-------|---------------|----------------|
| `Public` (0) | Full receipt fields | Not required |
| `SemiPublic` (1) | Commitment hash | Gated via Lit Protocol |
| `Private` (2) | Commitment only | Fully encrypted |

## Contract Addresses

### Sepolia Testnet

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## API Reference

### Types

```typescript
// Privacy levels
enum PrivacyLevel {
  Public = 0,
  SemiPublic = 1,
  Private = 2,
}

// x402 operational modes
enum X402Mode {
  Micropayment = 'micropayment', // Payment settles immediately
  Commerce = 'commerce',         // Payment held in escrow
}

// Full type exports
export {
  X402Service,
  X402Payment,
  X402Request,
  X402Response,
  X402Timing,
  X402ReceiptPayload,
  IntentReceiptV2,
  X402ToReceiptParams,
  X402ReceiptResult,
  EIP712TypedData,
  PostX402ReceiptOptions,
  X402EscrowParams,
}
```

## Related

- [IRSB Protocol](https://github.com/intent-solutions-io/irsb-protocol) - Intent Receipts & Solver Bonds
- [x402 Specification](https://x402.org) - HTTP Payment Protocol
- [x402 Express Example](../../examples/x402-express-service/) - Full service implementation

## License

MIT
