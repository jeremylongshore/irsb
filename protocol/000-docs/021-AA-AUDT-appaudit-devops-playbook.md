# IRSB Protocol: Operator-Grade System Analysis

*For: DevOps Engineer*
*Generated: 2026-01-29*
*Version: v1.0.0-28-g6605ac00*

---

## 1. Executive Summary

### Business Purpose

IRSB (Intent Receipts & Solver Bonds) is the accountability layer for intent-based transactions on Ethereum. It solves a critical gap in the emerging ERC-7683 intent standard: **what happens when a solver fails to execute properly?**

The protocol provides three core mechanisms:
1. **Receipts** - On-chain cryptographic proof that a solver executed an intent
2. **Bonds** - Staked collateral (minimum 0.1 ETH) that can be slashed for violations
3. **Disputes** - Automated enforcement with deterministic resolution for provable violations and arbitration for complex cases

IRSB is currently deployed on Sepolia testnet (v1.0.0) with plans for mainnet deployment after completing multisig transition and security hardening. The protocol is open source (MIT license) and aims to become the cross-protocol standard for intent accountability.

**Key Risk:** Owner is currently a single EOA. Multisig transition documented but not yet executed. This is the primary blocker for mainnet deployment.

### Operational Status Matrix

| Environment | Status | Uptime Target | Release Cadence |
|-------------|--------|---------------|-----------------|
| Sepolia Testnet | **LIVE** | Best effort | Continuous |
| Polygon Amoy | Planned | Best effort | After Sepolia stable |
| Mainnet | NOT DEPLOYED | 99.9% | After multisig |

### Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Smart Contracts | Solidity | 0.8.25 | Core protocol logic |
| Framework | Foundry | Latest nightly | Build, test, deploy |
| Dependencies | OpenZeppelin | 5.x | Security primitives |
| SDK | TypeScript | 5.3+ | Client integration |
| Indexing | The Graph | 0.68+ | Event aggregation |
| Dashboard | Next.js | 14.x | Solver management UI |
| CI/CD | GitHub Actions | - | Automated testing |
| Static Analysis | Slither | Latest | Security scanning |

---

## 2. System Architecture

### Technology Stack (Detailed)

| Layer | Technology | Version | Purpose | Owner |
|-------|------------|---------|---------|-------|
| **Contracts** | Solidity 0.8.25 | via_ir, 200 opt runs | Core protocol | Protocol Team |
| **Testing** | Foundry | Nightly | Unit/fuzz/invariant | Protocol Team |
| **Security** | Slither | Latest | Static analysis | Protocol Team |
| **SDK** | TypeScript + ethers.js | 6.9+ | Client library | Protocol Team |
| **Indexer** | The Graph (AssemblyScript) | 0.32+ | Event indexing | Protocol Team |
| **Dashboard** | Next.js 14 + React 18 | - | Solver UI | Protocol Team |
| **Infra** | GitHub Actions | - | CI/CD | Protocol Team |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL ACTORS                              │
├──────────────┬──────────────┬───────────────┬───────────────────────┤
│   Solvers    │   Users      │  Challengers  │      Arbitrator       │
│  (operators) │  (intents)   │  (disputes)   │   (complex cases)     │
└──────┬───────┴──────┬───────┴───────┬───────┴───────────┬───────────┘
       │              │               │                   │
       ▼              ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      IRSB PROTOCOL CONTRACTS                        │
