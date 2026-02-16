# 041-AT-SPEC: Canonical Intent Envelope v1

> **Status:** Draft
> **Author:** Jeremy Longshore
> **Date:** 2026-02-15
> **Beads:** `irsb-upx.1`
> **Implements:** Phase 1 of Intentions Gateway architecture (040-AT-ARCH)

---

## 1. Purpose

The Canonical Intent Envelope (CIE) is the **universal data structure** through which every AI agent action — whether a Web2 MCP tool call or a Web3 blockchain transaction — enters the Intentions Gateway. It provides:

1. **Deterministic identity** — same logical action always produces the same `intentId`
2. **Cryptographic accountability** — multi-party signatures bind agent, gateway, and (optionally) user
3. **Domain bridging** — a single `intentId` links Web2 DecisionRecords to Web3 IntentReceipts
4. **Forward compatibility** — versioned structure with typed extension data

---

## 2. Design Constraints

These constraints are non-negotiable, derived from existing IRSB infrastructure:

| Constraint | Source | Implication |
|------------|--------|-------------|
| `intentHash` is `bytes32` on-chain | `Types.sol`, `TypesV2.sol` | `intentId` must be a `bytes32` (Keccak-256) |
| On-chain uses Keccak-256 + ABI encoding | `IntentReceiptHub.sol` | On-chain hashing must use `abi.encode` not canonical JSON |
| Off-chain uses SHA-256 + canonical JSON | solver `canonicalJson.ts` | Off-chain evidence hashing continues using SHA-256 |
| EIP-712 typed data for V2 receipts | `EIP712ReceiptV2.sol` | Envelope signing must use EIP-712 |
| Cloud KMS signs via ECDSA secp256k1 | solver/watchtower signing | Signatures are standard Ethereum ECDSA |
| Existing `computeReceiptId` uses 3 fields | `Types.sol` | Envelope `intentId` maps to receipt `intentHash` |
| Enforcers validate per-call constraints | `ICaveatEnforcer.sol` | Envelope must carry enough data for enforcer evaluation |

---

## 3. Envelope Structure

### 3.1 EIP-712 TypedData Definition

```solidity
// SPDX-License-Identifier: MIT
// Canonical Intent Envelope v1

bytes32 constant CIE_TYPEHASH = keccak256(
    "CanonicalIntentEnvelope("
    "uint8 version,"
    "bytes32 tenantId,"
    "address agentAddress,"
    "uint256 agentId,"
    "uint8 domain,"
    "bytes32 actionHash,"
    "bytes32 constraintsHash,"
    "uint256 nonce,"
    "uint64 timestamp,"
    "uint64 expiry,"
    "bytes32 extensionHash"
    ")"
);
```

### 3.2 Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `version` | `uint8` | Envelope version. `1` for this spec. |
| `tenantId` | `bytes32` | Tenant isolation key. `keccak256(tenantName)` for on-chain, raw string off-chain. |
| `agentAddress` | `address` | Agent's Ethereum address (wallet that will sign or delegate). |
| `agentId` | `uint256` | ERC-8004 agent identity NFT token ID. `0` if unregistered. |
| `domain` | `uint8` | Execution domain: `0` = WEB2, `1` = WEB3, `2` = HYBRID. |
| `actionHash` | `bytes32` | `keccak256` of the action payload (see 3.3). |
| `constraintsHash` | `bytes32` | `keccak256` of the policy constraints applied (see 3.4). |
| `nonce` | `uint256` | Monotonically increasing per-agent nonce. Prevents replay. |
| `timestamp` | `uint64` | Envelope creation time (Unix seconds). |
| `expiry` | `uint64` | Envelope expiry (Unix seconds). `0` = no expiry. |
| `extensionHash` | `bytes32` | `keccak256` of version-specific extension data. `bytes32(0)` if no extensions. |

### 3.3 Action Payload (Off-Chain, Hashed into `actionHash`)

The action payload is the full description of what the agent wants to do. It is **not stored on-chain** — only its hash is.

