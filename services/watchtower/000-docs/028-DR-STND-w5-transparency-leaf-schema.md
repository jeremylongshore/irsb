# Transparency Leaf Schema Standard (v0.1.0)

## Overview

Each watchtower risk assessment produces a **transparency leaf** — a signed, deterministically identifiable record appended to an NDJSON log. The log is append-only and daily-partitioned.

## Leaf Fields

```json
{
  "leafVersion": "0.1.0",
  "leafId": "<sha256 hex>",
  "writtenAt": 1700000000,
  "agentId": "erc8004:11155111:0x7177...09A:42",
  "riskReportHash": "<sha256 hex of report>",
  "overallRisk": 75,
  "receiptId": "<optional>",
  "manifestSha256": "<optional>",
  "cardHash": "<optional>",
  "watchtowerSig": "<base64 Ed25519 signature>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| leafVersion | string | yes | Always `"0.1.0"` |
| leafId | string | yes | SHA-256 hex of canonical JSON payload (see below) |
| writtenAt | number | yes | Unix epoch seconds when leaf was created |
| agentId | string | yes | Agent identifier |
| riskReportHash | string | yes | Risk report deterministic ID |
| overallRisk | number | yes | 0–100 risk score |
| receiptId | string | no | Linked receipt ID |
| manifestSha256 | string | no | SHA-256 of evidence manifest |
| cardHash | string | no | SHA-256 of agent card JSON |
| watchtowerSig | string | yes | Ed25519 signature over leafId |

## leafId Computation

```
leafId = sha256Hex(canonicalJson({
  leafVersion,
  agentId,
  riskReportHash,
  overallRisk,
  // optional fields included only if present:
  receiptId?,
  manifestSha256?,
  cardHash?
}))
```

**Excluded**: `writtenAt`, `watchtowerSig`

`canonicalJson` produces sorted-key JSON with no whitespace, ensuring determinism.

## Signature

```
watchtowerSig = base64(ed25519_sign(leafId_utf8_bytes, privateKey))
```

The signature covers the leafId string (UTF-8 encoded), not the full leaf JSON.

## Verification Algorithm

```
1. Reconstruct payload from leaf fields (exclude writtenAt, watchtowerSig)
2. expectedLeafId = sha256Hex(canonicalJson(payload))
3. Assert expectedLeafId === leaf.leafId
4. Assert ed25519_verify(leaf.leafId, leaf.watchtowerSig, publicKey)
```

## Log File Format

- **Filename**: `leaves-YYYY-MM-DD.ndjson`
- **Directory**: Configurable (default: `./data/transparency/`)
- **Encoding**: UTF-8
- **Format**: One JSON object per line (NDJSON)
- **Append-only**: Lines are never modified or deleted

## Public Key Distribution

The watchtower operator publishes their Ed25519 public key (base64-encoded SPKI DER). Verifiers use this key to check leaf signatures.

```bash
# Operator: generate + publish
wt keygen
wt pubkey > watchtower-pubkey.txt

# Verifier: verify log
wt transparency:verify --public-key "$(cat watchtower-pubkey.txt)" --date 2026-02-06
```
