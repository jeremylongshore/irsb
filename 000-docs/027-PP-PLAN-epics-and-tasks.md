# IRSB Protocol - Epics & Tasks Roadmap

**Version**: 1.1.0
**Last Updated**: 2026-01-30
**Tracking System**: Beads (bd)

---

## Overview

IRSB development is organized into **Epics** (major feature sets) and **Phases** (quarterly milestones). This document tracks current progress and remaining work.

### Epic Status Summary

| Epic | Name | Status | Priority |
|------|------|--------|----------|
| **A** | Mainnet Readiness (Security + Admin) | ✅ Complete | P0 |
| **B** | ERC-8004 Adapter + Credibility Publishing | ✅ Complete | P1 |
| **C** | x402 Payments + Reference Integration | 🔄 In Progress | P1 |
| **D** | Verification Tooling + Docs + Releases | 🔄 In Progress | P1 |

---

## ✅ EPIC A: Mainnet Readiness (Security + Admin)

**Bead ID**: `ethereum-7zk`
**Status**: CLOSED
**Priority**: P0 (Blocking)

### Description
Security hardening, admin model (multisig+timelock), fix all HIGH findings, CI gates. BLOCKS MAINNET.

### Completed Tasks

| ID | Task | Status |
|----|------|--------|
| A1 | Deploy Gnosis Safe multisig | ✅ Done |
| A2 | Deploy Timelock controller | ✅ Done |
| A3 | Transfer ownership to Safe | ✅ Done |
| A4-A10 | Security findings IRSB-SEC-001 through 005 | ✅ Done |
| A12-A16 | CI hardening, Slither gates, invariant tests | ✅ Done |

### Deliverables
- Safe: `0xdd70fb7c...`
- Timelock: `0xBcA0c8d0...`
- All HIGH/CRITICAL findings resolved
- 4 economic invariant tests (256 runs, 128k calls)

---

## ✅ EPIC B: ERC-8004 Adapter + Credibility Publishing

**Bead ID**: `ethereum-b1m`
**Status**: CLOSED (Released in v1.1.0)
**Priority**: P1

### Description
Full implementation of ERC-8004 validation signals standard with IntentScore algorithm for portable solver reputation.

### Completed Tasks

| ID | Task | Status |
|----|------|--------|
| B1 | Implement CredibilityRegistry interface | ✅ Done |
| B2 | ERC8004Adapter v2.0 with full signal support | ✅ Done |
| B3 | Add publishing hook on finalize (IntentReceiptHub) | ✅ Done |
| B4 | Add publishing hook on slash (SolverRegistry) | ✅ Done |
| B5 | Integration tests (6 tests) | ✅ Done |

### Remaining (P2 - Documentation)

| Bead ID | Task | Priority |
|---------|------|----------|
| `ethereum-ok6` | B6: Write ERC-8004 publishing guide | P2 |

### Deliverables
- ERC8004Adapter v2.0
- Non-reverting hooks in both core contracts
- IntentScore algorithm (40% success + 25% disputes + 20% stake + 15% longevity)
- Cross-chain Merkle proof support
- 6 integration tests

---

## 🔄 EPIC C: x402 Payments + Reference Integration

**Bead ID**: `ethereum-wr2`
**Status**: OPEN
**Priority**: P1

### Description
On-chain-only payment path for integrators. Complete x402 reference: 402 terms → payment → service → receipt posted → verification. No Stripe/fiat dependency.

### Tasks

| Bead ID | Task | Priority | Status |
|---------|------|----------|--------|
| `ethereum-uci` | C1: Review existing x402-irsb package | P1 | ⬚ Open |
| `ethereum-shi` | C2: Review existing x402-express-service example | P1 | ⬚ Open |
| `ethereum-hf2` | C3: Create minimal client script for x402 | P1 | ⬚ Open |
| `ethereum-p0s` | C4: Test x402 end-to-end on Sepolia | P1 | ⬚ Open |
| `ethereum-jie` | C5: Write x402 quickstart guide | P2 | ⬚ Open |

### Goal
Developer can go from zero to posting receipts via HTTP 402 in 30 minutes.

### Existing Assets
- `packages/x402-irsb/` - x402 integration package
- `examples/x402-express-service/` - Express example server

---

## 🔄 EPIC D: Verification Tooling + Docs + Releases

**Bead ID**: `ethereum-1mx`
**Status**: OPEN
**Priority**: P1

### Description
Verification CLI/SDK, privacy-safe evidence pointers, versioned NPM packages with provenance, 'Integrate in 30 min' guide, changelog, release process.

### Tasks

