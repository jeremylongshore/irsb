# IRSB Privacy Architecture

## Overview

IRSB V2 implements a privacy-preserving architecture where **sensitive data stays off-chain** while **cryptographic commitments live on-chain**. This enables:

- Verifiable receipts without exposing transaction details
- Selective disclosure to authorized parties
- Dispute resolution with controlled evidence access
- Compliance with data protection requirements

## Core Principles

### 1. Commitments, Not Plaintext

On-chain data contains only:
- **Hashes** (keccak256 commitments)
- **Pointers** (CIDs to encrypted off-chain data)
- **Metadata** (privacy level, timestamps, IDs)

**Never stored on-chain:**
- Order details or amounts (beyond commitments)
- Personally identifiable information
- Raw request/response data
- Unencrypted payloads

### 2. Three Privacy Levels

```
┌─────────────────────────────────────────────────────────────────┐
│                     Privacy Levels                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PUBLIC (0)         SEMI_PUBLIC (1)        PRIVATE (2)          │
│  ─────────          ─────────────          ────────             │
│                                                                 │
│  • Full receipt     • Commitment on-chain  • Commitment only    │
│    visible          • Payload gated by     • Encrypted with     │
│  • No encryption      Lit conditions         Lit Protocol       │
│  • Open access      • Solver + client      • Solver + client    │
│                       can decrypt            + arbitrator       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Receipt Creation Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Client  │    │  Solver  │    │   IPFS   │    │   IRSB   │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     │ 1. Order      │               │               │
     │──────────────>│               │               │
     │               │               │               │
     │               │ 2. Execute    │               │
     │<──────────────│               │               │
     │               │               │               │
     │ 3. Build payload + commit     │               │
     │────────────────────────────────────────────────────────>
     │               │               │               │
     │               │ 4. Encrypt & upload           │
     │               │──────────────>│               │
     │               │               │               │
     │               │<──────────────│ CID           │
     │               │               │               │
     │ 5. Sign receipt (dual attestation)           │
     │<──────────────│               │               │
     │               │               │               │
     │               │ 6. Post receipt (commitment + CID)
     │               │──────────────────────────────>│
     │               │               │               │
     └───────────────┴───────────────┴───────────────┘
```

### What Goes Where

| Data | Location | Format |
|------|----------|--------|
| Full order details | Off-chain (IPFS/Arweave) | Encrypted JSON |
| Metadata commitment | On-chain (receipt) | bytes32 hash |
| Ciphertext pointer | On-chain (receipt) | string CID |
| Access conditions | Off-chain (Lit) | JSON conditions |
| Evidence bundle | Off-chain (IPFS) | Encrypted JSON |
| Dispute evidence hash | On-chain (dispute) | bytes32 hash |

## Commitment Generation

### Canonical Hashing

To ensure deterministic commitments, payloads are **canonicalized** before hashing:

```typescript
import { generateMetadataCommitment } from 'irsb';

// Build your metadata
const metadata = {
  orderId: 'order-abc123',
  service: 'image-generation',
  params: {
    prompt: 'A sunset over mountains',
    model: 'dall-e-3',
  },
  pricing: {
    amount: '1000000000000000000', // 1 ETH in wei
    asset: 'ETH',
  },
};

// Generate commitment
const result = generateMetadataCommitment(metadata);

console.log(result.commitment);       // 0x... (32-byte hash)
console.log(result.canonicalPayload); // Deterministic JSON
console.log(result.originalPayload);  // Full payload with version/nonce
```

### Canonical JSON Rules

1. **Keys sorted alphabetically** at every nesting level
2. **No whitespace** between elements
3. **Arrays preserved** in original order
4. **Numbers as-is**, strings quoted

Example:
```javascript
// Input (unordered)
{ "z": 1, "a": { "y": 2, "x": 3 } }

// Canonical output
{"a":{"x":3,"y":2},"z":1}
```

