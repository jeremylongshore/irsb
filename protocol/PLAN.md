# IRSB Protocol - Master Execution Plan

**Last Updated:** January 25, 2026
**Status:** Active Development

---

## Epic Overview

```
IRSB Protocol Rollout (ethereum-9i0)
│
├── Phase 1: Foundation (Q1 2026) [ethereum-857]
│   ├── [P0] Security audit #1 (ethereum-kpr) ← blocked by v03
│   ├── [P0] Mainnet deployment (ethereum-jmx) ← blocked by 0vi
│   ├── [P1] SDK & documentation (ethereum-wo9) ← blocked by jmx
│   ├── [P1] CoWSwap pilot (ethereum-1f6) ← blocked by wo9
│   └── [P1] Bug bounty launch (ethereum-wz9) ← blocked by kpr
│
├── Phase 2: Traction (Q2 2026) [ethereum-0x2] ← blocked by Phase 1
│   ├── [P1] Across Protocol integration (ethereum-bq8)
│   ├── [P1] 1inch Fusion pilot (ethereum-7ws)
│   ├── [P1] Security audit #2 (ethereum-87i)
│   └── [P2] $10M volume milestone (ethereum-s54)
│
├── Phase 3: Scale (Q3 2026) [ethereum-so1] ← blocked by Phase 2
│   ├── [P1] EigenLayer AVS (ethereum-994) ← blocked by mnv
│   ├── [P1] IntentScore oracle (ethereum-w0j)
│   ├── [P1] Lit Vincent Ability (ethereum-myh)
│   └── [P2] $100M volume milestone (ethereum-d4o)
│
└── Phase 4: Expansion (Q4 2026) [ethereum-me6] ← blocked by Phase 3
    ├── [P1] Multi-chain (ethereum-s0q)
    ├── [P1] Enterprise compliance (ethereum-3j1)
    ├── [P2] Insurance partnerships (ethereum-rn3)
    └── [P2] $500M volume milestone (ethereum-vh4)
```

---

## Pre-Phase: Validation Sprint (NOW)

These tasks are **immediate priorities** that unblock everything else:

### Critical Path (Unblocks Phase 1)

| ID | Task | Blocks | Status |
|----|------|--------|--------|
| `ethereum-0vi` | Deploy to Sepolia testnet | Mainnet deploy | **READY** |
| `ethereum-v03` | Security audit preparation | Audit #1 | **READY** |

### Market Validation (Unblocks Partnership)

| ID | Task | Blocks | Status |
|----|------|--------|--------|
| `ethereum-e95` | Accountability Gap Report | All 3 partnerships | **READY** |
| `ethereum-imw` | Solver Reputation Dashboard | CoWSwap outreach | **READY** |
| `ethereum-15d` | Solver Interview Campaign | - | **READY** |
| `ethereum-zo0` | IRSB Demo Video | - | **READY** |

### Partnership Outreach (Blocked)

| ID | Task | Blocked By | Status |
|----|------|------------|--------|
| `ethereum-3nv` | Partnership - CoWSwap | e95, imw | BLOCKED |
| `ethereum-9vt` | Partnership - Across | e95 | BLOCKED |
| `ethereum-7nv` | Partnership - 1inch | e95 | BLOCKED |

### Technical Debt

| ID | Task | Blocks | Status |
|----|------|--------|--------|
| `ethereum-mnv` | Cache evidence proofs on-chain | EigenLayer AVS | **READY** |

---

## Execution Order

### Week 1 (Immediate)

1. **`ethereum-0vi`** - Deploy to Sepolia
   - Run deployment script
   - Verify contracts on Etherscan
   - Test basic flows
   - → Unblocks: Mainnet deployment

2. **`ethereum-v03`** - Security audit prep
   - Code documentation
   - Test coverage report
   - Known issues list
   - → Unblocks: Audit #1

3. **`ethereum-e95`** - Accountability Gap Report
   - Set up Dune Analytics query
   - Analyze CoWSwap intent failures
   - Categorize by violation type
   - Produce 3-page PDF
   - → Unblocks: All partnership outreach

4. **`ethereum-imw`** - Solver Dashboard
   - Create The Graph subgraph
   - Build Next.js frontend
   - Deploy to Vercel
   - → Unblocks: CoWSwap outreach

### Week 2

5. **`ethereum-15d`** - Solver Interview Campaign
   - Contact top 10 CoWSwap solvers
   - Schedule 30-min interviews
   - Document feedback

6. **`ethereum-zo0`** - Demo Video
   - Create Figma prototype
   - Record Loom walkthrough
   - Publish and share

7. **`ethereum-3nv`** - CoWSwap Outreach (after e95+imw)
   - Post in Telegram #solvers
   - Direct outreach to top 3

