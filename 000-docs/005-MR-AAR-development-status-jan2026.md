# IRSB Protocol - After Action Review (AAR)

**Date:** January 25, 2026
**Status:** Phase 1 Foundation - Active Development
**Document ID:** 005-MR-AAR

---

## Executive Summary

IRSB (Intent Receipts & Solver Bonds) Protocol development has progressed significantly through Phase 1 Foundation. Core smart contracts are deployed on Sepolia testnet, SDK and subgraph are built, security audit preparation is complete, and outreach materials are ready.

---

## Current Status

### Completed ✅

| Component | Status | Details |
|-----------|--------|---------|
| **Smart Contracts** | ✅ Deployed | Sepolia testnet - all 3 contracts verified |
| **Test Suite** | ✅ 95 tests passing | Full coverage of core functionality |
| **TypeScript SDK** | ✅ Built | `@irsb/sdk` - CJS/ESM/DTS bundle ready |
| **The Graph Subgraph** | ✅ Built | Schema + mappings for all events |
| **Dashboard** | ✅ Deployed | https://irsb-protocol.web.app |
| **Security Audit Package** | ✅ Complete | SCOPE.md, THREAT-MODEL.md, INVARIANTS.md |
| **Investor Report** | ✅ Complete | IRSB-Investor-Report-Jan2026.pdf |
| **Pain Point Research** | ✅ Complete | $242K documented losses evidence |
| **Outreach Templates** | ✅ Complete | Solver, protocol, auditor templates |

### In Progress 🔄

| Component | Status | Next Step |
|-----------|--------|-----------|
| **npm SDK Publish** | 🔄 Pending | Awaiting npm auth refresh |
| **Subgraph Deploy** | 🔄 Ready | Deploy to The Graph Studio |
| **Etherscan Verification** | 🔄 Pending | Verify remaining contracts |
| **CoWSwap Pilot** | 🔄 Outreach | Awaiting solver responses |

### Pending 📋

| Component | Target | Dependency |
|-----------|--------|------------|
| Security Audit | Q1 2026 | Auditor engagement |
| Bug Bounty | Q1 2026 | Post-audit |
| Mainnet Deploy | Q1 2026 | Audit completion |

---

## Contract Addresses (Sepolia)

| Contract | Address | Status |
|----------|---------|--------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` | ✅ Deployed |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` | ✅ Deployed |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` | ✅ Deployed |

---

## Repository Structure

```
irsb-protocol/
├── src/                    # Solidity contracts
│   ├── SolverRegistry.sol
│   ├── IntentReceiptHub.sol
│   ├── DisputeModule.sol
│   └── Types.sol
├── test/                   # Foundry tests (95 passing)
├── script/                 # Deploy scripts
├── sdk/                    # TypeScript SDK
│   ├── src/
│   │   ├── client.ts       # IRSBClient class
│   │   ├── types.ts        # TypeScript types
│   │   └── contracts/abis.ts
│   ├── dist/               # Built output
│   └── README.md
├── subgraph/               # The Graph indexer
│   ├── schema.graphql      # Entity definitions
│   ├── subgraph.yaml       # Manifest
│   └── src/                # Mappings
├── dashboard/              # Next.js dashboard
├── audit/                  # Security audit package
│   ├── SCOPE.md
│   ├── THREAT-MODEL.md
│   └── INVARIANTS.md
├── outreach/               # Partnership templates
│   └── auditor-outreach.md
└── 000-docs/               # Documentation
    ├── 001-RL-PROP-*.md    # Protocol spec
    ├── 002-PP-PROD-*.md    # PRD
    ├── 003-AT-SPEC-*.md    # EIP spec
    ├── 004-MR-RSCH-*.md    # Research
    └── 005-MR-AAR-*.md     # This document
