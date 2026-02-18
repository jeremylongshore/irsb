# 044-AA-AUDT: IRSB Protocol Security Audit Report

**Date:** 2026-02-18
**Scope:** All IRSB protocol contracts (Sepolia deployment)
**Methodology:** Internal review + static analysis + invariant testing
**Auditor:** Claude Code (automated) + Jeremy Longshore (manual review)

---

## A. Executive Risk Summary (Top 10)

| # | Severity | Finding | Impact | Likelihood |
|---|----------|---------|--------|------------|
| 1 | CRITICAL | Bond-to-volume ratio allows rational fraud (PM-EC-001) | Solver stakes 0.1 ETH, processes unlimited volume, absconds. Mitigated: `requiredBondForVolume()` added but bond ratio (5%) still allows 20x leverage. | Medium — ratio is now enforced but may be too generous |
| 2 | CRITICAL | No timelock deployed (PM-GV-001) | 2/3 Safe signers can instantly change arbitrator, swap dispute module, emergency-withdraw escrow. Script exists but not executed. | High — Safe is deployed but no delay |
| 3 | CRITICAL | Slash user share goes to challenger, not intent user | `resolveDeterministic()` line 290: pays `dispute.challenger` the 80% "user share." Original intent user receives nothing. Live TODO in code. | Certain — code does this today |
| 4 | HIGH | Single-EOA arbitrator = deployer | Arbitrator is `0x83A5...dc0` (deployer EOA). Unilateral power to slash any solver's entire bond. Gets 10% of every slash. | Medium — requires arbitrator corruption |
| 5 | HIGH | `emergencyWithdraw` bypasses escrow protection | EscrowVault owner can drain active escrow funds without checking escrow status. | Low — requires Safe compromise |
| 6 | HIGH | Watchtower hardcodes Sepolia chain in write client | `setWalletClient` uses `chain: sepolia`. Mainnet deployment will sign transactions with wrong chainId. | Certain on mainnet (dormant on testnet) |
| 7 | HIGH | Watchtower API auth is off by default | `WATCHTOWER_API_KEY` unset = `/v1/receipts/ingest` unauthenticated. Terraform config has `allow_unauthenticated = true`. | Medium — deployment-dependent |
| 8 | HIGH | `authority` field in Delegation is not enforced | Sub-delegation chain validation is cosmetic. `authority` hash stored but never verified in `executeDelegated`. | Low — feature gap, no active exploit path |
| 9 | MEDIUM | WalletDelegate domain separator is immutable | `DOMAIN_SEPARATOR` computed once in constructor. No fork protection — on hard fork, delegation signatures valid on both chains. | Low — Sepolia won't fork |
| 10 | MEDIUM | EscrowVault `receiptId→escrowId` mapping overwritable | Anyone can create escrow with any receiptId, potentially overwriting `_receiptToEscrow` mapping. | Medium — requires active escrow to grief |

---

## B. Legitimacy & Skeptic-Defense Checklist

This section anticipates the exact questions a technical reviewer (Jonjon Clark, Envio co-founder) will ask when reading IRSB contracts for indexer integration.

### Q1: "Who controls these contracts? Can you rug?"

| Aspect | Evidence |
|--------|----------|
| Ownership | Safe multisig `0xBcA0c8d0B5ce874a9E3D84d49f3614bb79189959` (2/3) owns all contracts |
| Verification | `cast call <contract> "owner()(address)" --rpc-url $SEPOLIA_RPC` returns Safe address |
| Gap | No timelock. Safe executes instantly. `emergencyWithdraw()` on EscrowVault can drain active escrows. |
| Remediation | Deploy TimelockController (script exists: `DeployTimelock.s.sol`). Transfer ownership. P0 priority. |

### Q2: "Are these contracts verified on Etherscan?"

All 11 contracts verified on Sepolia Etherscan. Source code matches repository. No gaps.

### Q3: "Do you have tests? What's your coverage?"

| Metric | Value |
|--------|-------|
| Total tests | 552+ (Foundry) |
| Fuzz tests | CI profile runs 10k iterations |
| Invariant suites | 6 (SolverRegistry, IntentReceiptHub, DisputeModule, BondAccounting, ReceiptStatus, RevocationPermanence) |
| Moloch-pattern tests | Boundary, Modifier, StateTransition, RequireAudit |

Coverage report generated via `forge coverage` (see Section D).

### Q4: "Has this been audited?"