8. **`ethereum-9vt`** / **`ethereum-7nv`** - Across/1inch Outreach
   - Send partnership proposals

### Week 3-4 (Phase 1 Start)

9. **`ethereum-jmx`** - Mainnet Deployment (after 0vi)
   - Deploy to Ethereum mainnet
   - Verify contracts
   - Set up monitoring

10. **`ethereum-kpr`** - Security Audit (after v03)
    - Submit to Tier 1 firm
    - Address findings

11. **`ethereum-wo9`** - SDK Release (after jmx)
    - npm package
    - Documentation site
    - Integration guides

12. **`ethereum-1f6`** - CoWSwap Pilot (after wo9)
    - Onboard 5 solvers
    - Monitor performance

13. **`ethereum-wz9`** - Bug Bounty (after kpr)
    - Launch on Immunefi
    - $100K pool

---

## Dependency Graph

```
                    ┌─────────────┐
                    │   Sepolia   │ ethereum-0vi
                    │   Deploy    │ [READY]
                    └──────┬──────┘
                           │ blocks
                           ▼
                    ┌─────────────┐
                    │  Mainnet    │ ethereum-jmx
                    │  Deploy     │
                    └──────┬──────┘
                           │ blocks
                           ▼
                    ┌─────────────┐
                    │    SDK      │ ethereum-wo9
                    │  Release    │
                    └──────┬──────┘
                           │ blocks
                           ▼
                    ┌─────────────┐
                    │  CoWSwap    │ ethereum-1f6
                    │   Pilot     │
                    └─────────────┘


┌─────────────┐     ┌─────────────┐
│ Audit Prep  │     │   Audit     │ ethereum-v03 → ethereum-kpr
│  [READY]    │────▶│   #1        │
└─────────────┘     └──────┬──────┘
                           │ blocks
                           ▼
                    ┌─────────────┐
                    │ Bug Bounty  │ ethereum-wz9
                    └─────────────┘


┌─────────────┐     ┌─────────────┐
│ Accountabil │     │ CoWSwap     │
│ Report      │────▶│ Outreach    │ ethereum-e95 → ethereum-3nv
│ [READY]     │     └─────────────┘
└──────┬──────┘
       │            ┌─────────────┐
       ├───────────▶│  Across     │ ethereum-e95 → ethereum-9vt
       │            │  Outreach   │
       │            └─────────────┘
       │            ┌─────────────┐
       └───────────▶│   1inch     │ ethereum-e95 → ethereum-7nv
                    │  Outreach   │
                    └─────────────┘

┌─────────────┐
│  Dashboard  │────▶ CoWSwap Outreach (also needs e95)
│  [READY]    │      ethereum-imw → ethereum-3nv
└─────────────┘
```

---

## Success Metrics by Phase

### Pre-Phase (Validation)
- [ ] Sepolia contracts verified
- [ ] Audit prep docs complete
- [ ] Accountability report published
- [ ] Dashboard live with real data
- [ ] 3+ solver interviews completed
- [ ] Demo video published
- [ ] 2+ pilot signups

### Phase 1 (Q1 2026)
- [ ] Mainnet deployed and verified
- [ ] Audit #1 passed (no critical findings)
- [ ] SDK on npm with 100+ downloads
- [ ] 5 CoWSwap solvers onboarded
- [ ] Bug bounty live with $100K pool

### Phase 2 (Q2 2026)
- [ ] Across Protocol integrated
- [ ] 1inch Fusion pilot (10 resolvers)
- [ ] $10M monthly volume
- [ ] Audit #2 passed

### Phase 3 (Q3 2026)
- [ ] EigenLayer AVS live
- [ ] IntentScore oracle deployed
- [ ] Lit Vincent Ability integrated
- [ ] $100M monthly volume

### Phase 4 (Q4 2026)
- [ ] Multi-chain (3+ chains)
- [ ] Enterprise compliance package
- [ ] 2+ insurance partnerships
- [ ] $500M monthly volume

---

## Quick Commands

```bash
# View ready tasks
bd ready

# Start a task
bd update <id> --status in_progress

# Complete a task
bd close <id> --reason "Evidence: ..."

# Sync to git
bd sync

# View blocked tasks
bd blocked

# View full task details
bd show <id>
```

---

## Files Created

| File | Purpose |
|------|---------|
| `IRSB-Pain-Point-Research.pdf` | Market validation research |
| `IRSB-Pain-Point-Research.md` | Source markdown |
| `000-docs/004-MR-RSCH-pain-point-research.md` | Archived copy |
| `PLAN.md` | This file |

---

## Next Action

**Start with: `ethereum-0vi` (Deploy to Sepolia)**

```bash
bd update ethereum-0vi --status in_progress
```

This is the critical path blocker for Phase 1.
