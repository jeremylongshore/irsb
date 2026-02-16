# W5: Watchtower API + Alerting + Signed Transparency Log

## Purpose

Expose watchtower data over HTTP and produce a verifiable, append-only transparency log of every risk assessment. Consumers can independently verify that the watchtower has not silently altered past risk scores.

## Architecture

```
watchtower-core
├── signing/       Ed25519 keypair, report signing, data signing
├── transparency/  Leaf creation, NDJSON log, verification
└── (existing)     schemas, scoring, storage, identity, context, behavior

watchtower-api     Fastify HTTP server wrapping watchtower-core
├── GET /healthz
├── GET /v1/agents/:agentId/risk
├── GET /v1/agents/:agentId/alerts
├── POST /v1/receipts/ingest
├── GET /v1/transparency/leaves?date=YYYY-MM-DD
└── GET /v1/transparency/verify?date=YYYY-MM-DD

watchtower-cli     5 new commands
├── wt keygen
├── wt pubkey
├── wt verify-report
├── wt transparency:append
└── wt transparency:verify
```

## Signing Module

- Ed25519 via Node.js `crypto` (zero external dependencies)
- Key format: `WatchtowerKeyPair { publicKey: base64(SPKI DER), privateKey: base64(PKCS8 DER) }`
- Report signing: `signReport(report, kp)` signs `canonicalJson({agentId, generatedAt, reportVersion, riskReportHash})`
- Generic signing: `signData(data, kp)` / `verifyData(data, sig, publicKey)` for transparency leaves

## Transparency Log

### Leaf Schema (v0.1.0)

| Field | Type | Notes |
|-------|------|-------|
| leafVersion | `'0.1.0'` | Schema version |
| leafId | string | `sha256(canonicalJson(payload))` excluding `writtenAt` and `watchtowerSig` |
| writtenAt | number | Unix epoch seconds |
| agentId | string | Agent identifier |
| riskReportHash | string | Report ID (deterministic hash) |
| overallRisk | number | 0–100 |
| receiptId? | string | Optional receipt reference |
| manifestSha256? | string | Optional manifest hash |
| cardHash? | string | Optional agent card hash |
| watchtowerSig | string | Ed25519 signature over leafId |

### Integrity Properties

1. **Deterministic leafId**: Same inputs always produce same leafId (writtenAt and sig excluded)
2. **Signed**: Each leaf is Ed25519-signed over its leafId
3. **Append-only**: NDJSON files are append-only, never rewritten
4. **Daily partitioned**: `leaves-YYYY-MM-DD.ndjson` files
5. **Independently verifiable**: Anyone with the public key can verify

### Verification

`verifyLeaf(leaf, publicKey)`:
1. Recompute leafId from content (excluding writtenAt + watchtowerSig)
2. Compare recomputed leafId against stored leafId
3. Verify Ed25519 signature over leafId with public key

## HTTP API

### Authentication

Optional API key via `x-watchtower-key` header. Set `WATCHTOWER_API_KEY` env to enable.

### Configuration

| Env | Default | Description |
|-----|---------|-------------|
| `WATCHTOWER_API_PORT` | 3100 | HTTP port |
| `WATCHTOWER_API_HOST` | 127.0.0.1 | Bind address |
| `WATCHTOWER_DB_PATH` | ./data/watchtower.db | SQLite path |
| `WATCHTOWER_KEY_PATH` | ./data/watchtower-key.json | Keypair path |
| `WATCHTOWER_LOG_DIR` | ./data/transparency | Log directory |
| `WATCHTOWER_API_KEY` | (unset) | Optional API key |

## Signal Summary (all lenses)

| Lens | Signals | Implemented |
|------|---------|-------------|
| Behavior | 5 (BEH_*) | W2 |
| Identity | 4 (ID_*) | W3 |
| Context | 6 (CX_*) | W4 |
| **Total** | **15** | W2–W4 |