├─────────────────┬───────────────────┬───────────────────────────────┤
│ SolverRegistry  │ IntentReceiptHub  │      DisputeModule            │
│ ├─registration  │ ├─postReceipt()   │      ├─submitEvidence()       │
│ ├─depositBond() │ ├─openDispute()   │      ├─escalate()             │
│ ├─slash()       │ ├─finalize()      │      └─resolve()              │
│ └─reputation    │ └─deterministic   │                               │
├─────────────────┴───────────────────┴───────────────────────────────┤
│                      EXTENSION CONTRACTS                            │
├───────────────────┬─────────────────────┬───────────────────────────┤
│ EscrowVault       │ ReceiptV2Extension  │ OptimisticDisputeModule   │
│ ├─ETH + ERC20     │ ├─dual attestation  │ ├─counter-bond window     │
│ ├─release/refund  │ ├─EIP-712 sigs      │ ├─timeout resolution      │
│ └─receipt-linked  │ └─privacy levels    │ └─escalation to arb       │
├───────────────────┴─────────────────────┴───────────────────────────┤
│                        ADAPTERS                                      │
├─────────────────────────────────────────────────────────────────────┤
│ ERC8004Adapter (validation provider) │ AcrossAdapter (bridge)       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPPORTING INFRASTRUCTURE                       │
├─────────────────┬───────────────────┬───────────────────────────────┤
│ The Graph       │ TypeScript SDK    │ Next.js Dashboard             │
│ (subgraph)      │ (npm package)     │ (solver management)           │
└─────────────────┴───────────────────┴───────────────────────────────┘
```

### Data Flow

```
Intent Submitted (off-chain)
         │
         ▼
┌─────────────────┐
│ Solver Executes │
│  (off-chain)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ postReceipt()   │────►│ 1-hour Challenge │
│ IntentReceiptHub│     │    Window        │
└─────────────────┘     └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
       No Dispute         Deterministic        Escalated
              │              Dispute             Dispute
              │                  │                  │
              ▼                  ▼                  ▼
       finalize()        Auto-slash via      DisputeModule
              │          SolverRegistry       arbitration
              │                  │                  │
              └──────────────────┴──────────────────┘
                                 │
                                 ▼
                        Reputation Updated
                        (SolverRegistry)
```

---

## 3. Directory Analysis

### Project Structure

```
irsb-protocol/
├── src/                          # Solidity contracts (core protocol)
│   ├── SolverRegistry.sol        # 439 SLOC - solver lifecycle, bonding, slashing
│   ├── IntentReceiptHub.sol      # 507 SLOC - receipts, disputes, finalization
│   ├── DisputeModule.sol         # 340 SLOC - evidence, escalation, arbitration
│   ├── EscrowVault.sol           # 230 SLOC - ETH + ERC20 escrow
│   ├── adapters/
│   │   ├── ERC8004Adapter.sol    # Validation provider for ERC-8004
│   │   └── AcrossAdapter.sol     # Bridge integration
│   ├── extensions/
│   │   └── ReceiptV2Extension.sol # Dual attestation, privacy levels
│   ├── modules/
│   │   └── OptimisticDisputeModule.sol # Counter-bond disputes
│   ├── interfaces/               # Contract interfaces
│   ├── libraries/
│   │   ├── Types.sol             # V1 structs, enums, constants
│   │   ├── TypesV2.sol           # V2 structs, PrivacyLevel
│   │   └── Events.sol            # Shared events
│   └── mocks/                    # Test mocks
├── test/                         # Foundry tests (308 passing)
│   ├── *.t.sol                   # Unit tests per contract
│   ├── fuzz/                     # Fuzz tests (5 files)
│   └── invariants/               # Invariant tests (3 files)
├── script/                       # Deployment scripts
│   ├── Deploy.s.sol              # Main deployment
│   ├── DeployAmoy.s.sol          # Polygon Amoy deployment
│   ├── SeedTestData.s.sol        # Test data seeding
│   └── VerifyAmoy.s.sol          # Verification script
├── sdk/                          # TypeScript SDK (irsb)
│   ├── src/                      # SDK source
│   └── package.json              # npm package config
├── packages/
│   └── x402-irsb/                # x402 HTTP payment integration
├── examples/
│   └── x402-express-service/     # Express example with 402 flow
├── dashboard/                    # Next.js solver dashboard
│   ├── src/                      # React components
│   └── package.json              # Dependencies
├── subgraph/                     # The Graph indexer
│   ├── schema.graphql            # GraphQL schema
│   ├── subgraph.yaml             # Manifest
│   └── src/                      # AssemblyScript handlers
├── deployments/                  # Deployed addresses by network
│   └── sepolia.json              # Sepolia deployment info
├── audit/                        # Security audit documentation
│   ├── SCOPE.md                  # Audit scope
│   ├── INVARIANTS.md             # Formal invariants
│   └── THREAT-MODEL.md           # Threat analysis
├── 000-docs/                     # Architecture docs (21 files)
├── scripts/
│   └── security.sh               # Security check script
├── foundry.toml                  # Foundry configuration
├── slither.config.json           # Slither configuration
├── .github/
│   └── workflows/ci.yml          # CI pipeline
└── [community files]             # CONTRIBUTING, SECURITY, etc.
```

### Key Directories

**src/** - Core Solidity contracts
- Entry points: `SolverRegistry.sol`, `IntentReceiptHub.sol`, `DisputeModule.sol`
- Extensions provide V2 features (dual attestation, escrow)
- Total ~6,400 SLOC across all contracts

**test/** - Comprehensive test suite
- Framework: Foundry (forge)
- Coverage: 308 tests, ~85-95% line coverage
- Includes fuzz tests (5 files, 256-10k iterations)
- Includes invariant tests (3 files)

**000-docs/** - Operational documentation
- Deployment runbook, incident playbook, monitoring guide
- Security audit report, threat model, invariants
- Architecture decisions (ADRs)

---

## 4. Operational Reference

### Deployment Workflows

#### Local Development

**Prerequisites:**
- Foundry (latest nightly): `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Node.js 18+
- Git 2.40+

