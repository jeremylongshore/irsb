# IRSB Protocol - Threat Model

## Actors

### Trusted Actors
| Actor | Trust Level | Capabilities |
|-------|-------------|--------------|
| Owner | High | Update parameters, set authorized callers, emergency actions |
| Arbitrator | High | Resolve disputes with finality |
| Operator | Medium | Submit settlement proofs |
| AuthorizedCaller | Medium | Slash/lock bonds (IntentReceiptHub, DisputeModule) |

### Untrusted Actors
| Actor | Capabilities |
|-------|--------------|
| Solver | Register, deposit bonds, post receipts, submit evidence |
| User | Create intents, challenge receipts |
| Challenger | Challenge receipts, submit evidence |
| Attacker | Any public function |

## Attack Vectors

### 1. Reentrancy Attacks

**Target**: Bond withdrawal, slashing distribution

**Scenario**: Malicious contract re-enters during ETH transfer

**Mitigations**:
- Checks-Effects-Interactions pattern
- State updates before external calls
- Consider ReentrancyGuard for critical functions

**Files to Review**:
- `SolverRegistry.sol`: `withdrawBond()`, `_distributeSplash()`
- `IntentReceiptHub.sol`: `_distributeSlash()`
- `DisputeModule.sol`: `_distributeArbitrationSlash()`

---

### 2. Signature Replay/Forgery

**Target**: Receipt posting

**Scenario**:
- Replay valid signature on different chain
- Forge signature with weak verification

**Mitigations**:
- Include chain ID in signed message
- Include nonce/intent hash (unique per intent)
- Use EIP-712 typed data (recommended upgrade)

**Files to Review**:
- `IntentReceiptHub.sol`: `postReceipt()`, signature verification logic

---

### 3. Front-Running

**Target**: Challenge submission, evidence submission

**Scenario**:
- Attacker sees pending challenge, front-runs with own challenge
- Attacker sees evidence, submits contradicting evidence first

**Mitigations**:
- Challenge bond provides economic disincentive
- Evidence is additive (both parties can submit)
- First-come-first-served is intentional design

**Impact**: Low - economic incentives align behavior

---

### 4. Timestamp Manipulation

**Target**: Deadline calculations, window expirations

**Scenario**: Miner manipulates block timestamp to:
- Expire deadlines early
- Extend challenge windows

**Mitigations**:
- Windows are hours/days (not seconds)
- 15-second variance is negligible
- Use block numbers for stricter timing (optional)

**Files to Review**:
- `IntentReceiptHub.sol`: `challengeWindow`, `deadline` checks
- `DisputeModule.sol`: `evidenceDeadline`, `arbitrationTimeout`

---

### 5. Denial of Service

**Target**: Registry operations, dispute processing

**Scenario**:
- Fill storage with junk registrations
- Spam challenges to exhaust gas
- Create unbounded loops

**Mitigations**:
- Minimum bond requirement (0.1 ETH)
- Challenger bond requirement (10%)
- No unbounded loops in contract code
- Pagination for off-chain queries

**Files to Review**:
- All contracts: Check for unbounded iterations

---

### 6. Economic Attacks

**Target**: Slashing mechanism, bond economics

**Scenario A - Griefing**:
- Attacker challenges valid receipts to lock solver bonds
- Attacker loses challenger bond but causes damage

**Mitigation**: 10% challenger bond makes griefing expensive

**Scenario B - Insufficient Slash**:
- Solver extracts more value than bond covers
- Slash doesn't compensate victim fully

**Mitigation**:
- Minimum bond requirement
- Reputation damage is additional deterrent
- Protocol can increase minimum bond

**Scenario C - Flash Loan Attack**:
- Borrow funds, register as solver, exploit, repay

**Mitigation**:
- 7-day withdrawal cooldown prevents instant exit
- Registration doesn't grant immediate privileges

---

### 7. Access Control Bypass

**Target**: Slashing, bond locking, admin functions