**Web2 Action:**
```typescript
interface Web2Action {
  type: "WEB2";
  method: string;        // e.g., "tools/call"
  server: string;        // MCP server identifier
  tool: string;          // Tool name
  arguments: unknown;    // Tool arguments (canonical JSON for hashing)
}
```

**Web3 Action:**
```typescript
interface Web3Action {
  type: "WEB3";
  chainId: number;
  target: string;        // Contract address (0x...)
  callData: string;      // ABI-encoded function call (0x...)
  value: string;         // Wei value as decimal string
}
```

**Hybrid Action:**
```typescript
interface HybridAction {
  type: "HYBRID";
  steps: Array<Web2Action | Web3Action>;  // Ordered execution DAG
}
```

**Hashing rule:**
```
actionHash = keccak256(abi.encode(
  keccak256(bytes(canonicalJson(actionPayload)))
))
```

The double-hash (canonical JSON then Keccak-256 of ABI-encoded result) bridges off-chain determinism (canonical JSON) with on-chain compatibility (Keccak-256). The inner `keccak256(bytes(...))` handles the dynamic-length string per EIP-712 convention.

### 3.4 Constraints Payload (Off-Chain, Hashed into `constraintsHash`)

```typescript
interface EnvelopeConstraints {
  maxSpendWei?: string;         // Max ETH spend (decimal Wei)
  maxSpendToken?: {             // Max ERC-20 spend
    token: string;              // Token address
    amount: string;             // Amount in token units
  };
  allowedTargets?: string[];    // Contract address whitelist
  allowedMethods?: string[];    // Function selector whitelist (4-byte hex)
  timeWindow?: {
    notBefore: number;          // Unix seconds
    notAfter: number;           // Unix seconds
  };
  requiredApprovals?: number;   // Minimum co-signatures required (0 = none)
}
```

**Hashing rule:** Same as actionHash — `keccak256(abi.encode(keccak256(bytes(canonicalJson(constraints)))))`.

**Compatibility:** These constraints map directly to existing IRSB enforcers:
| Constraint field | IRSB Enforcer |
|------------------|---------------|
| `maxSpendWei` / `maxSpendToken` | `SpendLimitEnforcer` |
| `timeWindow` | `TimeWindowEnforcer` |
| `allowedTargets` | `AllowedTargetsEnforcer` |
| `allowedMethods` | `AllowedMethodsEnforcer` |
| `nonce` (on envelope itself) | `NonceEnforcer` |

### 3.5 Extension Data (Version-Specific)

Extensions allow future versions to add fields without breaking the core hash. For v1, extension data is optional.

```typescript
interface EnvelopeExtensionsV1 {
  parentIntentId?: string;       // For chained intents (bytes32 hex)
  delegationHash?: string;       // WalletDelegate delegation hash if using delegated execution
  x402PaymentHash?: string;      // x402 payment hash if this is a paid action
  metadata?: Record<string, string>;  // Arbitrary key-value metadata
}
```

**Hashing rule:** If no extensions, `extensionHash = bytes32(0)`. Otherwise: `keccak256(abi.encode(keccak256(bytes(canonicalJson(extensions)))))`.

---

## 4. `intentId` Computation

The `intentId` is the **unique identity** of an intent across the entire system.

### 4.1 Formula

```
intentId = keccak256(abi.encode(
    CIE_TYPEHASH,
    envelope.version,
    envelope.tenantId,
    envelope.agentAddress,
    envelope.agentId,
    envelope.domain,
    envelope.actionHash,
    envelope.constraintsHash,
    envelope.nonce,
    envelope.timestamp,
    envelope.expiry,
    envelope.extensionHash
))
```

This is the **EIP-712 struct hash** of the envelope — the same value used in EIP-712 signature computation. This means `intentId` is derivable from the signed data, never a separate computation.

### 4.2 Properties

| Property | Guarantee |
|----------|-----------|
| **Deterministic** | Same logical intent always produces the same `intentId` |
| **Collision-resistant** | Keccak-256 over 12 fields including nonce and timestamp |
| **Replay-safe** | Per-agent nonce prevents reuse across sessions |
| **Cross-domain** | Same `intentId` used in Web2 DecisionRecords and Web3 IntentReceipts |
| **EIP-712 native** | Is literally the EIP-712 struct hash — no separate ID computation needed |
| **On-chain compatible** | `bytes32` maps directly to `IntentReceipt.intentHash` and `IntentReceiptV2.intentHash` |

