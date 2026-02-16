# Phase 4 Addendum: Manifest Hash and Determinism

**Document ID:** 022-DR-ADDM-phase-4-manifest-hash-determinism
**Repository:** irsb-solver
**Created:** 2026-02-05
**Status:** Complete

---

## Overview

This document specifies the exact rules for computing manifest hashes and ensuring deterministic evidence bundles across identical runs.

---

## Manifest Hash Computation

### Hash Algorithm

- **Algorithm:** SHA-256
- **Encoding:** Lowercase hexadecimal (64 characters)
- **Input:** Canonical JSON of manifest (with exclusions)

### Fields Excluded from Hash

The `createdAt` field is **excluded** from hash computation:

```typescript
type ManifestForHashing = Omit<EvidenceManifestV0, "createdAt">;
```

**Rationale:** Timestamps vary between runs, but artifact content may be identical. Excluding timestamps allows hash-based comparison of content integrity.

### Hash Implementation

```typescript
function computeManifestHash(manifest: EvidenceManifestV0): string {
  // Remove createdAt
  const { createdAt: _createdAt, ...hashable } = manifest;

  // Serialize with canonical JSON (sorted keys)
  const canonical = canonicalJson(hashable);

  // Compute SHA-256
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
```

---

## Determinism Rules

### Artifact Hashing

Artifact hashes are computed from raw file bytes:

```typescript
function hashFile(filePath: string): string {
  const content = readFileSync(filePath);  // Raw bytes
  return createHash("sha256").update(content).digest("hex");
}
```

### Artifact Ordering

Artifacts are **sorted lexicographically by path** before being added to the manifest:

```typescript
artifacts.sort((a, b) => a.path.localeCompare(b.path));
```

This ensures identical ordering for identical artifact sets.

### Canonical JSON

All JSON serialization uses canonical format:
- Keys sorted alphabetically at all levels
- No extra whitespace
- Consistent string escaping

---

## Determinism Test

Two runs with identical inputs must produce identical `manifestSha256`:

```typescript
// Run 1
const result1 = createEvidenceBundle({ runDir: dir1, ...params });

// Run 2 (clean directory, same content)
const result2 = createEvidenceBundle({ runDir: dir2, ...params });

// These must match
expect(result1.manifestSha256).toBe(result2.manifestSha256);
```

### What Varies (Allowed)

- `createdAt` timestamp
- Manifest file modification time
- Disk location

### What Must Be Stable

- `manifestSha256`
- All artifact hashes
- Artifact order in manifest
- All other manifest fields

---

## Verification Process

### Manual Verification

```bash
# 1. Read manifest (excluding createdAt)
cat manifest.json | jq 'del(.createdAt)' > hashable.json

# 2. Sort keys canonically
# (Use canonical JSON tool or implementation)

# 3. Compute hash
sha256sum hashable.json

# 4. Compare to stored hash
cat manifest.sha256
```

### Programmatic Verification

```bash
pnpm cli -- validate-evidence <runDir>
```

The validator:
1. Parses manifest
2. Validates schema
3. Checks all artifact hashes
4. Reports mismatches

---

## Hash Storage

The computed hash is stored alongside the manifest:

```
evidence/
├── manifest.json      # Full manifest with createdAt
└── manifest.sha256    # Hash of manifest (without createdAt)
```

### manifest.sha256 Format

Plain text file containing only the hex hash and newline:

```
5fb6eee15d584ac7dfead22816c93e7718aaac735b91f514959147729708183f
```

---

## Edge Cases

### Empty Artifacts

If no artifacts exist, the manifest still has valid structure:

```json
{
  "artifacts": [],
  ...
}
```

Hash is computed normally over the empty array.

### Large Files

SHA-256 is computed incrementally; no file size limit.

### Binary Files

Hash computed from raw bytes; no encoding transformation.

---

## Security Properties

| Property | Guarantee |
|----------|-----------|
| Tamper Detection | Any byte change produces different hash |
| Collision Resistance | SHA-256 provides ~128-bit security |
| Reproducibility | Same input → same hash |
| Verifiability | Anyone can recompute and verify |

---

*End of Document*