### Payload Schema

Every commitment includes:

```typescript
interface MetadataPayload {
  version: string;    // Schema version (e.g., "1.0.0")
  timestamp: number;  // Unix timestamp
  nonce: string;      // Random 32-byte hex (replay protection)
  data: {             // Your custom data
    // ... anything
  };
}
```

## CID/Pointer Validation

IRSB uses **CIDs** (Content Identifiers) as pointers to off-chain data.

### Valid Pointer Rules

1. **Non-empty**
2. **Max 64 characters**
3. **Alphanumeric only** (a-z, A-Z, 0-9)

This supports base58 (IPFS v0) and base32 (IPFS v1) CIDs.

### Invalid Examples

```typescript
// ❌ Contains special characters
'ipfs://QmTest123'

// ❌ Too long
'a'.repeat(65)

// ❌ Empty
''

// ✅ Valid base58 CID
'QmYwAPJzv5CZsnAzt8auVZRn'

// ✅ Valid base32 CID
'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
```

### URL Parsing

The SDK can extract CIDs from URLs:

```typescript
import { formatCiphertextPointer } from 'irsb';

formatCiphertextPointer('ipfs://QmTest123456789');
// → 'QmTest123456789'

formatCiphertextPointer('https://ipfs.io/ipfs/QmTest123456789');
// → 'QmTest123456789'
```

## Lit Protocol Integration (Optional)