### 4.3 Mapping to Existing IRSB Fields

```
Canonical Intent Envelope          IRSB IntentReceipt (on-chain)
─────────────────────────          ──────────────────────────────
intentId (struct hash)      →      intentHash
constraintsHash             →      constraintsHash
actionHash                  →      routeHash (reinterpreted)
extensionHash               →      outcomeHash (post-execution)
(off-chain evidence)        →      evidenceHash
timestamp                   →      createdAt
expiry                      →      expiry
(from tenant config)        →      solverId
```

**Key mapping decisions:**
- `routeHash` in existing receipts maps to the envelope's `actionHash` (what was requested)
- `outcomeHash` is populated **after execution** with the actual result hash
- `evidenceHash` is populated with the off-chain evidence bundle hash (unchanged from current flow)
- `solverId` comes from tenant configuration, not the envelope itself

---

## 5. Signature Model

### 5.1 EIP-712 Domain

```solidity
bytes32 constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

// Domain parameters
string constant DOMAIN_NAME = "IRSB Intentions Gateway";
string constant DOMAIN_VERSION = "1";
// chainId = deployment chain (Sepolia: 11155111)
// verifyingContract = gateway contract address (or gateway service address for off-chain)
```

**Note:** This is a **third** EIP-712 domain alongside the existing `"IRSB Protocol"` (v2) and `"IRSB WalletDelegate"` (v1). Each domain is scoped to its service — signatures from one domain cannot be replayed in another.

### 5.2 Three Signature Roles

| Signature | Signer | When | Required | Purpose |
|-----------|--------|------|----------|---------|
| **AgentSig** | Agent wallet (via Cloud KMS or local key) | Before gateway evaluation | Yes | Agent authorizes the action |
| **GatewaySig** | Gateway service (dedicated KMS key) | After Cedar policy evaluation | Yes | Gateway attests to policy decision |
| **UserSig** | Human user wallet | Before execution (high-value only) | No | User co-authorizes high-value actions |

### 5.3 Signature Computation

Each signature covers the **EIP-712 typed data hash**:

```
digest = keccak256("\x19\x01" || domainSeparator || structHash)
```

Where `structHash` = `intentId` (the CIE struct hash from Section 4.1).

**AgentSig** signs the digest with the agent's key:
```typescript
agentSig = sign(agentKey, digest)  // 65 bytes: r(32) + s(32) + v(1)
```

**GatewaySig** signs an **extended digest** that includes the policy decision:

```solidity
bytes32 constant GATEWAY_DECISION_TYPEHASH = keccak256(
    "GatewayDecision("
    "bytes32 intentId,"
    "uint8 decision,"
    "bytes32 obligationsHash,"
    "bytes32 policyVersion,"
    "uint64 decidedAt"
    ")"
);
```

| Field | Type | Description |
|-------|------|-------------|
| `intentId` | `bytes32` | The envelope's struct hash |
| `decision` | `uint8` | `0` = DENY, `1` = ALLOW, `2` = ALLOW_WITH_CONDITIONS |
| `obligationsHash` | `bytes32` | Hash of obligations/conditions attached to ALLOW_WITH_CONDITIONS |
| `policyVersion` | `bytes32` | Hash of the Cedar policy set version used for evaluation |
| `decidedAt` | `uint64` | Decision timestamp (Unix seconds) |

```
gatewayDigest = keccak256("\x19\x01" || domainSeparator || keccak256(abi.encode(
    GATEWAY_DECISION_TYPEHASH,
    intentId,
    decision,
    obligationsHash,
    policyVersion,
    decidedAt
)))
gatewaySig = sign(gatewayKey, gatewayDigest)
```

**UserSig** signs the same `digest` as AgentSig (the envelope itself):
```typescript
userSig = sign(userKey, digest)  // Same digest, different signer
```

### 5.4 Verification Flow

