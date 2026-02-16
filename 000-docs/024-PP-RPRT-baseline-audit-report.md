# IRSB Protocol: Baseline Audit Report

**Date:** 2026-01-29
**Version:** v1.0.0 (tag: v1.0.0)
**Branch:** master
**Commit:** ce2b007e

---

## Executive Summary

This report captures the baseline state of the IRSB Protocol before executing the comprehensive 78→100 System Health Plan combined with the Mainnet Readiness initiative.

### Current State: 78/100

| Category | Current | Target | Gap |
|----------|---------|--------|-----|
| Security | 6/10 | 10/10 | 5 HIGH findings, 5 MEDIUM findings |
| Operations | 7/10 | 10/10 | No multisig, no timelock |
| Test Coverage | 8/10 | 10/10 | 1 failing invariant, missing economic invariants |
| CI/CD | 8/10 | 10/10 | Fuzz not in CI, no dashboard build |
| Documentation | 9/10 | 10/10 | Path refs broken, missing guides |
| Architecture | 9/10 | 10/10 | Missing adapter guide |

---

## 1. Repository Structure

```
irsb-protocol/
├── src/                        # Solidity contracts
│   ├── SolverRegistry.sol      # 16KB - Solver lifecycle, bonding, slashing
│   ├── IntentReceiptHub.sol    # 21KB - Receipt posting, disputes
│   ├── DisputeModule.sol       # 13KB - Arbitration
│   ├── EscrowVault.sol         # 8.5KB - ETH + ERC20 escrow
│   ├── adapters/
│   │   ├── AcrossAdapter.sol   # 13KB - Across Protocol integration
│   │   └── ERC8004Adapter.sol  # 8.8KB - Validation provider
│   ├── extensions/
│   │   └── ReceiptV2Extension.sol  # Dual attestation, EIP-712
│   └── modules/
│       └── OptimisticDisputeModule.sol  # Counter-bond disputes
├── sdk/                        # TypeScript SDK
│   ├── src/                    # SDK source
│   ├── tests/                  # SDK tests
│   └── dist/                   # Built output
├── packages/
│   └── x402-irsb/              # x402 HTTP payment integration
├── examples/
│   └── x402-express-service/   # Express example
├── dashboard/                  # Next.js dashboard + landing
├── subgraph/                   # The Graph indexer
├── test/                       # Foundry tests
│   ├── fuzz/                   # Fuzz tests
│   └── invariants/             # Invariant tests
├── script/                     # Deployment scripts
├── deployments/                # Deployed addresses
└── 000-docs/                   # 24 documentation files
```

---

## 2. Test Suite Status

### Summary
- **324 tests total** (was 308, added invariants)
- **323 passing, 1 failing**
- **14 test suites**

### Failing Test
```
FAIL: SolverRegistryInvariants.invariant_SR1_bondAccountingNeverExceedsBalance
```
- **Location:** `test/invariants/SolverRegistry.invariants.t.sol`
- **Root cause:** Bond accounting edge case with registerAndBondSolver + depositBond sequence
- **Beads ID:** ethereum-8js (P0)

### Test Suites

| Suite | Passed | Failed |
|-------|--------|--------|
| AcrossAdapterTest | 32 | 0 |
| DisputeModuleTest | 23 | 0 |
| ERC8004AdapterTest | 33 | 0 |
| EscrowVaultTest | 25 | 0 |
| EscrowVaultERC20Test | 16 | 0 |
| IntentReceiptHubTest | 41 | 0 |
| OptimisticDisputeTest | 33 | 0 |
| ReceiptV2ExtensionTest | 27 | 0 |
| SolverRegistryTest | 37 | 0 |
| EscrowVaultFuzzTest | 14 | 0 |
| IntentReceiptHubFuzz | 8 | 0 |
| OptimisticDisputeFuzzTest | 7 | 0 |
| ReceiptV2FuzzTest | 10 | 0 |
| SolverRegistryFuzz | 8 | 0 |
| DisputeModuleInvariants | 3 | 0 |
| IntentReceiptHubInvariants | 4 | 0 |
| **SolverRegistryInvariants** | **3** | **1** |

---

## 3. Security Findings

### HIGH Severity (5 open)