**Setup:**
```bash
# Clone repository
git clone https://github.com/intent-solutions-io/irsb-protocol.git
cd irsb-protocol

# Install Solidity dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test test_RegisterSolver
```

**SDK Development:**
```bash
cd sdk
npm install
npm run build
npm test
```

**Dashboard Development:**
```bash
cd dashboard
npm install
npm run dev    # http://localhost:3000
```

#### Production Deployment

**Pre-flight checklist:**
- [ ] All 308 tests passing: `forge test`
- [ ] Formatting clean: `forge fmt --check`
- [ ] Security script passes: `./scripts/security.sh`
- [ ] Environment variables configured in `.env`
- [ ] Deployer wallet funded (≥0.2 ETH for Sepolia)
- [ ] Git status clean, on master branch

**Execution steps (Sepolia):**
```bash
# 1. Load environment
source .env

# 2. Dry-run simulation
forge script script/Deploy.s.sol:DeploySepolia \
  --rpc-url $SEPOLIA_RPC_URL -vvv

# 3. Deploy with broadcast
forge script script/Deploy.s.sol:DeploySepolia \
  --rpc-url $SEPOLIA_RPC_URL --broadcast -vvvv

# 4. Verify contracts
forge verify-contract <ADDRESS> src/SolverRegistry.sol:SolverRegistry \
  --chain sepolia --etherscan-api-key $ETHERSCAN_API_KEY

# 5. Update deployments/sepolia.json
# 6. Commit and tag release
```

**Rollback protocol:**
1. Pause all contracts: `cast send $CONTRACT "pause()" --private-key $OWNER_KEY`
2. Document state at pause time
3. Deploy new contracts
4. Migrate state if needed
5. Update SDK/dashboard configurations
6. Unpause or redirect users to new contracts

### Monitoring & Alerting

**Dashboards:**
- Sepolia Etherscan: https://sepolia.etherscan.io/address/0xB6ab964832808E49635fF82D1996D6a888ecB745
- The Graph Studio: (subgraph endpoint)
- IRSB Dashboard: https://irsb-protocol.web.app

