# 022-AA-REPT — W3 Identity Lens After-Action Report

**Date**: 2026-02-06 00:49 CST
**Branch**: `feature/w3-identity-lens`
**PR**: https://github.com/intent-solutions-io/irsb-watchtower/pull/12

## What Was Delivered

W3 adds the **Identity Lens** to the IRSB Watchtower:

1. **ERC-8004 Discovery** — Reorg-safe log poller for IdentityRegistry events (Registered + mint Transfer)
2. **SSRF-Safe Agent Card Fetcher** — DNS validation, private IP blocking, redirect re-validation, body limits
3. **Agent Card Validation** — Zod schema matching ERC-8004 AgentRegistration spec
4. **4 Identity Signals** — ID_NEWBORN, ID_CARD_UNREACHABLE, ID_CARD_SCHEMA_INVALID, ID_CARD_CHURN
5. **Full Ingest Pipeline** — syncIdentityEvents + fetchAndScoreIdentities flows through W1 scoring
6. **3 CLI Commands** — `wt id:sync`, `wt id:fetch`, `wt id:show`
7. **SQLite Migration 002** — identity_cursor, identity_events, identity_snapshots tables

## Verification

```bash
pnpm build      # All packages build clean
pnpm test       # 107 core tests + 43 app tests pass (33 new identity tests)
pnpm typecheck  # Zero errors
```

## Files Created (17)

| File | Purpose |
|------|---------|
| `packages/watchtower-core/src/storage/migrations/002_identity.sql` | Identity tables DDL |
| `packages/watchtower-core/src/identity/identityTypes.ts` | Types + interfaces |
| `packages/watchtower-core/src/identity/identityConfig.ts` | Zod config schema |
| `packages/watchtower-core/src/identity/agentCardSchema.ts` | Agent card Zod schema |
| `packages/watchtower-core/src/identity/agentCardFetcher.ts` | SSRF-safe fetcher |
| `packages/watchtower-core/src/identity/identityStore.ts` | SQLite CRUD |
| `packages/watchtower-core/src/identity/identityPoller.ts` | Reorg-safe log poller |
| `packages/watchtower-core/src/identity/deriveIdentitySignals.ts` | 4 identity signals |
| `packages/watchtower-core/src/identity/ingestIdentity.ts` | Pipeline orchestrator |
| `packages/watchtower-core/src/identity/index.ts` | Barrel export |
| `packages/watchtower-core/test/identity.test.ts` | 33 tests (mocked) |
| `packages/watchtower-cli/src/erc8004Abi.ts` | Minimal ERC-8004 ABI |
| `packages/watchtower-cli/src/identityAdapter.ts` | ChainProvider adapter |
| `000-docs/020-PR-ADDM-w3-identity-lens.md` | Architecture doc |
| `000-docs/021-DR-RUNB-w3-identity-sync-runbook.md` | CLI runbook |
| `000-docs/022-AA-REPT-w3-identity-lens.md` | This AAR |

## Files Modified (4)

| File | Change |
|------|--------|
| `packages/watchtower-core/src/storage/db.ts` | MIGRATION_002 inline + fallback |
| `packages/watchtower-core/src/index.ts` | Identity exports |
| `packages/watchtower-cli/src/cli.ts` | 3 new commands |
| `packages/watchtower-cli/package.json` | @irsb-watchtower/chain dep |

## Design Decisions

- **Injectable DNS + fetch in fetcher**: Avoids ESM mocking issues in tests, cleaner DI
- **`CardFetchOptions` vs `FetchOptions`**: Renamed to avoid barrel export collision with ingest pipeline's `FetchOptions`
- **Discovered_at for newborn age**: Uses event insertion time rather than block timestamp (block timestamps not stored in identity_events)
- **Level 1 scope only**: No sybil clustering, no global trust anchors, no endpoint blocklists

## What's Next (Not in W3)

- W4: Composite risk scoring across behavior + identity lenses
- Multi-registry support (multiple ERC-8004 registries)
- Real RPC integration testing against Sepolia
- Endpoint blocklist signal