| ID | Finding | Contract | Status | Beads |
|----|---------|----------|--------|-------|
| IRSB-SEC-001 | No chainId in receipt signature | IntentReceiptHub | OPEN | ethereum-l5h |
| IRSB-SEC-002 | escalate() callable by anyone | DisputeModule | OPEN | ethereum-jpr |
| IRSB-SEC-003 | Failed dispute reverts to Pending | IntentReceiptHub | OPEN | ethereum-cl0 |
| IRSB-SEC-004 | Hub authorization SPOF | SolverRegistry | DOCUMENTED | - |
| IRSB-SEC-005 | Zero slash amount silent failure | SolverRegistry | OPEN | ethereum-c2j |

### MEDIUM Severity (5 open)

| ID | Finding | Contract | Status | Beads |
|----|---------|----------|--------|-------|
| IRSB-SEC-006 | No nonce in receipt signature | IntentReceiptHub | OPEN | ethereum-wsj |
| IRSB-SEC-007 | setSolverKey no timelock | SolverRegistry | DOCUMENTED | - |
| IRSB-SEC-008 | Arbitrator 10% incentive | DisputeModule | TO ACCEPT | ethereum-ntg |
| IRSB-SEC-009 | batchPostReceipts skips sig check | IntentReceiptHub | OPEN | ethereum-owv |
| IRSB-SEC-010 | No min slash amount validation | DisputeModule | OPEN | ethereum-4ur |

---

## 4. Current Deployments

### Sepolia Testnet

| Contract | Address | Owner |
|----------|---------|-------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` | EOA |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` | EOA |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` | EOA |

**Risk:** Single EOA owner - no multisig, no timelock

---

## 5. CI/CD Status

### Current Pipeline

```yaml
jobs:
  contracts:   # forge build, forge test
  lint:        # forge fmt --check
  sdk:         # pnpm install, build, test
  subgraph:    # pnpm codegen, build
  security:    # Slither (non-blocking)
  summary:     # needs: [contracts, lint, sdk, subgraph]