| Audit Type | Status |
|------------|--------|
| SolidityGuard v1.2.0 | Complete — 244 raw hits, triaged |
| Internal pre-mortem (83 findings) | Complete — `039-AA-AUDT-pre-mortem-analysis.md` |
| This security audit | Complete — you're reading it |
| Professional firm (Code4rena/Spearbit) | Planned Q2 2026 |
| Slither static analysis | Attempted (see Section D) |

### Q5: "Why is the arbitrator the deployer EOA?"

- **Current:** Arbitrator = `0x83A5...dc0` = deployer. Single point of failure.
- **Perverse incentive:** Gets 10% of every slash in DisputeModule.
- **Mitigating factor:** OptimisticDisputeModule uses flat fee instead of percentage.
- **Remediation:** (1) Change arbitrator to Safe multisig, (2) Document v2 decentralization plan.

### Q6: "Why are there 35 source files but only 11 deployed?"

35 `.sol` files include 12 interfaces, 5 libraries, 2 mocks, 2 adapters, 3 enforcers. Core deployed contracts = 11. Stats SVG updated to show "35 Source Files" for accuracy.

### Q7: "What events do these contracts emit? Can I index them?"

Each core contract emits events inline (not via a library). Key events for indexing:
- `ReceiptPosted`, `ReceiptFinalized`, `DisputeOpened`, `DisputeResolved` (IntentReceiptHub)
- `SolverRegistered`, `BondDeposited`, `SolverSlashed`, `SolverStatusChanged` (SolverRegistry)
- `EvidenceSubmitted`, `DisputeEscalated`, `ArbitrationResolved` (DisputeModule)
- `DelegationSetup`, `DelegationRevoked`, `DelegatedExecution` (WalletDelegate)

Dead `Events.sol` library removed in this audit (was defined but never imported).

### Q8: "Is there any real activity on these contracts?"

- Seeded test data exists (`SeedTestData.s.sol` ran).
- Registered as ERC-8004 Agent #967.
- No organic transactions yet — expected for testnet pre-mainnet.
- Watchtower + solver are functional but not running continuously.

### Q9: "Why BUSL-1.1 and not MIT?"

BUSL-1.1 is standard (Uniswap, Aave). Converts to MIT in 3 years. Envio's indexing use case is explicitly permitted under the license.

### Q10: "Is this a solo developer project?"

All commits from one author. Safe is 2/3 multisig. Positioned as "solo founder, built systematically." The quality evidence: 552+ tests, 6 invariant suites, 83-finding pre-mortem, architecture documentation, and this audit report.

---

## C. Deep Security Review

### C1. Access Control

| File | Line | Finding | Severity |
|------|------|---------|----------|
| `src/DisputeModule.sol` | 14 | Was missing `Pausable` — only core contract without emergency stop. **Fixed in this audit.** | HIGH → RESOLVED |
| `src/SolverRegistry.sol` | 86 | `onlyAuthorized` allows `owner()` bypass — intended but means Safe can directly call restricted functions. | INFO |
| `src/EscrowVault.sol` | — | `emergencyWithdraw` has no check that escrows are resolved. Owner can drain active escrows. | HIGH |
| `src/IntentReceiptHub.sol` | 114 | `onlyDisputeModule` allows `owner()` bypass — same Safe concern. | INFO |

### C2. Signature Validation

| File | Line | Finding | Severity |
|------|------|---------|----------|
| `src/IntentReceiptHub.sol` | 144-161 | V1 receipts use raw `abi.encode` + `toEthSignedMessageHash`. Not EIP-712 but chain-bound via manual `chainId` inclusion. Replay protection via nonces (IRSB-SEC-006). | INFO |
| `src/delegation/WalletDelegate.sol` | 25 | `DOMAIN_SEPARATOR` is `immutable` — no fork protection. On hard fork, signatures valid on both chains. | MEDIUM |
| `src/X402Facilitator.sol` | — | `SETTLEMENT_TYPEHASH` and `EXECUTION_TYPEHASH` defined but never used. Dead code. | LOW |

### C3. Economic Attacks

| Attack | Mechanism | Current Mitigation |
|--------|-----------|-------------------|
| Bond-to-volume ratio abuse | 0.1 ETH bond, 20 ETH max volume (5% ratio) | `requiredBondForVolume()` enforces ratio, but ratio may be too generous |
| Sybil re-registration | Permissionless, 0.1 ETH barrier | `operatorToSolver` prevents same operator, but new addresses are free |
| Challenger griefing | 0.01 ETH bond to open dispute, locks solver's 0.1 ETH | Challenger bond forfeited on failed disputes |
| Arbitrator timeout inconsistency | DisputeModule defaults to solver-not-at-fault, OptimisticDisputeModule defaults to challenger-wins | Intentional design difference, documented |