For **SEMI_PUBLIC** and **PRIVATE** receipts, IRSB integrates with [Lit Protocol](https://litprotocol.com/) for encryption and access control.

### Access Control Conditions

Define who can decrypt:

```typescript
import { createReceiptAccessConditions } from 'irsb';

// Create conditions allowing solver, client, or arbitrator
const conditions = createReceiptAccessConditions(
  'sepolia',
  solverAddress,
  clientAddress,
  arbitratorAddress
);
```

### Common Condition Patterns

```typescript
// Token gate: Must hold NFT
createNFTOwnershipCondition('sepolia', nftContract);

// Token balance: Must hold 100 USDC
createTokenBalanceCondition('sepolia', usdcAddress, '100000000');

// ETH balance: Must hold 0.1 ETH
createBalanceCondition('sepolia', '100000000000000000');

// Specific address
createAddressCondition('sepolia', allowedAddress);
```

### Encryption Flow

```typescript
import { encryptWithLit, createPrivacyConfig } from 'irsb';

const config = createPrivacyConfig({
  encrypt: true,
  solverAddress: '0x...',
  clientAddress: '0x...',
  chain: 'sepolia',
});

const encrypted = await encryptWithLit(
  JSON.stringify(sensitiveData),
  config,
  { network: 'datil-test' }
);

// encrypted.ciphertext → Upload to IPFS
// encrypted.dataToEncryptHash → For verification
```

## Evidence in Disputes

### Evidence Bundle Structure

```typescript
interface EvidenceBundle {
  txHash?: string;       // Execution transaction
  blockNumber?: number;  // Block of execution
  chainId?: number;      // Chain where executed
  proofs?: string[];     // Additional proof hashes
  metadata?: {           // Arbitrary context
    timestamps: { ... },
    screenshots: [ ... ],
  };
}
```

### Evidence Commitment

```typescript
import { generateEvidenceCommitment } from 'irsb';

const evidence: EvidenceBundle = {
  txHash: '0x...',
  blockNumber: 12345678,
  chainId: 1,
  proofs: ['0x...', '0x...'],
};

const evidenceHash = generateEvidenceCommitment(evidence);
// → 0x... (32-byte hash)
```

### Dispute Flow with Privacy

```
┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│ Challenger│      │   IRSB    │      │Arbitrator │      │Lit Network│
└─────┬─────┘      └─────┬─────┘      └─────┬─────┘      └─────┬─────┘
      │                  │                  │                  │
      │ 1. Submit evidence hash            │                  │
      │─────────────────>│                  │                  │
      │                  │                  │                  │
      │                  │ 2. Notify dispute│                  │
      │                  │─────────────────>│                  │
      │                  │                  │                  │
      │                  │                  │ 3. Decrypt via Lit
      │                  │                  │─────────────────>│
      │                  │                  │<─────────────────│
      │                  │                  │  (direct access) │
      │                  │ 4. Resolve with evidence           │
      │                  │<─────────────────│                  │
      │                  │                  │                  │
```

**Note:** The arbitrator decrypts data directly from Lit Network using their authorized
address. No solver involvement is needed - access is granted by Lit's on-chain condition
verification.

## Security Considerations

### Replay Protection

Every commitment includes:
- **Nonce**: Random 32-byte value
- **Timestamp**: Creation time
- **Version**: Schema version

This prevents commitment reuse across receipts.

### Commitment Binding

The `metadataCommitment` is bound to the receipt through:
- Inclusion in EIP-712 signed data
- Dual attestation (solver + client)
- Unique receipt ID derivation

### Access Control Verification

Lit Protocol verifies conditions on-chain before decryption:
1. User signs authentication message
2. Lit nodes check on-chain conditions
3. If conditions met, decryption key released
4. Client decrypts locally

### No Plaintext Leakage

IRSB contracts **never** emit plaintext in events:
- ❌ `event OrderCreated(string details)`
- ✅ `event ReceiptV2Posted(bytes32 commitment, string pointer)`

## Best Practices

### 1. Use Appropriate Privacy Level

| Use Case | Level | Reason |
|----------|-------|--------|
| Public API pricing | PUBLIC | No sensitive data |
| Standard transactions | SEMI_PUBLIC | Gated access |
| Confidential orders | PRIVATE | Full encryption |

### 2. Store Canonical Payload

Always store `canonicalPayload` alongside the commitment for verification:

```typescript
const result = generateMetadataCommitment(data);

// Store both
await storage.save({
  commitment: result.commitment,
  payload: result.canonicalPayload,
});
```

### 3. Validate Before Upload

```typescript
import { validatePointer } from 'irsb';

const validation = validatePointer(cid);
if (!validation.isValid) {
  throw new Error(validation.error);
}
```

### 4. Use Deterministic Hashing

For any hash that goes on-chain, use the SDK helpers:

```typescript
import { combineHashes, structHash } from 'irsb';

// Combine multiple hashes
const combined = combineHashes(hash1, hash2, hash3);

// Create struct hash with types
const hash = structHash(
  ['address', 'uint256', 'bytes32'],
  [address, amount, data]
);
```

## SDK Reference

### Commitment Functions

| Function | Description |
|----------|-------------|
| `generateMetadataCommitment` | Create commitment from metadata |
| `verifyCommitment` | Verify commitment matches payload |
| `validatePointer` | Check CID format validity |
| `formatCiphertextPointer` | Extract CID from URL |
| `combineHashes` | Combine multiple hashes |
| `structHash` | Create typed struct hash |

### Lit Protocol Functions

| Function | Description |
|----------|-------------|
| `createReceiptAccessConditions` | Conditions for receipt parties |
| `createBalanceCondition` | ETH balance requirement |
| `createTokenBalanceCondition` | ERC-20 balance requirement |
| `createNFTOwnershipCondition` | NFT ownership requirement |
| `encryptWithLit` | Encrypt with Lit Protocol |
| `isLitAvailable` | Check if Lit SDK installed |

## Further Reading

- [EIP-712: Typed Structured Data Hashing](https://eips.ethereum.org/EIPS/eip-712)
- [Lit Protocol Documentation](https://developer.litprotocol.com/)
- [IPFS Content Identifiers](https://docs.ipfs.tech/concepts/content-addressing/)
- [IRSB V2 Receipt Schema](./007-AT-SPEC-irsb-receipt-schema.md)