**SLIs/SLOs:**
| Metric | Target | Current |
|--------|--------|---------|
| Receipt finalization rate | >95% | Baseline TBD |
| Dispute resolution time | <7 days | Within timeout |
| Contract uptime | 100% (testnet) | 100% |

**On-call:** Single maintainer model currently. See `GOVERNANCE.md`.

### Incident Response

| Severity | Definition | Response Time | Playbook |
|----------|------------|---------------|----------|
| P0 | Protocol exploit, funds at risk | 15 minutes | §1 Emergency Response |
| P1 | Arbitrator down, critical feature broken | 4 hours | §2 Escalation Timeout |
| P2 | Subgraph lag, gas spikes | 24 hours | §3 Infrastructure |
| P3 | Documentation gaps, UI bugs | 7 days | Weekly review |

**Full incident playbook:** `000-docs/011-OD-GUID-incident-playbook.md`

---

## 5. Security & Access

### IAM

| Role | Purpose | Permissions | MFA |
|------|---------|-------------|-----|
| Owner (EOA) | Protocol admin | All admin functions, pause/unpause, parameter changes | Hardware wallet recommended |
| Arbitrator | Dispute resolution | Resolve arbitrated disputes only | N/A |
| Authorized Caller | Contract integration | Slash, lock/unlock bonds | Contract-level |
| Solver Operator | Solver management | Manage own solver only | N/A |

**Current owner:** `0x83A5F432f02B1503765bB61a9B358942d87c9dc0` (deployer)

### Secrets Management

**Storage:**
- Private keys: Local `.env` file (not committed)
- RPC URLs: Environment variables
- API keys: Environment variables

**Rotation:**
- No automated rotation currently
- Recommend Gnosis Safe for multisig before mainnet

**Break-glass:**
```bash
# Emergency pause (requires owner key)
cast send $SOLVER_REGISTRY "pause()" --private-key $OWNER_KEY
cast send $INTENT_HUB "pause()" --private-key $OWNER_KEY
cast send $DISPUTE_MODULE "pause()" --private-key $OWNER_KEY
```

### Authorization Model

```
                    OWNER (EOA)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
 SolverRegistry   IntentReceiptHub  DisputeModule
        │               │               │
        │         AUTHORIZED            │
        │◄─────── CALLER ──────────────►│
        │         MAPPING               │
        │                               │
        └──── slash(), lockBond() ─────►│
```

---

## 6. Cost & Performance

### Monthly Costs (Testnet)

| Category | Cost | Notes |
|----------|------|-------|
| RPC (Alchemy) | $0 | Free tier |
| The Graph | $0 | Studio free tier |
| Firebase Hosting | $0 | Free tier |
| **Total** | **$0** | Testnet only |

**Mainnet estimate:** TBD based on usage

### Performance Baseline

**Contract Gas Costs:**
| Function | Gas | ~USD @ 30 gwei |
|----------|-----|----------------|
| registerSolver | ~150,000 | $0.15 |
| depositBond | ~50,000 | $0.05 |
| postReceipt | ~182,000 | $0.18 |
| openDispute | ~145,000 | $0.15 |
| finalize | ~80,000 | $0.08 |
| slash | ~98,000 | $0.10 |

**Contract Sizes:**
| Contract | Runtime (B) | Margin |
|----------|-------------|--------|
| SolverRegistry | 10,589 | 14,187 |
| IntentReceiptHub | 14,252 | 10,324 |
| DisputeModule | 7,268 | 17,308 |
| EscrowVault | 4,305 | 20,271 |
| ReceiptV2Extension | 14,509 | 10,067 |
| OptimisticDisputeModule | 14,312 | 10,264 |

All contracts within 24,576 byte limit.

---

## 7. Current State Assessment

### What's Working