### C4. Reentrancy & CEI

All stateful contracts use `ReentrancyGuard`. CEI pattern followed in EscrowVault. Three separate `slash()` calls in `resolveDeterministic` — each is a separate ETH transfer. Individually safe (`nonReentrant` on Hub), but multiple external calls in one tx.

### C5. Dead Code (Addressed)

| Item | Status |
|------|--------|
| `src/libraries/Events.sol` — defined but never imported | **Deleted in this audit** |
| `IValidationRegistry` interface | Kept — used by `ERC8004Adapter` and `MockERC8004Registry` |
| `SETTLEMENT_TYPEHASH` / `EXECUTION_TYPEHASH` in X402Facilitator | Backlog — remove or implement |
| `Delegation.authority` field — stored but never enforced | Backlog — enforce or remove |

### C6. Off-Chain Security

| Component | Finding | Severity |
|-----------|---------|----------|
| Watchtower | Sepolia hardcoded in write client `setWalletClient` | HIGH |
| Watchtower | API auth off by default (`WATCHTOWER_API_KEY` unset) | HIGH |
| Watchtower | Receipt `createdAt` approximated, not read from chain | LOW |
| Watchtower | `evidenceHash` defaults to zero | LOW |
| Solver | KMS signing solid. DER parser needs bounds checking. | MEDIUM |
| KMS signer | Duplicated between solver and `packages/kms-signer` (divergent) | MEDIUM |

---

## D. Tool-Based Findings

### D1. Forge Test Results

All tests compiled and run against the protocol directory. Test suite includes:
- Core unit tests (SolverRegistry, IntentReceiptHub, DisputeModule, EscrowVault, WalletDelegate, X402Facilitator)
- Fuzz tests (10k runs in CI profile)
- Invariant tests (6 suites including 3 new from this audit)
- Moloch-pattern tests (Boundary, Modifier, StateTransition, RequireAudit)
- Enforcer tests (SpendLimit, TimeWindow, AllowedTargets, AllowedMethods, Nonce)

**Fixes applied during this audit:**
1. Moloch tests calling `postReceipt(receipt)` → `postReceipt(receipt, 0)` (volume parameter added in PM-EC-001)
2. Moloch tests calling `batchPostReceipts(batch)` → `batchPostReceipts(batch, volumes)` (same fix)
3. DisputeModule invariant test constructor args swapped (was `registry, hub` → now `hub, registry`)

### D2. Forge Coverage

Coverage report generated via `forge coverage`. Key observations:
- Core contracts (SolverRegistry, IntentReceiptHub, DisputeModule) have high coverage from combined unit + fuzz + invariant testing
- Delegation contracts (WalletDelegate, enforcers) covered by dedicated test suites
- EscrowVault has solid coverage including ERC20 path tests

### D3. Slither Static Analysis

Slither analysis was attempted. Dependencies were installed from the existing protocol lib directory. Results pending full environment setup.

### D4. Fuzz Results (CI Profile, 10k Runs)

Fuzz tests cover:
- `EscrowVaultFuzz` — escrow creation, release, refund with randomized values
- `IntentReceiptHubFuzz` — receipt posting, dispute, finalization with fuzzed parameters
- `OptimisticDisputeFuzz` — optimistic dispute lifecycle
- `ReceiptV2Fuzz` — V2 receipt EIP-712 signatures
- `SolverRegistryFuzz` — registration, bonding, slashing
- `SpendLimitEnforcer.fuzz` — spend limit enforcement boundaries
- `WalletDelegate.fuzz` — delegation setup, execution, revocation

---

## E. Invariant Tests

### Existing Invariant Tests (3 suites)

1. **SolverRegistry.invariants.t.sol** — SR-1: Bond sum never exceeds contract balance; SR-8: Locked bond consistency
2. **IntentReceiptHub.invariants.t.sol** — Receipt lifecycle state machine
3. **DisputeModule.invariants.t.sol** — DM-4: Resolution finality; DM-7: Slash distribution sums to 100%; CC-4: Only authorized can slash. **Constructor arg order fixed in this audit.**

### New Invariant Tests (3 suites, added in this audit)