```
1. Recover agentAddress from AgentSig + digest
2. Verify agentAddress matches envelope.agentAddress
3. Recover gatewayAddress from GatewaySig + gatewayDigest
4. Verify gatewayAddress is a known gateway signer
5. Verify decision == ALLOW or ALLOW_WITH_CONDITIONS
6. If UserSig present:
   a. Recover userAddress from UserSig + digest
   b. Verify userAddress is authorized for this tenant
7. Verify envelope.nonce > lastNonce[agentAddress]
8. Verify envelope.expiry == 0 || block.timestamp < envelope.expiry
```

---

## 6. Signed Envelope (Wire Format)

The complete signed envelope transmitted between services:

```typescript
interface SignedCanonicalIntentEnvelope {
  // === Envelope (EIP-712 struct fields) ===
  envelope: {
    version: 1;
    tenantId: string;          // bytes32 hex
    agentAddress: string;      // 0x address
    agentId: number;           // uint256
    domain: 0 | 1 | 2;        // WEB2 | WEB3 | HYBRID
    actionHash: string;        // bytes32 hex
    constraintsHash: string;   // bytes32 hex
    nonce: number;             // uint256
    timestamp: number;         // uint64 unix seconds
    expiry: number;            // uint64 unix seconds (0 = no expiry)
    extensionHash: string;     // bytes32 hex
  };

  // === Unhashed Payloads (for downstream processing) ===
  action: Web2Action | Web3Action | HybridAction;
  constraints: EnvelopeConstraints;
  extensions?: EnvelopeExtensionsV1;

  // === Computed Identity ===
  intentId: string;            // bytes32 hex (EIP-712 struct hash)

  // === Signatures ===
  agentSig: string;            // 65-byte hex (r + s + v)
  gatewayDecision?: {
    decision: "DENY" | "ALLOW" | "ALLOW_WITH_CONDITIONS";
    obligations?: unknown;     // Conditions for ALLOW_WITH_CONDITIONS
    policyVersion: string;     // bytes32 hex
    decidedAt: number;         // uint64 unix seconds
    gatewaySig: string;        // 65-byte hex
  };
  userSig?: string;            // 65-byte hex (optional co-sign)
}
```

### 6.1 Lifecycle States

```
                    ┌────────────────────┐
                    │   UNSIGNED          │  Agent constructs envelope
                    │   (no signatures)   │  with action + constraints
                    └─────────┬──────────┘
                              │ agent signs
                              ▼
                    ┌────────────────────┐
                    │   AGENT_SIGNED      │  agentSig present
                    │                     │  Ready for gateway evaluation
                    └─────────┬──────────┘
                              │ Cedar evaluates
                              ▼
                    ┌────────────────────┐
               ┌────│   DECIDED           │  gatewayDecision present
               │    │   (ALLOW or DENY)   │
               │    └─────────┬──────────┘
               │              │ if ALLOW
          DENY │              ▼
               │    ┌────────────────────┐
               │    │   AUTHORIZED        │  Ready for execution
               │    │   (+ optional       │  (userSig if high-value)
               │    │    userSig)         │
               │    └─────────┬──────────┘
               │              │ execute
               │              ▼
               │    ┌────────────────────┐
               │    │   EXECUTED          │  Execution complete
               │    │   (Web2 or Web3)    │  Receipt generation begins
               │    └─────────┬──────────┘
               │              │
               │              ▼
               │    ┌────────────────────┐
               └───►│   RECEIPTED         │  DecisionRecord (Web2) and/or
                    │                     │  IntentReceipt (Web3) posted
                    └────────────────────┘
```

---

## 7. Canonical JSON Serialization (Off-Chain)

For off-chain storage (DecisionRecords, evidence bundles, audit vault), the envelope is serialized using the existing IRSB canonical JSON rules:

1. Object keys sorted lexicographically at every level
2. Array order preserved
3. No whitespace
4. `null` preserved, `undefined` dropped
5. Numbers as JSON numbers (not strings), except addresses and hashes which are lowercase hex strings

**Off-chain hash** (for evidence and audit trails):
```
envelopeSha256 = sha256(canonicalJson(signedEnvelope))
```

