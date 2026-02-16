# 023-AA-REPT-phase-4-evidence-bundle

**Phase:** 4 - Evidence Bundle v0
**Status:** Complete
**Date:** 2026-02-05
**PR:** #9

---

## Summary

Implemented a complete evidence bundle system for capturing immutable execution records. Evidence manifests provide cryptographic proof of job execution, including artifact hashes, policy decisions, and solver metadata.

## Deliverables

### New Modules

| File | Purpose |
|------|---------|
| `src/evidence/manifest.ts` | Zod schema for v0.1.0 manifest |
| `src/evidence/manifestHash.ts` | Deterministic SHA-256 manifest hashing |
| `src/evidence/createEvidenceBundle.ts` | Bundle creation with artifact scanning |
| `src/evidence/validateEvidenceBundle.ts` | Bundle validation with integrity checks |
| `src/evidence/index.ts` | Public API re-exports |
| `src/storage/fsSafe.ts` | Atomic writes and path safety utilities |
| `src/utils/mime.ts` | MIME type detection |

### CLI Commands

| Command | Purpose |
|---------|---------|
| `make-evidence <runDir>` | Create evidence bundle for existing run |
| `validate-evidence <path>` | Validate bundle integrity |

### Documentation

- `021-PR-ADDM-phase-4-evidence-bundle-spec.md` - Full specification
- `022-DR-ADDM-phase-4-manifest-hash-determinism.md` - Hash determinism design

## Technical Decisions

### Manifest Hash Determinism

The `createdAt` timestamp is excluded from hash computation to ensure reproducibility. The manifest hash covers:
- manifestVersion, intentId, runId, jobType
- artifacts (sorted by path)
- policyDecision, executionSummary
- solver metadata

### Streaming Hash (Gemini Review)

Following Gemini code review feedback, artifact hashing uses `createReadStream` with async iteration for memory efficiency on large files:

```typescript
async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}
```

### Cross-Platform Path Handling

Uses `path.sep` for path splitting operations per Gemini review.

### Atomic Writes

Evidence files use temp-file-then-rename pattern via `atomicWrite()` to prevent partial writes.

### Path Safety

Validates artifact paths against:
- Path traversal (`..`)
- Absolute paths
- Backslash escapes

## Test Coverage

21 tests in `src/evidence/evidence.test.ts`:
- Manifest creation and structure
- Deterministic hashing (same input → same hash)
- Tamper detection (content/size modifications)
- Path safety validation
- Missing artifact detection
- Validation error reporting

19 tests in `src/storage/fsSafe.test.ts`:
- Path validation
- Safe path joining
- Atomic file writes
- Recursive file listing

## Metrics

| Metric | Value |
|--------|-------|
| Tests Added | 40 |
| Total Tests | 120 |
| Files Changed | 13 |
| Lines Added | 2,009 |
| Gemini Comments Addressed | 6/6 |

## Gemini Review Fixes

| Priority | Issue | Fix |
|----------|-------|-----|
| HIGH | Sync file read for hashing | Streaming with createReadStream |
| HIGH | Sync validation hashing | Async hashFileStream function |
| MEDIUM | Hardcoded "/" path split | Use path.sep |
| MEDIUM | Type assertion in readManifest | Zod schema validation |
| MEDIUM | z.string() for createdAt | z.string().datetime() |
| MEDIUM | "/" split in validateManifestFile | Use path.sep |

## Beads Tasks Closed

- `irsb-solver-0cy.4` - Create evidence manifest schema
- `irsb-solver-0cy.5` - Implement artifact hashing
- `irsb-solver-0cy.6` - Add CLI commands

## Next Steps

- Phase 5: Receipt submission system
- Phase 6: RPC adapter for on-chain submission
- Phase 7: Monitoring and metrics

## Lessons Learned

1. **Streaming vs sync for crypto**: Always use streaming for file hashing to handle arbitrarily large files
2. **Cross-platform paths**: Use `path.sep` for string splitting, `path.join` for construction
3. **Zod validation**: Prefer `.parse()` over type assertions for runtime safety
4. **Gemini code review**: Valuable for catching memory/portability issues

---

*Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>*
