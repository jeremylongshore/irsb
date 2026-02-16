# x402 ↔ IRSB Integration Guide

This document describes how to integrate x402 HTTP Payment Protocol with IRSB (Intent Receipts & Solver Bonds) for accountable paid API services.

## Quickstart: Integrate in 30 Minutes

### Prerequisites

- Node.js 18+
- Ethereum wallet with Sepolia ETH
- Registered solver on IRSB (see below)

### Step 1: Install Packages (2 min)

```bash
npm install irsb-x402 ethers express
```

### Step 2: Register as Solver (5 min)

```bash
# Set your private key and RPC
export PRIVATE_KEY=0x...
export RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Register with 0.1 ETH bond
cast send 0xB6ab964832808E49635fF82D1996D6a888ecB745 \
  "registerSolver(string,address)" \
  "ipfs://metadata" \
  $(cast wallet address $PRIVATE_KEY) \
  --value 0.1ether \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# Get your solver ID
cast call 0xB6ab964832808E49635fF82D1996D6a888ecB745 \
  "getSolverByOperator(address)(bytes32)" \
  $(cast wallet address $PRIVATE_KEY) \
  --rpc-url $RPC_URL
```

### Step 3: Add x402 Middleware (10 min)

```typescript
// server.ts
import express from 'express';
import { Wallet, keccak256, toUtf8Bytes } from 'ethers';
import {
  createPayload,
  buildReceiptV2WithConfig,
  signAsService,
  PrivacyLevel,
} from 'irsb-x402';

const app = express();
app.use(express.json());

// Config
const PRICE_WEI = '1000000000000000'; // 0.001 ETH
const SOLVER_ID = '0x...'; // From Step 2
const HUB_ADDRESS = '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c';
const CHAIN_ID = 11155111; // Sepolia

// x402 middleware
app.use('/api/*', (req, res, next) => {
  const paymentProof = req.headers['x-payment-proof'];

  if (!paymentProof) {
    return res.status(402).json({
      error: 'Payment Required',
      x402: {
        amount: PRICE_WEI,
        asset: 'ETH',
        chainId: CHAIN_ID,
        recipient: SOLVER_ID,
      },
    });
  }

  // TODO: Verify payment on-chain (see full example)
  next();
});

// Protected endpoint
app.post('/api/generate', async (req, res) => {
  const requestId = crypto.randomUUID();
  const result = { output: 'Generated content...', requestId };

  // Build IRSB receipt
  const payload = createPayload({
    service: { serviceId: 'my-api', endpoint: '/api/generate', domain: 'localhost' },
    payment: { paymentRef: req.headers['x-payment-proof'], asset: 'ETH', amount: PRICE_WEI, chainId: CHAIN_ID },
    request: { requestId },
    response: { resultPointer: '', resultDigest: keccak256(toUtf8Bytes(JSON.stringify(result))) },
  });

  const { receiptV2 } = buildReceiptV2WithConfig(
    { payload, ciphertextPointer: '', solverId: SOLVER_ID, privacyLevel: PrivacyLevel.Public },
    CHAIN_ID,
    HUB_ADDRESS
  );

  const solverSig = await signAsService(receiptV2, process.env.PRIVATE_KEY!, CHAIN_ID, HUB_ADDRESS);

  res.json({
    result,
    receipt: { ...receiptV2, solverSig },
    signingPayload: { chainId: CHAIN_ID, hubAddress: HUB_ADDRESS },
  });
});

app.listen(3000, () => console.log('x402 service running on :3000'));
```

### Step 4: Test It (5 min)

```bash
# Start server
PRIVATE_KEY=0x... npx tsx server.ts

# Request without payment → 402
curl http://localhost:3000/api/generate

# Request with mock payment → 200 + receipt
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "X-Payment-Proof: 0xmockpaymenthash" \
  -d '{"prompt": "Hello"}'
```

### Step 5: Post Receipt On-Chain (optional, 8 min)

```typescript
import { IRSBClient } from 'irsb';

const client = new IRSBClient({
  rpcUrl: process.env.RPC_URL!,
  hubAddress: HUB_ADDRESS,
});

// Post the receipt from Step 4
const tx = await client.postReceiptV2(receipt, signer);
console.log('Receipt posted:', tx.hash);
```

### Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

### Next Steps

- Add real payment verification (query blockchain for tx)
- Store receipts in IPFS for `ciphertextPointer`
- Enable dual attestation (client signs too)
- See [full example](../examples/x402-express-service/) for production patterns

---

## Overview

**x402** is an HTTP protocol for paid API access (HTTP 402 Payment Required). **IRSB** provides on-chain accountability through receipts, bonds, and disputes.

Together, they enable:
- **Micropayments** for API calls with cryptographic receipts
- **Commerce flows** with escrow-backed transactions
- **Dispute resolution** for service failures
- **Reputation building** through on-chain history

## Architecture

```
┌─────────────┐      ┌─────────────────────────────────────────────────────┐
│   Client    │      │                  Service (Solver)                   │
├─────────────┤      ├─────────────────────────────────────────────────────┤
│             │ 402  │                                                     │
│ 1. Request  ├─────►│  Return 402 Payment Required                       │
│             │◄─────┤  + payment terms (amount, asset, recipient)        │
│             │      │                                                     │
│ 2. Pay      │      │                                                     │
│  (on-chain) │──────┼──────────────────────────────────────────┐         │
│             │      │                                          │         │
│             │      │                                          ▼         │
│ 3. Request  │ pay  │  ┌──────────────┐    ┌─────────────────────────┐  │
│  + proof    ├─────►│  │ Verify       │───►│ Execute Service         │  │
│             │      │  │ Payment      │    │ (AI inference, etc.)    │  │
│             │      │  └──────────────┘    └───────────┬─────────────┘  │
│             │      │                                   │                 │
│             │      │                                   ▼                 │
│             │ 200  │  ┌─────────────────────────────────────────────┐  │
│  4. Result  │◄─────┤  │ Generate IRSB ReceiptV2                     │  │
│  + Receipt  │      │  │ - Commit payload hash (metadataCommitment)  │  │
│             │      │  │ - Sign as solver                            │  │
│             │      │  │ - Return for client attestation             │  │
│             │      │  └─────────────────────────────────────────────┘  │
└──────┬──────┘      └─────────────────────────────────────────────────────┘
       │
       │ 5. Sign as client (optional)
       │ 6. Post receipt on-chain
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         IRSB IntentReceiptHub                           │
├─────────────────────────────────────────────────────────────────────────┤
│  - Store receipt commitment (not plaintext)                             │
│  - Enable disputes within challenge window                              │
│  - Finalize after challenge window                                      │
│  - Update solver reputation                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Two Operational Modes

### Mode 1: Micropayment (x402-only)

For low-stakes, high-volume requests:

1. Client pays via x402 (immediate settlement)
2. Service executes and returns result + receipt
3. Receipt posted for reputation/disputes
4. No escrow (payment already settled)

**Use cases:**
- AI inference APIs
- Data queries
- Content generation
- Low-value transactions

### Mode 2: Commerce (Escrow + x402)

For high-stakes, trust-sensitive operations:

1. Client initiates x402 payment
2. Payment locked in EscrowVault (not to solver yet)
3. Service executes job
4. Receipt posted with escrow link
5. On finalization: escrow released to solver
6. On dispute (solver fault): escrow refunded to client

**Use cases:**
- Large orders/purchases
- Multi-step workflows
- New/untrusted solvers
- High-value transactions

## Privacy Model

### On-Chain (Visible to Everyone)

Only commitments and pointers are stored on-chain:

| Field | Content | Purpose |
|-------|---------|---------|
| `metadataCommitment` | `keccak256(canonicalPayload)` | Verify payload integrity |
| `ciphertextPointer` | `ipfs://Qm...` or URL | Locate encrypted payload |
| `intentHash` | `keccak256(serviceId + requestId)` | Identify intent |
| `constraintsHash` | `keccak256(payment terms)` | Verify payment terms |
| `routeHash` | `keccak256(domain + endpoint)` | Identify service route |
| `evidenceHash` | `keccak256(paymentRef)` | Link to payment proof |
| `outcomeHash` | Hash of result | Verify result integrity |

### Off-Chain (Access Controlled)

Full payload stored encrypted off-chain:

- **Storage**: IPFS, Arweave, or private server
- **Encryption**: Optional Lit Protocol integration
- **Access**: Controlled by privacy level