```

### Gaps

1. **Security job not in summary needs** - Slither failures don't block PR
2. **Dashboard build missing** - Not tested in CI
3. **Fuzz profile not enabled** - Default 256 runs, should be 10k
4. **No coverage gate** - Can merge below 80%

---

## 6. SDK Status

### @irsb/sdk

- **Location:** `sdk/`
- **Build:** Passes
- **Tests:** Passes
- **NPM:** Not yet published

### irsb-x402

- **Location:** `packages/x402-irsb/`
- **Build:** Passes
- **Tests:** Passes
- **NPM:** Not yet published

---

## 7. Documentation Status

### 000-docs/ Index

| Code | Title | Status |
|------|-------|--------|
| 001-RL-PROP | Solver Accountability Proposal | Complete |
| 002-PP-PROD | Product Requirements | Complete |
| 003-AT-SPEC | EIP Specification | Complete |
| 004-MR-RSCH | Accountability Gap Report | Complete |
| 005-MR-AAR | Development Status | Complete |
| 006-MR-FEAS | Feasibility Report | Complete |
| 007-AT-SPEC | Receipt Schema | Complete |
| 008-AA-AUDT | DevOps Playbook | Complete |
| 009-AA-SEC | Security Audit v1 | In Progress |
| 010-OD-GUID | Deployment Guide | Complete |
| 011-OD-GUID | Incident Playbook | Complete |
| 012-OD-GUID | Monitoring Guide | Complete |
| 013-OD-GUID | Multisig Plan | Complete |
| 014-AT-DSGN | Privacy Design | Complete |
| 015-AT-SPEC | Validation Provider | Complete |
| 016-AT-INTG | x402 Integration | Needs Update |
| 017-OD-GUID | Security Operations | Complete |
| 018-OD-GUID | Discussions Setup | Complete |
| 019-OD-GUID | Repo Gaps | Needs Update |
| 020-OD-GUID | Custom Properties | Complete |
| 021-AA-AUDT | DevOps Playbook v2 | Complete |

### Missing Documentation

- **022-AT-INTG-adapter-integration.md** - How to integrate adapters
- **023-AT-INTG-erc8004-publishing.md** - ERC-8004 publishing guide
- **RELEASING.md** - NPM release process

### CLAUDE.md Path Errors

6 broken references to be fixed (see ethereum-9gj)

---

## 8. Contract Sizes

All contracts within 24,576 byte limit:

| Contract | Runtime (B) | Margin (B) |
|----------|-------------|------------|
| SolverRegistry | 10,589 | 14,187 |
| IntentReceiptHub | 14,252 | 10,324 |
| DisputeModule | 7,268 | 17,308 |
| EscrowVault | 4,305 | 20,271 |
| ReceiptV2Extension | 14,509 | 10,067 |
| OptimisticDisputeModule | 14,312 | 10,264 |

---

## 9. Beads Task Summary

### Epics Created

| ID | Epic | Priority |
|----|------|----------|
| ethereum-7zk | EPIC A: Mainnet Readiness | P0 |
| ethereum-b1m | EPIC B: ERC-8004 Publishing | P1 |
| ethereum-wr2 | EPIC C: x402 Payments | P1 |
| ethereum-1mx | EPIC D: Verification + Releases | P1 |

### Task Counts

| Epic | P0 | P1 | P2 | Total |
|------|----|----|----|----|
| A: Mainnet | 8 | 7 | 3 | 18 |
| B: ERC-8004 | 0 | 5 | 1 | 6 |
| C: x402 | 0 | 4 | 1 | 5 |
| D: Releases | 0 | 4 | 4 | 8 |
| **Total** | **8** | **20** | **9** | **37** |

### Ready to Start (No Blockers)

1. ethereum-7uj: A1: Deploy Gnosis Safe Multisig
2. ethereum-l5h: A4: Fix IRSB-SEC-001 (chainId)
3. ethereum-jpr: A5: Fix IRSB-SEC-002 (escalate)
4. ethereum-cl0: A6: Fix IRSB-SEC-003 (failed dispute)
5. ethereum-c2j: A7: Fix IRSB-SEC-005 (zero slash)
6. ethereum-wsj: A8: Fix IRSB-SEC-006 (nonce)
7. ethereum-uci: C1: Review x402-irsb package
8. ethereum-shi: C2: Review x402-express-service

---

## 10. Static Analysis

### Slither Status

**Not installed** in current environment. To be run in CI.

Configuration exists: `slither.config.json`

---

## 11. Success Criteria (Definition of Done)

### S1: Security + Admin Hardening
- [ ] Protocol ownership not single EOA
- [ ] Multisig + timelock deployed
- [ ] All HIGH findings fixed or accepted
- [ ] Tests + fuzz + invariants pass
- [ ] Slither passes with justified suppressions

### S2: ERC-8004 Publishing
- [ ] Adapter can publish solver identities
- [ ] Validation signals published on finalize
- [ ] Reputation signals published on slash
- [ ] Integration tests pass on fork

### S3: On-chain-only Payments
- [ ] x402 reference integration complete
- [ ] Reference service works end-to-end
- [ ] Client script runs on testnet
- [ ] No Stripe/fiat dependency

### S4: Verification UX
- [ ] `irsb verify <receiptId>` implemented
- [ ] Evidence pointers privacy-safe
- [ ] Status, tx hashes, CIDs returned

### S5: Releases + Documentation
- [ ] NPM packages published with provenance
- [ ] "Integrate in 30 min" guide complete
- [ ] "How disputes work" guide complete
- [ ] CHANGELOG updated, release tagged

---

## 12. Execution Order

```
Phase 0: Baseline ✓ (this document)
    │
    ▼
Phase 1: Security Fixes (A4-A10) ← START HERE
    │   - Fix HIGH/MEDIUM findings
    │   - Can run in parallel
    │
    ▼
Phase 2: Invariant Fix (A13)
    │   - Fix SR1 invariant
    │   - Blocked by A4-A7
    │
    ▼
Phase 3: CI Improvements (A14-A17)
    │   - Coverage gate, fuzz profile
    │   - Dashboard build, security needs
    │
    ▼
Phase 4: Operations (A1-A3)
    │   - Deploy multisig
    │   - Deploy timelock
    │   - Transfer ownership
    │
    ├───────────────────────────────┐
    ▼                               ▼
Phase 5a: ERC-8004 (B1-B6)    Phase 5b: x402 (C1-C5)
    │                               │
    └───────────────┬───────────────┘
                    ▼
Phase 6: Verification + Releases (D1-D8)
    │   - Verify CLI
    │   - NPM publish
    │   - Tag release
    │
    ▼
MAINNET READY
```

---

## Verification Commands

```bash
# Run all tests
forge test

# CI profile (10k fuzz)
FOUNDRY_PROFILE=ci forge test

# Coverage check
forge coverage --report summary

# Build all packages
cd sdk && pnpm build && cd ..
cd packages/x402-irsb && pnpm build && cd ..
cd dashboard && npm run build && cd ..

# Check beads status
bd ready
bd blocked
bd list --all
```

---

**Document Author:** Claude Code (Opus 4.5)
**Beads Session:** Active
**Next Action:** Execute Phase 1 - Security Fixes starting with ethereum-l5h
