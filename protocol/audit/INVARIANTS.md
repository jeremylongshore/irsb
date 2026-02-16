# IRSB Protocol - Contract Invariants

Formal invariants that must hold for the protocol to function correctly.

---

## SolverRegistry Invariants

### SR-1: Bond Accounting
```
∀ solver: solvers[solver].bondAmount <= address(this).balance
```
The sum of all solver bonds cannot exceed the contract's ETH balance.

### SR-2: Active Solver Minimum Bond
```
∀ solver: solvers[solver].status == ACTIVE → solvers[solver].bondAmount >= MINIMUM_BOND
```
Active solvers must maintain at least the minimum bond.

### SR-3: Jail Count Bounds
```
∀ solver: solvers[solver].jailCount <= MAX_JAILS
```
Jail count is bounded by MAX_JAILS (3).

### SR-4: Ban Condition
```
∀ solver: solvers[solver].status == BANNED → solvers[solver].jailCount == MAX_JAILS
```
Solvers are only banned after reaching max jails.

### SR-5: Withdrawal State Consistency
```
∀ solver: solvers[solver].pendingWithdrawal > 0 ↔ solvers[solver].withdrawalRequestTime > 0
```
Pending withdrawal amount and request time must be consistent.

### SR-6: Withdrawal Cooldown
```
∀ solver: canWithdraw(solver) → block.timestamp >= solvers[solver].withdrawalRequestTime + WITHDRAWAL_COOLDOWN
```
Withdrawals only allowed after cooldown period.

### SR-7: Reputation Bounds
```
∀ solver: 0 <= solvers[solver].reputation <= MAX_REPUTATION
```
Reputation score is bounded.

### SR-8: Locked Bond Constraint
```
∀ solver: solvers[solver].lockedAmount <= solvers[solver].bondAmount
```
Locked amount cannot exceed total bond.

---

## IntentReceiptHub Invariants

### IRH-1: Receipt Uniqueness
```
∀ intentHash: receipts[intentHash].solver != address(0) → receipt exists and is unique
```
Each intent hash maps to at most one receipt.

### IRH-2: Solver Registration
```
∀ receipt: receipt.status != NONE → solverRegistry.isRegistered(receipt.solver)
```
Receipts can only be posted by registered solvers.

### IRH-3: Challenge Window
```
∀ receipt: receipt.challengeDeadline == receipt.postedAt + challengeWindow
```
Challenge deadline is deterministic from post time.

### IRH-4: Finalization Timing
```
∀ receipt: receipt.status == FINALIZED → block.timestamp > receipt.challengeDeadline
```
Receipts can only be finalized after challenge window expires.

### IRH-5: Challenge Bond Minimum
```
∀ challenge: challenge.bond >= (slashAmount * CHALLENGER_BOND_BPS) / 10000
```
Challenger must post minimum bond.

### IRH-6: Slash Distribution Total
```
∀ slash: userShare + challengerShare + treasuryShare == slashAmount
```
Slash distribution accounts for 100% of slashed amount.

### IRH-7: Status Transitions
```
NONE → POSTED → {FINALIZED, CHALLENGED}
CHALLENGED → {RESOLVED_VALID, RESOLVED_INVALID, ESCALATED}
```
Receipt status follows valid state machine.

### IRH-8: Signature Validity
```
∀ receipt: ecrecover(receiptHash, receipt.solverSig) == receipt.solver
```
Receipt signature must be valid from the claimed solver.

---

## DisputeModule Invariants

### DM-1: Dispute Uniqueness
```
∀ intentHash: disputes[intentHash].status != NONE → dispute exists and is unique
```
Each intent hash maps to at most one dispute.

### DM-2: Evidence Window
```
∀ dispute: dispute.evidenceDeadline == dispute.createdAt + EVIDENCE_WINDOW
```
Evidence deadline is deterministic.

### DM-3: Arbitration Timeout
```
∀ dispute: dispute.status == ESCALATED →
  dispute.arbitrationDeadline == dispute.escalatedAt + ARBITRATION_TIMEOUT
```
Arbitration has bounded timeout.

### DM-4: Resolution Finality
```
∀ dispute: dispute.status == RESOLVED → dispute cannot transition to any other status
```
Resolution is final.

### DM-5: Arbitrator Authority
```
∀ resolution: resolveArbitration(intentHash, outcome) → msg.sender == arbitrator
```
Only arbitrator can resolve arbitrated disputes.

### DM-6: Evidence Submission Window
```
∀ evidence: submitEvidence(intentHash, ...) → block.timestamp <= disputes[intentHash].evidenceDeadline
```
Evidence only accepted within window.

### DM-7: Slash Distribution (Arbitration)
```
∀ arbitrationSlash: userShare + treasuryShare + arbitratorShare == slashAmount
```
Arbitration slash accounts for 100%.

### DM-8: Dispute Prerequisite
```
∀ dispute: dispute.status != NONE → receipts[intentHash].status == CHALLENGED
```
Disputes only exist for challenged receipts.

---

## Cross-Contract Invariants

### CC-1: Authorization Consistency
```
∀ contract ∈ {IntentReceiptHub, DisputeModule}:
  contract.canSlash() → solverRegistry.authorizedCaller[contract]
```
Slashing requires explicit authorization.

### CC-2: Bond Locking Symmetry
```
∀ lock: lockBond(solver, amount) → ∃ future unlock: unlockBond(solver, amount)
```
Locked bonds must eventually be unlocked or slashed.

### CC-3: Receipt-Dispute Linkage
```
∀ dispute: disputes[hash].status != NONE → receipts[hash].status == CHALLENGED
```
Disputes are tied to challenged receipts.

### CC-4: Slash Source Validity
```
∀ slash: SolverRegistry.slash(solver, amount, reason) →
  msg.sender ∈ {IntentReceiptHub, DisputeModule, owner}
```
Slashes only from authorized sources.

---

## Economic Invariants

### EC-1: No Value Creation
```
∑ withdrawals + ∑ slashDistributions <= ∑ deposits
```
Protocol cannot create ETH.

### EC-2: Challenger Risk/Reward
```
∀ invalidChallenge: challenger loses challenger bond
∀ validChallenge: challenger receives challengerShare
```
Challenger economics are symmetric.

### EC-3: User Compensation Priority
```
∀ slash: userShare >= treasuryShare + challengerShare
```
Users receive majority of slashed funds.

### EC-4: Minimum Economic Security
```
∀ solver: maxPotentialLoss(solver) <= solver.bondAmount
```
Solver loss is bounded by bond.

---

## Verification Approach

### Formal Verification (Recommended)
- Certora for invariant checking
- Echidna for property-based fuzzing
- Foundry invariant tests

### Test Coverage
Each invariant should have:
1. Positive test (invariant holds in normal operation)
2. Negative test (violation is prevented/reverts)
3. Edge case test (boundary conditions)

### Monitoring (Post-Deployment)
- Emit events for all state transitions
- Index events for invariant monitoring
- Alert on potential violations
