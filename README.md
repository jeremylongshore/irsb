# IRSB Agent Passkey

> **DEPRECATED**: This service has been replaced by **Cloud KMS signing + EIP-7702 delegation** with on-chain caveat enforcers. The agent-passkey service remains functional but is no longer the recommended signing path. See the [migration ADR](https://github.com/intent-solutions-io/irsb-protocol/blob/main/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md) for details.

Policy-gated signing gateway for [IRSB Protocol](https://github.com/intent-solutions-io/irsb-protocol). Threshold signatures via Lit Protocol - no single point of key compromise.

> **Status**: Deprecated — replaced by EIP-7702 delegation. Service is still live on Cloud Run but no longer receives new feature development.

## Overview

IRSB Agent Passkey is the **Identity Plane** for IRSB Protocol agents (solvers, watchtowers). It provides:

- **Threshold Signatures**: PKP keys distributed across Lit Protocol's TEE nodes
- **No Single Point of Compromise**: 2/3 of nodes must agree to sign
- **Typed Actions Only**: No "sign arbitrary digest" API - only IRSB state transitions
- **Policy Enforcement**: Contract allowlists, spend caps, rate limits
- **Deterministic Audit**: Every decision produces verifiable artifacts
- **Crypto-Native**: Decentralized infrastructure, not cloud vendor lock-in

## Migration to EIP-7702 Delegation

As of February 2026, the IRSB ecosystem has moved to **Cloud KMS + EIP-7702 delegation** as the primary signing architecture. Key differences:

| Aspect | Agent Passkey (legacy) | EIP-7702 Delegation (current) |
|--------|------------------------|-------------------------------|
| Signing | 2/3 TEE threshold via Lit Protocol | Cloud KMS direct signing |
| Policy enforcement | Off-chain checks (8 rules) | On-chain caveat enforcers |
| Latency | 1-2s per signature | <100ms (KMS) |
| Verification | Trust agent-passkey service | On-chain, transparent |
| SDK | Lit v8 alpha, type hacks needed | Standard viem/ethers |

For migration details, see: [`protocol/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md`](https://github.com/intent-solutions-io/irsb-protocol/blob/main/000-docs/030-DR-ARCH-eip7702-delegation-architecture.md)

## Why Lit Protocol? (Historical)

> This section documents the original rationale. For new integrations, use Cloud KMS + EIP-7702 delegation instead.

| Feature | Cloud KMS | Lit Protocol |
|---------|-----------|--------------|
| Key custody | Single cloud provider | Distributed across TEE nodes |
| Trust model | Trust Google/AWS/Azure | Threshold (2/3 nodes) |
| Failure mode | Cloud outage = offline | Degraded but functional |
| Crypto credibility | "Enterprise" | Native |
| Programmable | Limited | Lit Actions (JavaScript) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ERC-8004 (Registry Layer)                                      │
│  - Agent identity registry                                      │
│  - Reputation scores                                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ read identity / publish signals
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  IRSB Protocol (Accountability Layer)                           │
│  - Intent receipts, solver bonds, dispute resolution            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ signing requests
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  IRSB Agent Passkey (This Service)                              │
│  - Lit Protocol signing, policy engine, session capabilities    │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lit Protocol Network                                           │
│  - PKP (Programmable Key Pairs)                                 │
│  - Threshold signatures (2/3 nodes)                             │
│  - TEE execution environment                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Typed Actions

The signer only accepts these action types:

```typescript
type IrsbAction =
  | { action: "SUBMIT_RECEIPT"; intentId, receiptHash, evidenceHash }
  | { action: "OPEN_DISPUTE"; receiptId, evidenceHash, reasonCode }
  | { action: "SUBMIT_EVIDENCE"; disputeId, evidenceHash }
```

## Installation

```bash
pnpm install
```

## Development

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint
pnpm lint

# Type check
pnpm typecheck

# Start development server
pnpm dev
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `LOG_LEVEL` | Logging level | `info` |
| `LIT_NETWORK` | Lit network (naga-dev/naga-test/naga) | `naga-dev` |
| `LIT_AUTH_PRIVATE_KEY` | Controller wallet private key (see security note) | Required |
| `LIT_PKP_PUBLIC_KEY` | PKP public key (required for signing; omit to mint new) | - |
| `LIT_SESSION_EXPIRY` | Session TTL in seconds (max 86400) | `3600` |
| `ERC8004_ENABLED` | Enable ERC-8004 integration | `false` |

### Security Notes

**`LIT_AUTH_PRIVATE_KEY`**: This is sensitive cryptographic material. Best practices:
- Use secret management (GCP Secret Manager, AWS Secrets Manager, HashiCorp Vault)
- Never commit to version control
- Use separate keys for dev/staging/prod
- Rotate keys periodically
- Consider using hardware security modules (HSM) for production

**`LIT_PKP_PUBLIC_KEY`**: The uncompressed public key of your PKP (starts with `0x04`). If omitted, the service cannot sign until a PKP is minted and configured.

## API

### POST /v1/sign

Sign an IRSB action.

```json
{
  "requestId": "uuid",
  "agentId": "solver-1",
  "role": "SOLVER",
  "chainId": 1,
  "to": "0x...",
  "action": {
    "action": "SUBMIT_RECEIPT",
    "intentId": "0x...",
    "receiptHash": "0x...",
    "evidenceHash": "0x..."
  },
  "value": "0",
  "expiresAt": 1234567890
}
```

### GET /v1/address

Get the signer's Ethereum address (PKP address).

```json
{
  "address": "0x...",
  "enabled": true,
  "backend": "lit-protocol"
}
```

### GET /health

Health check endpoint.

## Policy Engine

Before signing, every request is checked against:

- **Contract Allowlist**: Is the target contract approved?
- **Method Allowlist**: Is the action type allowed?
- **Spend Cap**: Is the value within budget?
- **Velocity Limit**: Rate limit not exceeded?
- **Expiry**: Request not stale?
- **Replay Protection**: Not a duplicate request?
- **Role Authorization**: Is the role allowed this action?
- **State Transition**: Is the on-chain state valid for this action?

## Security

- Keys are distributed across Lit Protocol's TEE nodes
- 2/3 threshold required for any signature
- All signing decisions logged with deterministic hashes
- Session capabilities have max 24-hour TTL
- Rate limiting prevents abuse

## Lit Protocol Networks

> **Migration Complete**: Moved from Datil (V0) to Naga (V1) networks.
> Datil networks shut down **February 25, 2026**.
> See: https://developer.litprotocol.com/network/migration

### Naga Networks (V1 - Active)

| Network | Use Case | Status |
|---------|----------|--------|
| `naga-dev` | Development | Active (default) |
| `naga-test` | Testnet | Active |
| `naga` | Mainnet | Active |

### Datil Networks (V0 - Deprecated)

| Network | Use Case | Status |
|---------|----------|--------|
| `datil-dev` | Development | Shutdown Feb 25, 2026 |
| `datil-test` | Staging | Shutdown Feb 25, 2026 |
| `datil` | Production | Shutdown Feb 25, 2026 |

## License

MIT