```

---

## Technical Achievements

### Smart Contracts
- **3 modular contracts** with clean separation of concerns
- **ERC-7683 compatible** intent receipt format
- **Deterministic slashing** for timeout/constraint violations
- **Arbitration support** for subjective disputes
- **Reputation decay** with configurable half-life

### SDK Features
- Full TypeScript support with strict typing
- Works with ethers.js v6
- Supports both CommonJS and ESM
- Receipt signing helpers
- Event listeners and polling

### Subgraph Entities
- Solver (registration, bonds, reputation, IntentScore)
- Receipt (posting, finalization, disputes)
- Dispute (opening, escalation, resolution)
- SlashEvent / BondEvent (history tracking)
- ProtocolStats / DailyStats (analytics)

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Tests | 95 |
| Test Pass Rate | 100% |
| Contract Size (SolverRegistry) | ~12KB |
| Contract Size (IntentReceiptHub) | ~15KB |
| Contract Size (DisputeModule) | ~8KB |
| SDK Bundle Size | ~45KB (minified) |
| GraphQL Entities | 8 |
| Event Handlers | 11 |

---

## Pain Points Validated

Evidence collected from real solver incidents:

| Incident | Date | Loss | Impact |
|----------|------|------|--------|
| CIP-22: Barter Solver Hack | Feb 2023 | $166,182 | DAO governance delay |
| CIP-55: GlueX Exploit | Nov 2024 | $76,783 | Manual investigation |
| **Total Documented** | | **$242,965** | |

---

## Next Actions (Priority Order)

### Immediate (This Week)
1. ✅ ~~Fix subgraph event signatures~~ → Complete
2. 📤 Publish SDK to npm
3. 📊 Deploy subgraph to The Graph Studio
4. 🔍 Verify remaining contracts on Etherscan

### Short-term (Q1 2026)
1. Engage Tier 1 security auditor (OpenZeppelin/Trail of Bits)
2. Launch $100K bug bounty on Immunefi
3. Onboard 5 CoWSwap solvers to pilot
4. Mainnet deployment (post-audit)

### Medium-term (Q2 2026)
1. Across Protocol integration
2. 1inch Fusion pilot (10 resolvers)
3. $10M monthly volume milestone
4. Security audit #2

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Audit delays | Medium | High | Early engagement, clear scope |
| Solver adoption | Medium | High | Free pilot, clear value prop |
| Competition | Low | Medium | First-mover, ERC-7683 focus |
| Smart contract bug | Low | Critical | Comprehensive testing, audit |

---

## Lessons Learned

1. **Event signatures matter** - Subgraph codegen failed due to ABI mismatch; always verify against actual compiled ABIs
2. **bytes32 vs address** - Protocol uses `solverId` (bytes32) not solver address; enables operator key rotation
3. **Status transitions** - Single `SolverStatusChanged` event is cleaner than separate Jailed/Banned events
4. **SDK value** - TypeScript SDK dramatically simplifies integration vs raw contract calls

---

## Resources

| Resource | URL |
|----------|-----|
| Dashboard | https://irsb-protocol.web.app |
| GitHub | https://github.com/intent-solutions-io/irsb-protocol |
| Docs | 000-docs/ directory |
| Sepolia Contracts | See addresses above |

---

## Appendix: Roadmap Summary

```
Q1 2026: Phase 1 - Foundation
  [▓▓▓▓▓▓▓▓░░] 80% Complete
  - ✅ Sepolia deployment
  - ✅ SDK + Subgraph built
  - ✅ Audit package ready
  - 🔄 Mainnet pending audit

Q2 2026: Phase 2 - Traction
  [░░░░░░░░░░] 0% Started
  - Across integration
  - 1inch pilot
  - $10M volume

Q3 2026: Phase 3 - Scale
  [░░░░░░░░░░] 0% Started
  - EigenLayer AVS
  - IntentScore oracle
  - $100M volume

Q4 2026: Phase 4 - Expansion
  [░░░░░░░░░░] 0% Started
  - Multi-chain
  - Enterprise package
  - $500M volume
```

---

*Document generated: January 25, 2026*
*Next review: February 1, 2026*