- **308 tests passing** - Comprehensive unit, fuzz, and invariant test coverage
- **Deployed on Sepolia** - Live testnet deployment with verified contracts
- **CI/CD pipeline** - GitHub Actions with tests, lint, security scan
- **SDK and dashboard** - TypeScript SDK and Next.js management UI
- **Comprehensive docs** - 21 architecture docs, incident playbook, deployment runbook
- **Security audit started** - Threat model, invariants defined, Phase 0 complete
- **Community health files** - CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, etc.

### Areas Needing Attention

- **Single EOA owner** - Critical risk, multisig plan documented but not executed
- **No timelock** - Parameter changes are immediate, no delay for review
- **Centralized arbitrator** - Single address controls dispute resolution
- **Open security findings** - 5 HIGH, 5 MEDIUM findings documented but not all fixed
- **Slither not blocking** - CI has `--fail-high` but some findings accepted
- **No formal verification** - Fuzz/invariant tests exist but no Certora/Echidna

### Immediate Priorities

1. **[CRITICAL]** Deploy Gnosis Safe multisig and transfer ownership
   - Impact: Blocks mainnet deployment
   - Owner: Protocol Team
   - Plan: `000-docs/013-OD-GUID-multisig-plan.md`

2. **[HIGH]** Fix remaining HIGH severity security findings
   - Impact: Potential exploits documented in security audit
   - Owner: Protocol Team
   - Findings: IRSB-SEC-001 through IRSB-SEC-005

3. **[MEDIUM]** Implement timelock for parameter changes
   - Impact: Governance hardening before mainnet
   - Owner: Protocol Team
   - Design: Appendix C of security audit doc

---

## 8. Quick Reference

### Command Map

| Capability | Command | Notes |
|------------|---------|-------|
| Build contracts | `forge build` | via_ir enabled, 200 optimizer runs |
| Run all tests | `forge test` | 308 tests, ~30s |
| Run verbose | `forge test -vvv` | Stack traces |
| Run CI-equivalent | `FOUNDRY_PROFILE=ci forge test` | 10k fuzz runs |
| Format check | `forge fmt --check` | Enforced in CI |
| Security check | `./scripts/security.sh` | Build + fmt + test + slither |
| Deploy Sepolia | `forge script script/Deploy.s.sol:DeploySepolia --rpc-url $SEPOLIA_RPC_URL --broadcast` | Requires funded wallet |
| Verify contract | `forge verify-contract <ADDR> <CONTRACT> --chain sepolia` | Requires Etherscan API key |
| Gas report | `forge test --gas-report` | Per-function gas costs |
| Coverage | `forge coverage --report summary` | Line/branch coverage |
| Pause contract | `cast send $CONTRACT "pause()" --private-key $KEY` | Owner only |

### Critical URLs

| Resource | URL |
|----------|-----|
| GitHub Repository | https://github.com/intent-solutions-io/irsb-protocol |
| Dashboard | https://irsb-protocol.web.app |
| Sepolia SolverRegistry | https://sepolia.etherscan.io/address/0xB6ab964832808E49635fF82D1996D6a888ecB745 |
| Sepolia IntentReceiptHub | https://sepolia.etherscan.io/address/0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c |
| Sepolia DisputeModule | https://sepolia.etherscan.io/address/0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D |
| GitHub Discussions | https://github.com/intent-solutions-io/irsb-protocol/discussions |

### Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

### First-Week Checklist

- [ ] Clone repository and verify `forge test` passes locally
- [ ] Review CLAUDE.md for project context
- [ ] Read `000-docs/009-AA-SEC-irsb-security-audit-v1.md` for security state
- [ ] Review deployment records in `deployments/sepolia.json`
- [ ] Access Sepolia Etherscan and verify contract state
- [ ] Run `./scripts/security.sh` to understand security checks
- [ ] Read incident playbook: `000-docs/011-OD-GUID-incident-playbook.md`
- [ ] Understand authorization model (owner, arbitrator, authorized callers)
- [ ] Review open GitHub issues/discussions

---

## 9. Recommendations Roadmap