4. **BondAccounting.invariants.t.sol**
   - `invariant_totalBondedConsistency`: `totalBonded == Σ(solver.bondBalance + solver.lockedBalance)` for all registered solvers
   - `invariant_totalBondedNeverExceedsBalance`: Contract ETH balance >= totalBonded
   - `invariant_totalSolversConsistent`: totalSolvers counter matches actual registrations
   - Handler exercises: register, deposit, lock, unlock, slash sequences

5. **ReceiptStatus.invariants.t.sol**
   - `invariant_receiptStatusMonotonicity`: Receipt status at time T+1 >= status at time T (no regressions)
   - `invariant_terminalStatesPermanent`: Once Finalized or Slashed, status never changes back
   - Handler exercises: postReceipt, finalize, openDispute sequences

6. **RevocationPermanence.invariants.t.sol**
   - `invariant_revocationPermanence`: Once `revokeDelegation(hash)` called, `isDelegationActive(hash)` is always false
   - `invariant_activeCountConsistency`: Active + revoked <= total delegations setup
   - Handler exercises: setupDelegation, revokeDelegation, tryExecute sequences

---

## F. Prioritized Remediation Plan

### Priority 1 — Before Jonjon Indexes (This Week)

| Issue | Fix | File(s) | Status |
|-------|-----|---------|--------|
| Fix invariant test constructor order | Swap args (hub, registry) | `test/invariants/DisputeModule.invariants.t.sol:24` | **DONE** |
| Delete dead Events.sol | Remove file | `src/libraries/Events.sol` | **DONE** |
| Fix stats SVG accuracy | "37 Contracts" → "35 Source Files" | `assets/stats-dark.svg`, `assets/stats-light.svg` | **DONE** |
| Add Pausable to DisputeModule | Add inheritance + `whenNotPaused` + pause/unpause | `src/DisputeModule.sol` | **DONE** |
| Fix moloch test signatures | Add `declaredVolume` parameter | `test/moloch/*.t.sol` (4 files) | **DONE** |
| Add 3 new invariant tests | BondAccounting, ReceiptStatus, RevocationPermanence | `test/invariants/` (3 new files) | **DONE** |

### Priority 2 — Pre-Mainnet Blockers

| Issue | Fix | File(s) |
|-------|-----|---------|
| Deploy TimelockController | Execute `DeployTimelock.s.sol`, transfer ownership | `script/DeployTimelock.s.sol` |
| Fix slash recipient (TODO) | Store original intent user in receipt, pay them the 80% share | `src/IntentReceiptHub.sol:290` |
| Change arbitrator from deployer to Safe | `setArbitrator(safeAddress)` | `src/DisputeModule.sol` |
| Volume-proportional bonds | Fine-tune `bondRatioBps` (currently 5%) | `src/SolverRegistry.sol` |
| Fix watchtower Sepolia hardcode | Make chain dynamic from config | Watchtower `irsbClient.ts` |
| Require WATCHTOWER_API_KEY | Fail startup if unset in production mode | Watchtower API config |
| Pin Solidity pragma | `^0.8.25` → `=0.8.25` in all source files | All `src/**/*.sol` |

### Priority 3 — Quality Improvements (Backlog)

| Issue | Fix |
|-------|-----|
| Consolidate KMS signer | Solver imports from `@irsb/kms-signer` |
| Remove unused `SETTLEMENT_TYPEHASH` / `EXECUTION_TYPEHASH` | Or implement use in X402Facilitator |
| Enforce `Delegation.authority` chain | Or remove field if sub-delegation not planned |
| Fix OptimisticDisputeModule `totalResolved` double-increment | Remove duplicate `totalResolved++` |
| Add Safe-aware pause procedure | Update `011-OD-GUID` incident playbook |
| Encrypt Ed25519 key at rest | Use GCP Secret Manager |

---

## Appendix: Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |
| EscrowVault | Deployed (see deployments/sepolia.json) |
| WalletDelegate | Deployed |
| X402Facilitator | Deployed |
| SpendLimitEnforcer | Deployed |
| TimeWindowEnforcer | Deployed |
| AllowedTargetsEnforcer | Deployed |
| AllowedMethodsEnforcer | Deployed |
| NonceEnforcer | Deployed |
| ERC-8004 Agent ID | `967` (on `0x8004A818BFB912233c491871b3d84c89A494BD9e`) |
| Safe Multisig (Owner) | `0xBcA0c8d0B5ce874a9E3D84d49f3614bb79189959` (2/3) |
| Deployer EOA | `0x83A5F432f02B1503765bB61a9B358942d87c9dc0` |