| Bead ID | Task | Priority | Status |
|---------|------|----------|--------|
| `ethereum-pcf` | D1: Implement `irsb verify` CLI/SDK function | P1 | ⬚ Open |
| `ethereum-9gj` | D2: Fix CLAUDE.md doc path references | P2 | ⬚ Open |
| `ethereum-kyj` | D3: Create adapter integration guide | P2 | ⬚ Open |
| `ethereum-0ie` | D4: Document v2 scope items | P2 | ⬚ Open |
| `ethereum-4hr` | D5: Write 'How disputes work' guide | P2 | ⬚ Open |
| `ethereum-bjn` | D6: Publish SDK to NPM with provenance | P1 | ⬚ Open |
| `ethereum-e9r` | D7: Publish x402-irsb to NPM with provenance | P1 | ⬚ Open |
| `ethereum-jhd` | D8: Update CHANGELOG and tag release | P1 | ⬚ Open |

### Goal
- `irsb verify <receipt-id>` works from CLI
- SDK published to npm with provenance attestation
- Complete documentation for integrators

---

## 🎯 Mainnet Deployment

**Bead ID**: `ethereum-jmx`
**Status**: OPEN
**Priority**: P0 (Highest)

### Prerequisites
- [x] Epic A: Security + Admin ✅
- [x] Epic B: ERC-8004 ✅
- [ ] Epic C: x402 Reference
- [ ] Epic D: Verification + Releases
- [ ] Security audit #2 (pre-mainnet)

---

## 📅 Phase Roadmap

### Phase 1: Foundation (Q1 2026)

**Bead ID**: `ethereum-857`

| Bead ID | Task | Priority | Status |
|---------|------|----------|--------|
| `ethereum-1f6` | CoWSwap pilot integration (5 solvers) | P1 | ⬚ Open |
| `ethereum-wz9` | Bug bounty launch ($100K Immunefi) | P1 | ⬚ Open |

### Phase 2: Traction (Q2 2026)

**Bead ID**: `ethereum-0x2`

| Bead ID | Task | Priority | Status |
|---------|------|----------|--------|
| `ethereum-bq8` | Across Protocol integration | P1 | ⬚ Open |
| `ethereum-7ws` | 1inch Fusion pilot (10 resolvers) | P1 | ⬚ Open |
| `ethereum-87i` | Security audit #2 | P1 | ⬚ Open |

### Phase 3: Scale (Q3 2026)

**Bead ID**: `ethereum-so1`

| Bead ID | Task | Priority | Status |
|---------|------|----------|--------|
| `ethereum-994` | EigenLayer AVS deployment | P1 | ⬚ Open |
| `ethereum-w0j` | IntentScore oracle launch | P1 | ⬚ Open |
| `ethereum-myh` | Lit Protocol Vincent Ability integration | P1 | ⬚ Open |

### Phase 4: Expansion (Q4 2026)

**Bead ID**: `ethereum-me6`

| Bead ID | Task | Priority | Status |
|---------|------|----------|--------|
| `ethereum-s0q` | Multi-chain (Hyperlane/LayerZero) | P1 | ⬚ Open |
| `ethereum-3j1` | Enterprise compliance package | P1 | ⬚ Open |

---

## 📊 Milestones

| Bead ID | Milestone | Priority |
|---------|-----------|----------|
| `ethereum-s54` | $10M monthly volume | P2 |
| `ethereum-d4o` | $100M monthly volume | P2 |
| `ethereum-vh4` | $500M monthly volume | P2 |
| `ethereum-rn3` | Insurance partnerships (2 DeFi protocols) | P2 |

---

## 🔧 Backlog (P2)

| Bead ID | Task | Priority |
|---------|------|----------|
| `ethereum-6el` | A17: Add dashboard build job to CI | P2 |
| `ethereum-ntg` | A11: Document IRSB-SEC-008 as accepted risk | P2 |
| `ethereum-mnv` | Cache high-value evidence proofs on-chain | P2 |

---

## Quick Reference: Beads Commands

```bash
# List all open tasks
bd list

# List tasks for an epic
bd list | grep "C[0-9]:"

# Show task details
bd show ethereum-uci

# Start working on a task
bd update ethereum-uci --status in_progress

# Complete a task
bd close ethereum-uci --reason "Evidence: commit abc123, tests pass"

# Sync to git
bd sync
```

---

## Next Actions

### Immediate (This Week)
1. **C1**: Review x402-irsb package (`ethereum-uci`)
2. **C2**: Review x402-express-service example (`ethereum-shi`)
3. **D1**: Implement `irsb verify` CLI (`ethereum-pcf`)

### Short-term (This Month)
4. **C3-C4**: Complete x402 end-to-end flow
5. **D6-D7**: Publish packages to npm
6. **D8**: Tag next release

---

*Last sync: 2026-01-30 | Use `bd sync` to update*
