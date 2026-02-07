# IRSB Agent Passkey

Policy-gated signing gateway for [IRSB Protocol](https://github.com/intent-solutions-io/irsb-protocol). Non-extractable KMS-backed keys with typed action enforcement.

## Overview

IRSB Agent Passkey is the **Identity Plane** for IRSB Protocol agents (solvers, watchtowers). It provides:

- **Non-extractable Keys**: Private keys never leave GCP Cloud KMS
- **Typed Actions Only**: No "sign arbitrary digest" API - only IRSB state transitions
- **Policy Enforcement**: Contract allowlists, spend caps, rate limits
- **Deterministic Audit**: Every decision produces verifiable artifacts
- **Session Capabilities**: Short-lived, scoped tokens for agent operations

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
│  - KMS signing, policy engine, session capabilities             │
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
| `KMS_PROJECT_ID` | GCP project for KMS | Required |
| `KMS_LOCATION` | KMS key location | Required |
| `KMS_KEY_RING` | KMS key ring name | Required |
| `KMS_KEY_NAME` | KMS key name | Required |
| `ERC8004_ENABLED` | Enable ERC-8004 integration | `false` |

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

Get the signer's Ethereum address.

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

- Keys are stored in GCP Cloud KMS (HSM-backed)
- All signing decisions are logged with deterministic hashes
- Session capabilities have max 24-hour TTL
- Rate limiting prevents abuse

## License

MIT