**Scenario**: Unauthorized caller triggers privileged action

**Mitigations**:
- `onlyOwner` modifier for admin functions
- `authorizedCaller` mapping for cross-contract calls
- Explicit authorization checks

**Files to Review**:
- `SolverRegistry.sol`: `slash()`, `lockBond()`, `setAuthorizedCaller()`
- `DisputeModule.sol`: `resolveArbitration()` (arbitrator only)

---

### 8. Integer Overflow/Underflow

**Target**: Bond calculations, percentage splits

**Scenario**: Overflow causes incorrect slashing amounts

**Mitigations**:
- Solidity 0.8+ has built-in overflow checks
- Explicit bounds on percentages (max 10000 BPS)

**Files to Review**:
- All percentage calculations
- Bond amount arithmetic

---

### 9. Cross-Contract State Inconsistency

**Target**: SolverRegistry ↔ IntentReceiptHub ↔ DisputeModule

**Scenario**:
- Receipt posted for deregistered solver
- Dispute created for finalized receipt

**Mitigations**:
- Check solver status before receipt posting
- Check receipt status before dispute creation
- Atomic state transitions where possible

**Files to Review**:
- All cross-contract calls
- State synchronization logic

---

### 10. Centralization Risks

**Target**: Owner, Arbitrator roles

**Scenario**:
- Owner becomes malicious/compromised
- Arbitrator colludes with party

**Mitigations**:
- Owner actions are transparent (on-chain)
- Consider timelock for parameter changes
- Consider multi-sig for owner
- Arbitrator selection process (off-chain governance)

**Recommendations**:
- Add timelock for critical parameter changes
- Document owner key management
- Consider arbitrator rotation/selection mechanism

---

## Invariants

### SolverRegistry Invariants

1. `totalBonded >= sum(solverBonds)` - Total tracked matches actual bonds
2. `solver.jailCount <= MAX_JAILS` - Jail count bounded
3. `solver.status == BANNED => solver.jailCount == MAX_JAILS` - Ban only after max jails
4. `pendingWithdrawal > 0 => withdrawalRequestTime > 0` - Withdrawal state consistency
5. `solver.bondAmount >= MINIMUM_BOND || solver.status != ACTIVE` - Active solvers have min bond

### IntentReceiptHub Invariants

1. `receipt.status == FINALIZED => block.timestamp > receipt.challengeDeadline` - Finalization timing
2. `receipt.status == CHALLENGED => challenge.bond > 0` - Challenged receipts have bond
3. `receipt.solver == registered solver` - Only registered solvers post receipts
4. `challengerBond >= slashAmount * CHALLENGER_BOND_BPS / 10000` - Bond meets minimum

### DisputeModule Invariants

1. `dispute.status == RESOLVED => resolution != NONE` - Resolved disputes have outcome
2. `dispute.evidenceDeadline > dispute.createdAt` - Valid evidence window
3. `dispute.arbitrator == address(0) || dispute.status >= ESCALATED` - Arbitrator only after escalation

---

## Recommended Audit Focus

### Critical (Must Review)
1. All ETH transfer logic (reentrancy)
2. Signature verification (forgery)
3. Access control modifiers (bypass)
4. Slashing calculations (correctness)

### High (Should Review)
5. State machine transitions
6. Cross-contract interactions
7. Deadline/timeout logic
8. Bond accounting

### Medium (Good to Review)
9. Event emissions (for indexing)
10. Error messages (information leakage)
11. Gas optimization opportunities
12. Code clarity/maintainability

---

## Security Checklist

- [ ] Reentrancy guards on all external calls
- [ ] Access control on all privileged functions
- [ ] Input validation on all public functions
- [ ] Safe math for all calculations
- [ ] Signature verification uses ecrecover correctly
- [ ] No unbounded loops
- [ ] State changes before external calls
- [ ] Events emitted for all state changes
- [ ] No hardcoded addresses (except constants)
- [ ] Proper use of `payable` keyword