### Privacy Levels

```typescript
enum PrivacyLevel {
  Public = 0,      // Payload visible to all
  SemiPublic = 1,  // Commitment visible, payload access-gated
  Private = 2,     // Commitment only, Lit-encrypted payload
}
```

## Field Mapping

The x402-irsb library transforms x402 payment artifacts into ReceiptV2 fields:

| ReceiptV2 Field | x402 Source | Computation |
|-----------------|-------------|-------------|
| `intentHash` | service, request | `keccak256(serviceId + requestId)` |
| `constraintsHash` | payment, timing | `keccak256(asset + amount + chainId + expiry)` |
| `routeHash` | service | `keccak256(domain + endpoint)` |
| `outcomeHash` | response | Direct from `response.resultDigest` |
| `evidenceHash` | payment | `keccak256(paymentRef)` |
| `metadataCommitment` | entire payload | `keccak256(canonicalJSON(payload))` |
| `ciphertextPointer` | response | `response.resultPointer` (CID) |
| `createdAt` | timing | `timing.issuedAt` |
| `expiry` | timing | `timing.expiry` |

## Usage

### Installation

```bash
pnpm add irsb-x402 ethers
```

### Basic Usage (Micropayment Mode)

```typescript
import {
  createPayload,
  buildReceiptV2WithConfig,
  signAsService,
  validateReceiptV2,
} from 'irsb-x402';

// 1. Create x402 payload after payment verification
const payload = createPayload({
  service: {
    serviceId: 'my-service-001',
    endpoint: 'POST /api/generate',
    domain: 'api.myservice.com',
  },
  payment: {
    paymentRef: txHash,
    asset: 'ETH',
    amount: '1000000000000000', // 0.001 ETH
    chainId: 11155111,
  },
  request: {
    requestId: uuidv4(),
  },
  response: {
    resultPointer: resultCID,
    resultDigest: resultHash,
  },
});

// 2. Build ReceiptV2
const chainId = 11155111;
const hubAddress = '0x...';
const result = buildReceiptV2WithConfig(
  {
    payload,
    ciphertextPointer: resultCID,
    solverId: '0x...',
    privacyLevel: PrivacyLevel.SemiPublic,
  },
  chainId,
  hubAddress
);

// 3. Validate
if (!validateReceiptV2(result.receiptV2)) {
  throw new Error('Invalid receipt');
}

// 4. Sign as service
const signedReceipt = {
  ...result.receiptV2,
  solverSig: await signAsService(
    result.receiptV2,
    solverPrivateKey,
    chainId,
    hubAddress
  ),
};

// 5. Return to client with signing payload for dual attestation
```

### Commerce Mode (with Escrow)

```typescript
import {
  escrowIdFromPayment,
  calculateEscrowParams,
  createEscrowFromX402,
} from 'irsb-x402';

// Generate escrow ID from payment
const escrowId = escrowIdFromPayment(payment, chainId);

// Create escrow (locks funds)
const escrowResult = await createEscrowFromX402(
  payment,
  receiptId,
  depositor,
  escrowAddress,
  rpcUrl,
  signerKey,
  chainId
);

// Build receipt with escrow link
const result = buildReceiptV2WithConfig(
  {
    payload,
    ciphertextPointer: resultCID,
    solverId,
    escrowId, // Link to escrow
    privacyLevel: PrivacyLevel.Private,
  },
  chainId,
  hubAddress
);

// On finalization: hub releases escrow to solver
// On dispute (solver fault): hub refunds escrow to client
```

### Dual Attestation

For maximum accountability, both parties sign:

```typescript
import { signReceiptDual } from 'irsb-x402';

// Sign with both solver and client keys
const dualSignedReceipt = await signReceiptDual(
  receipt,
  solverPrivateKey,
  clientPrivateKey,
  chainId,
  hubAddress
);

// Both signatures now present
console.log(dualSignedReceipt.solverSig); // Solver's EIP-712 signature
console.log(dualSignedReceipt.clientSig); // Client's EIP-712 signature
```

### Commitment Verification

Verify payload matches on-chain commitment:

```typescript
import { computePayloadCommitment, verifyCommitment } from 'irsb-x402';

// Compute commitment
const commitment = computePayloadCommitment(payload);

// Verify against stored commitment
const isValid = verifyCommitment(onChainCommitment, payload);
```