This SHA-256 hash is used in off-chain systems (DecisionRecords, evidence bundles). The on-chain `intentId` (Keccak-256 EIP-712 struct hash) is used on-chain.

**Mapping:**
```
Off-chain: envelopeSha256 (SHA-256 of canonical JSON) → DecisionRecord, evidence
On-chain:  intentId (Keccak-256 EIP-712 struct hash)  → IntentReceipt.intentHash
Bridge:    Both reference the same logical intent via intentId stored in both
```

---

## 8. Zod Schema (TypeScript Reference Implementation)

```typescript
import { z } from "zod";

const bytes32Hex = z.string().regex(/^0x[0-9a-f]{64}$/);
const addressHex = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const Web2ActionSchema = z.object({
  type: z.literal("WEB2"),
  method: z.string(),
  server: z.string(),
  tool: z.string(),
  arguments: z.unknown(),
});

export const Web3ActionSchema = z.object({
  type: z.literal("WEB3"),
  chainId: z.number().int().positive(),
  target: addressHex,
  callData: z.string().startsWith("0x"),
  value: z.string().regex(/^\d+$/),
});

export const HybridActionSchema = z.object({
  type: z.literal("HYBRID"),
  steps: z.array(z.union([Web2ActionSchema, Web3ActionSchema])).min(1),
});

export const ActionSchema = z.discriminatedUnion("type", [
  Web2ActionSchema,
  Web3ActionSchema,
  HybridActionSchema,
]);

export const EnvelopeConstraintsSchema = z.object({
  maxSpendWei: z.string().regex(/^\d+$/).optional(),
  maxSpendToken: z.object({
    token: addressHex,
    amount: z.string().regex(/^\d+$/),
  }).optional(),
  allowedTargets: z.array(addressHex).optional(),
  allowedMethods: z.array(z.string().regex(/^0x[0-9a-f]{8}$/)).optional(),
  timeWindow: z.object({
    notBefore: z.number().int().nonnegative(),
    notAfter: z.number().int().positive(),
  }).optional(),
  requiredApprovals: z.number().int().nonnegative().optional(),
});

export const EnvelopeExtensionsV1Schema = z.object({
  parentIntentId: bytes32Hex.optional(),
  delegationHash: bytes32Hex.optional(),
  x402PaymentHash: bytes32Hex.optional(),
  metadata: z.record(z.string()).optional(),
});

export const CanonicalIntentEnvelopeSchema = z.object({
  version: z.literal(1),
  tenantId: bytes32Hex,
  agentAddress: addressHex,
  agentId: z.number().int().nonnegative(),
  domain: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  actionHash: bytes32Hex,
  constraintsHash: bytes32Hex,
  nonce: z.number().int().nonnegative(),
  timestamp: z.number().int().positive(),
  expiry: z.number().int().nonnegative(),
  extensionHash: bytes32Hex,
});

export const GatewayDecisionSchema = z.object({
  decision: z.enum(["DENY", "ALLOW", "ALLOW_WITH_CONDITIONS"]),
  obligations: z.unknown().optional(),
  policyVersion: bytes32Hex,
  decidedAt: z.number().int().positive(),
  gatewaySig: z.string().regex(/^0x[0-9a-f]{130}$/),
});

export const SignedCanonicalIntentEnvelopeSchema = z.object({
  envelope: CanonicalIntentEnvelopeSchema,
  action: ActionSchema,
  constraints: EnvelopeConstraintsSchema,
  extensions: EnvelopeExtensionsV1Schema.optional(),
  intentId: bytes32Hex,
  agentSig: z.string().regex(/^0x[0-9a-f]{130}$/),
  gatewayDecision: GatewayDecisionSchema.optional(),
  userSig: z.string().regex(/^0x[0-9a-f]{130}$/).optional(),
});

export type CanonicalIntentEnvelope = z.infer<typeof CanonicalIntentEnvelopeSchema>;
export type SignedCanonicalIntentEnvelope = z.infer<typeof SignedCanonicalIntentEnvelopeSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type EnvelopeConstraints = z.infer<typeof EnvelopeConstraintsSchema>;
export type GatewayDecision = z.infer<typeof GatewayDecisionSchema>;
```

