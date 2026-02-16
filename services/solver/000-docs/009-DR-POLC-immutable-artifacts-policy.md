# Immutable Artifacts Policy

**Document ID:** 009-DR-POLC-immutable-artifacts-policy
**Created:** 2026-02-04
**Timezone:** America/Chicago

---

## Overview

Evidence bundles and receipts are **immutable** once created. This policy ensures auditability and prevents tampering.

---

## Core Principles

### 1. Append-Only Storage

Evidence and receipts are never modified after creation:

```
data/
├── evidence/
│   ├── run-abc123/        # Immutable
│   │   ├── manifest.json
│   │   └── artifacts/
│   └── run-def456/        # Immutable
└── receipts.jsonl         # Append-only
```

### 2. No Deletions

- Evidence is never deleted during normal operation
- Receipts are never removed from the log
- Retention policies may archive but not destroy

### 3. Corrections via New Records

If an error is discovered:
- Do **not** modify the original receipt
- Create a new receipt that references the original
- Include correction reason in the new receipt

---

## Immutability Guarantees

| Artifact | Guarantee | Enforcement |
|----------|-----------|-------------|
| Evidence manifest | SHA-256 hash in receipt | Hash verification |
| Evidence artifacts | SHA-256 in manifest | Hash verification |
| Receipts | Append-only log | File permissions, auditing |
| Receipt ID | Deterministic from inputs | Formula-based |

---

## Correction Pattern

When a receipt needs correction:

```json
{
  "receiptId": "new-receipt-id",
  "corrects": "original-receipt-id",
  "correctionReason": "Evidence artifact was corrupted during generation",
  "status": "CORRECTED",
  ...
}
```

The original receipt remains in the log unchanged.

---

## Audit Trail

All operations are logged:

```json
{
  "timestamp": "2026-02-04T12:00:00Z",
  "action": "receipt_created",
  "receiptId": "abc123",
  "intentId": "def456",
  "evidenceManifestSha256": "a1b2c3..."
}
```

---

## Storage Integrity

### Local Storage
- `data/` directory is gitignored
- Backups recommended for production
- File permissions restrict modification

### Future: Remote Storage
- S3/GCS with versioning enabled
- IPFS for content-addressed storage
- Write-once policies where available

---

## Verification

Verify evidence integrity at any time:

```bash
pnpm cli -- validate-evidence ./data/evidence/<runId>/manifest.json
```

This checks:
- Manifest schema validity
- All artifacts exist
- All hashes match

---

## Policy Violations

If immutability is violated:
1. Flag in monitoring/alerting
2. Investigate root cause
3. Create correction receipt if needed
4. Document in incident log

---

*End of Document*