### Week 1 - Stabilization

**Goals:**
- [ ] Complete multisig deployment on Sepolia
- [ ] Transfer ownership to multisig (2-of-3)
- [ ] Verify multisig can execute all admin functions
- [ ] Update deployment records with multisig address

**Measurable outcomes:**
- Owner of all contracts = Gnosis Safe address
- At least one admin transaction executed via multisig

### Month 1 - Foundation

**Goals:**
- [ ] Fix all HIGH severity security findings (IRSB-SEC-001 through -005)
- [ ] Make Slither blocking in CI (remove false positive exceptions only)
- [ ] Implement formal verification for core invariants (Echidna)
- [ ] Deploy to Polygon Amoy as second testnet
- [ ] Complete SDK npm package publication

**Measurable outcomes:**
- 0 HIGH findings open
- CI fails on Slither high/critical
- Multi-chain testnet deployment live

### Quarter 1 - Strategic

**Goals:**
- [ ] Implement TimelockController for parameter changes
- [ ] Design decentralized arbitration (multiple arbitrators or DAO)
- [ ] Mainnet deployment planning (audit, deployment, monitoring)
- [ ] First external integration (Across, CoW, or similar)
- [ ] ERC/EIP proposal submission for intent accountability standard

**Measurable outcomes:**
- Timelock deployed on Sepolia
- At least one third-party integration in testing
- EIP draft submitted

---

## Appendices

### Glossary

| Term | Definition |
|------|------------|
| Intent | User's desired outcome (e.g., swap 100 USDC for ETH) |
| Solver | Entity that executes intents off-chain |
| Receipt | On-chain proof of intent execution |
| Bond | Staked collateral that can be slashed |
| Challenge | Dispute opened against a receipt |
| Deterministic resolution | Auto-slash for provable violations |
| Escalation | Complex dispute sent to arbitrator |
| IntentScore | Portable reputation score for solvers |

### Reference Links

- [ERC-7683 Intent Standard](https://eips.ethereum.org/EIPS/eip-7683)
- [ERC-8004 Agent Registry](https://eips.ethereum.org/EIPS/eip-8004)
- [x402 HTTP Payment Protocol](https://x402.org)
- [Foundry Book](https://book.getfoundry.sh)
- [The Graph Documentation](https://thegraph.com/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)

### Troubleshooting Playbooks

| Issue | Quick Fix |
|-------|-----------|
| `forge test` fails | Check Foundry version: `foundryup` |
| RPC connection fails | Verify `.env` has valid RPC URL |
| Contract verification fails | Wait longer, check compiler version |
| Gas estimation fails | Increase `--gas-estimate-multiplier` |
| Slither errors | Install: `pip3 install slither-analyzer` |
| Subgraph out of sync | Redeploy: `cd subgraph && graph deploy` |

### Open Questions

1. **Mainnet deployment timeline** - Dependent on multisig + security fixes
2. **Arbitrator selection** - Currently deployer, needs decentralization plan
3. **Token economics** - No native token currently, future consideration
4. **Cross-chain deployment** - Sepolia first, Amoy planned, mainnet chains TBD
5. **Bug bounty program** - No formal program yet, mentioned in SECURITY.md

---

## System Health Score: 78/100

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 9/10 | Clean separation, extensible design |
| Test Coverage | 8/10 | 308 tests, fuzz + invariants |
| Security | 6/10 | Audit started, findings documented, fixes pending |
| Operations | 7/10 | Docs complete, single maintainer risk |
| Documentation | 9/10 | Comprehensive 000-docs, community files |
| CI/CD | 8/10 | Full pipeline, Slither integrated |

**Critical Path to Mainnet:**
1. Multisig deployment and ownership transfer
2. HIGH security finding remediation
3. Timelock implementation
4. External audit (recommended)

---

*Document generated by Claude Code appaudit skill*
*Last updated: 2026-01-29*