---

## 9. Security Properties

| Property | Mechanism |
|----------|-----------|
| **Replay prevention** | Per-agent monotonic nonce + expiry timestamp |
| **Cross-domain isolation** | Separate EIP-712 domains for gateway, protocol, and delegation |
| **Tenant isolation** | `tenantId` in envelope prevents cross-tenant intent injection |
| **Signature binding** | AgentSig covers all fields including actionHash and constraintsHash |
| **Decision binding** | GatewaySig covers intentId + decision + policyVersion |
| **Tamper detection** | Any field change invalidates intentId (struct hash) and all signatures |
| **Forward compatibility** | `extensionHash` allows adding fields without changing core hash |
| **No arbitrary signing** | Gateway only signs ALLOW/DENY decisions, never raw digests |

---

## 10. Test Requirements

### 10.1 Property Tests (fast-check)

| Test | Property |
|------|----------|
| `intentId` stability | Same envelope fields always produce the same `intentId` |
| Field ordering | Canonical JSON key order does not affect `actionHash` |
| Nonce uniqueness | Different nonces produce different `intentId` values |
| Signature roundtrip | Sign → recover → match for all three sig types |
| Domain separation | Same struct, different domain → different digest |

### 10.2 Fuzz Tests

| Test | Input |
|------|-------|
| Malformed envelope | Random bytes in each field position |
| Oversized action | Action payload > 1MB |
| Boundary timestamps | `timestamp = 0`, `expiry = MAX_UINT64`, `expiry < timestamp` |
| Zero nonce | `nonce = 0` (valid for first intent) |
| Empty constraints | `constraintsHash = keccak256(abi.encode(keccak256(bytes("{}"))))` |

### 10.3 Compatibility Tests

| Test | Verification |
|------|-------------|
| `intentId` as `intentHash` | Envelope `intentId` accepted by `IntentReceiptHub.postReceipt()` |
| `constraintsHash` compatible | Envelope `constraintsHash` matches receipt `constraintsHash` |
| EIP-712 recovery | `ecrecover` on Solidity side recovers same address as TypeScript `verifyTypedData` |
| Canonical JSON determinism | TypeScript `canonicalJson` matches Go/Python/Rust implementations |

---

## 11. Migration Path

### 11.1 Existing IRSB Flows (No Change)

Solver and watchtower continue using their current receipt/evidence flows. The Canonical Intent Envelope is **additive** — it does not replace existing flows.

### 11.2 New Gateway Flows

```
Agent → Intentions Gateway → CIE constructed → Cedar evaluates → Execute → Receipt

Web2 path: CIE.intentId → DecisionRecord.intentId + ExecutionReceipt.intentId
Web3 path: CIE.intentId → IntentReceipt.intentHash (existing contract)
Hybrid:    CIE.intentId → both DecisionRecord and IntentReceipt
```

### 11.3 Solver Integration (Future)

When solver integrates with the gateway, the flow becomes:
```
Agent → Gateway → CIE → Cedar ALLOW → Solver executes → Receipt with CIE.intentId as intentHash
```

The solver receives the signed envelope and uses `intentId` as `intentHash` when posting receipts. No contract changes needed.

---

## 12. Open Questions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Should `tenantId` be in the EIP-712 domain instead of the struct? | Domain field vs struct field | Struct field — allows same domain separator across tenants, simpler key management |
| 2 | Should `actionHash` use `keccak256(canonicalJson)` or `keccak256(abi.encode)`? | JSON-hash vs ABI-hash | JSON-hash wrapped in ABI-encode — preserves off-chain determinism while being on-chain compatible |
| 3 | Max envelope size for Cloud Tasks? | 100KB vs 1MB | 100KB — action payloads > 100KB should use content-addressed storage with hash reference |
| 4 | Should the gateway contract be deployed on-chain for signature verification? | On-chain verifier vs off-chain only | Off-chain first — deploy on-chain verifier in Phase 4 when Web3 bridge needs it |
