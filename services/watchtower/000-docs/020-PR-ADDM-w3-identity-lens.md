# 020-PR-ADDM — W3 Identity Lens Architecture

## Overview

The Identity Lens adds ERC-8004 agent identity discovery, agent card validation, and identity-derived risk signals to the IRSB Watchtower.

## ERC-8004 Integration

- **Registry**: Sepolia `0x7177a6867296406881E20d6647232314736Dd09A`
- **Events**: `Registered(agentId, agentURI, owner)` + `Transfer(from, to, tokenId)` (mint = from 0x0)
- **Agent ID Format**: `erc8004:<chainId>:<registryAddress>:<tokenId>`

## Data Flow

```
1. id:sync — Poll ERC-8004 IdentityRegistry logs
   ChainProvider → IdentityEventSource → identityPoller
   → INSERT OR IGNORE into identity_events
   → Update identity_cursor

2. id:fetch — Fetch agent cards + derive signals + score
   For each discovered tokenId:
     a. Lookup latest agent_uri from identity_events
     b. SSRF-safe fetch of agent card JSON
     c. Validate against AgentCardSchema (Zod)
     d. Store identity_snapshot
     e. Derive identity signals (4 Level 1 signals)
     f. Store watchtower snapshot (signals)
     g. Score agent → risk report + alerts
```

## Reorg Safety

- **Overlap**: Re-polls `cursor - overlapBlocks` on each cycle
- **Confirmations**: Only processes blocks `<= latestBlock - confirmations`
- **Idempotency**: All event inserts use `INSERT OR IGNORE` with deterministic event_id = sha256(chainId + txHash + logIndex)

## SSRF Protections (Non-Negotiable)

| Check | Implementation |
|-------|---------------|
| HTTPS only | `allowHttp` defaults to `false` |
| Private IP block | DNS resolve → reject 10/8, 172.16/12, 192.168/16, 127/8, ::1, fc00::/7, 169.254/16 |
| Scheme block | file:, data:, ftp: rejected |
| Timeout | AbortController, default 5s |
| Body limit | 2MB default, streamed read |
| Redirect control | manual redirect, re-validate each hop, max 3 |
| User-Agent | `irsb-watchtower/0.3.0` |

## Identity Signals (Level 1)

| Signal | Condition | Severity | Weight |
|--------|-----------|----------|--------|
| `ID_NEWBORN` | Registration age < 14 days | MEDIUM | 0.3 |
| `ID_CARD_UNREACHABLE` | Fetch fails (UNREACHABLE/TIMEOUT/SSRF_BLOCKED) | HIGH | 0.8 |
| `ID_CARD_SCHEMA_INVALID` | Card JSON fails Zod validation | HIGH | 0.8 |
| `ID_CARD_CHURN` | >2 distinct card hashes in 7 days | MEDIUM | 0.5 |

## SQLite Schema (Migration 002)

- `identity_cursor` — per-registry block cursor
- `identity_events` — decoded ERC-8004 events
- `identity_snapshots` — agent card fetch results with card_hash

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `chainId` | — | Target chain ID |
| `registryAddress` | — | ERC-8004 registry contract |
| `startBlock` | 0 | First block to poll |
| `batchSize` | 10000 | Blocks per poll cycle |
| `confirmations` | 12 | Block confirmation depth |
| `overlapBlocks` | 50 | Reorg safety overlap |
| `fetchTimeoutMs` | 5000 | Card fetch timeout |
| `maxCardBytes` | 2MB | Max card body size |
| `allowHttp` | false | Allow HTTP card URIs |
| `maxRedirects` | 3 | Max redirect hops |
| `churnWindowSeconds` | 604800 | Churn detection window (7d) |
| `churnThreshold` | 3 | Distinct hashes to trigger churn |
| `newbornAgeSeconds` | 1209600 | Newborn threshold (14d) |

## Not in Level 1

- Sybil clustering
- Global trust anchors
- Endpoint blocklists
- Multi-registry support
- Cross-chain identity correlation