## Replay Protection

The protocol includes multiple layers of replay protection:

1. **Unique nonce**: Each payload includes a random nonce
2. **Request ID**: UUID uniquely identifies each request
3. **Timestamp + expiry**: Time-bound validity
4. **Chain ID in domain**: Prevents cross-chain replay
5. **Contract address in domain**: Prevents cross-contract replay
6. **Receipt ID uniqueness**: Hub enforces unique receipt IDs

## Security Considerations

### Payment Verification

Always verify payments on-chain before generating receipts:

```typescript
// ❌ Don't trust client claims
const payment = req.body.payment;

// ✅ Verify on-chain
const tx = await provider.getTransaction(paymentRef);
const receipt = await tx.wait();
// Check recipient, amount, confirmations...
```

### Private Key Security

- Store solver private key securely (HSM, secrets manager)
- Never log or expose private keys
- Use separate keys for signing vs funds

### Event Privacy

Never emit plaintext data in events:

```solidity
// ❌ Wrong: exposes private data
event ReceiptPosted(bytes32 receiptId, string requestBody);

// ✅ Correct: only emit commitments
event ReceiptPosted(bytes32 receiptId, bytes32 metadataCommitment);
```

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious service | Receipt commitment proves what was agreed; disputes for non-delivery |
| Malicious client | Cannot forge payment proof; must pay before service |
| Replay attacks | Nonce, timestamps, chain ID, contract address in EIP-712 domain |
| Front-running | Service controls receipt posting timing |
| Data tampering | Cryptographic commitments detect any modification |
| Privacy leaks | Only hashes on-chain; full data encrypted off-chain |

## Example Application

See the [x402-express-service example](../examples/x402-express-service/) for a complete working implementation.

## API Reference

### Schema Functions

| Function | Description |
|----------|-------------|
| `createPayload(params)` | Create x402 payload with defaults |
| `canonicalize(payload)` | Deterministic JSON serialization |
| `computePayloadCommitment(payload)` | keccak256 of canonical payload |
| `verifyCommitment(commitment, payload)` | Verify commitment matches payload |
| `generateNonce()` | Generate random hex nonce |

### Receipt Functions

| Function | Description |
|----------|-------------|
| `buildReceiptV2FromX402(params)` | Build ReceiptV2 from x402 payload |
| `buildReceiptV2WithConfig(params, chainId, hub)` | Build with chain config |
| `validateReceiptV2(receipt)` | Validate receipt fields |
| `computeReceiptV2Id(receipt)` | Compute deterministic receipt ID |
| `createSigningPayload(receipt, chainId, hub)` | Generate EIP-712 typed data |

### Signing Functions

| Function | Description |
|----------|-------------|
| `signAsService(receipt, key, chainId, hub)` | Sign as solver |
| `signAsClient(receipt, key, chainId, hub)` | Sign as client |
| `signReceiptDual(receipt, solverKey, clientKey, chainId, hub)` | Sign both |
| `verifySolverSignature(receipt, address, chainId, hub)` | Verify solver sig |
| `verifyClientSignature(receipt, address, chainId, hub)` | Verify client sig |
| `recoverSigner(receipt, signature, chainId, hub)` | Recover signer address |

### Escrow Functions

| Function | Description |
|----------|-------------|
| `generateEscrowId(paymentRef, chainId)` | Generate escrow ID |
| `escrowIdFromPayment(payment, chainId)` | Escrow ID from x402 payment |
| `calculateEscrowParams(payment, receiptId, depositor, chainId)` | Calc params |
| `createNativeEscrow(params, escrowAddr, rpcUrl, key)` | Create ETH escrow |
| `createERC20Escrow(params, escrowAddr, rpcUrl, key)` | Create ERC20 escrow |
| `getEscrowInfo(escrowId, escrowAddr, rpcUrl)` | Query escrow state |

## Related Documentation

- [IRSB Protocol Overview](./001-RL-PROP-irsb-solver-accountability.md)
- [Receipt Schema](./007-AT-SPEC-irsb-receipt-schema.md)
- [Privacy Architecture](./PRIVACY.md)
- [ERC-8004 Validation](./VALIDATION_PROVIDER.md)
