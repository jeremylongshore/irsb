# Protocol Proposal: Solver Accountability Layer for Intents

**Working name:** IRSB — Intent Receipts & Solver Bonds
**Tagline:** "Intents need receipts. Solvers need skin in the game."

This protocol plugs the biggest gap in the intent ecosystem: credible enforcement. ERC-7683 standardizes cross-chain intents; IRSB standardizes accountability for whoever executes them.

---

## 1. Core Concepts

### 1.1 Intent Receipt

A canonical, on-chain-verifiable record that a solver claims "I executed this intent under these constraints and produced this outcome."

Receipt binds:
- what was requested (intentHash)
- what constraints were promised (constraintsHash)
- what route/path was used (routeHash)
- what outcome was achieved (outcomeHash)
- where evidence lives (evidenceHash)
- who is responsible (solverId, solverSig)

### 1.2 Solver Bonds (Economic Accountability)

Solvers stake collateral to participate. Collateral can be slashed for:
- provable constraint violation
- provable non-delivery (timeout)
- forged/mismatched receipts

This is the missing "enforcement primitive" that makes intents production-safe as usage grows.

### 1.3 Deterministic vs Non-Deterministic Disputes

- **Deterministic:** contract can verify (timeout, wrong token out, minOut violated, wrong chain settlement, receipt mismatch).
- **Non-deterministic:** requires judgement (UX "did you fulfill the spirit?"), kept minimal and modular.

---

## 2. On-Chain Interface (Spec v0.1)

### 2.1 Contracts

1. **SolverRegistry**
   - registers solvers
   - manages stake / bond balances
   - tracks solver status (active/jailed/banned)

2. **IntentReceiptHub**
   - posts and indexes receipts
   - validates signatures + schema
   - manages dispute windows + timeouts
   - triggers deterministic slashing

3. **DisputeModule (pluggable)**
   - optional: arbitration/court adapters for non-deterministic cases
   - upgradeable via governance (or admin in v0.1)

### 2.2 Key Structs (Canonical)

**IntentReceipt**
- bytes32 intentHash
- bytes32 constraintsHash
- bytes32 routeHash
- bytes32 outcomeHash
- bytes32 evidenceHash
- uint64 createdAt
- uint64 expiry
- bytes32 solverId
- bytes solverSig

**ConstraintEnvelope** (off-chain canonical encoding that hashes to constraintsHash)
- chainIds[]
- tokensIn[]
- tokensOut[]
- minOut[] / maxSlippageBps
- deadline
- allowedVenues[] (optional)
- requiredProofs[] (optional)

**OutcomeEnvelope** (hashes to outcomeHash)
- finalChainId
- tokenOut
- amountOut
- recipient
- txHashes[] (or settlement refs)

### 2.3 Core Functions (Minimal)

**SolverRegistry**
- registerSolver(metadataURI, operatorAddr)
- depositBond(solverId, amount)
- withdrawBond(solverId, amount) (only if no active disputes)
- setSolverKey(solverId, operatorAddr) (rotation)

**IntentReceiptHub**
- postReceipt(IntentReceipt receipt)
- openDispute(bytes32 receiptId, uint8 reasonCode, bytes evidenceRef)
- resolveDeterministic(bytes32 receiptId) (slashing/refund logic)
- finalize(bytes32 receiptId) (marks as settled, updates reputation)

---

## 3. Slashing + Settlement Rules

### 3.1 Deterministic Slashing Conditions (v0.1)

1. **Timeout / Non-delivery**
   - If expiry passes without valid settlement proof → slash solver bond.

2. **Constraint violation**
   - If posted receipt claims an outcome that violates constraintsHash (e.g., amountOut < minOut) → slash.

3. **Receipt mismatch / forgery**
   - Invalid solverSig or receipt fields not canonical → reject + optionally jail.

### 3.2 Payout Flows

- **User protection:** on solver failure, user is compensated from solver bond (up to cap), with any remaining handled via integrator policy.
- **Solver incentive:** solver only earns fees after receipt finalization.

---

## 4. Evidence Bundle Standard (Off-chain, Hash-on-chain)

Evidence is a first-class protocol primitive: evidenceHash points to a canonical bundle (IPFS/Arweave/R2/GCS). Minimum bundle for crosschain intents:
- intent payload (canonical encoding)
- resolution route details
- settlement tx hashes
- receipts/proofs from involved chains
- solver signature + timestamp

This is what turns disputes from "opinions" into "cases."

---

## 5. Reputation: IntentScore for Solvers

A protocol-native reputation score computed from:
- fill success rate
- time-to-finalization
- disputes per volume
- dispute loss rate
- severity-weighted slashing events

Reputation is queryable on-chain (simple counters) and off-chain (rich analytics).

---

## 6. ERC-7683 Integration Path

ERC-7683 defines cross-chain intent structures and settlement interfaces. IRSB sits next to it:
- When an ERC-7683 order is opened, the solver posts an IRSB receipt referencing intentHash derived from the ERC-7683 order struct.
- When settlement completes, solver posts outcome proofs → receipt finalizes.

This positions IRSB as the accountability layer for ERC-7683-style filler networks.

---

## 7. Why This Is "Ethereum-needed" Now

- Intents are standardizing (ERC-7683) and UX is pushing toward abstraction (EIP-7702 in Pectra enables more powerful smart-account flows).
- Faster UX patterns like preconfirmations/based rollups increase the importance of economically binding guarantees.
- Accountability primitives are the missing substrate that makes "solver-driven everything" safe at scale.

---

## 8. Build Plan (Tight, Shippable)

### 0–30 days: Spec + MVP contracts
- Finalize receipt schema + canonical encoding rules
- Implement SolverRegistry + IntentReceiptHub
- Deterministic slashing for timeout + minOut violation
- Minimal indexer + explorer page

### 31–60 days: First integration
- Integrate with one ERC-7683-compatible intent flow (or a simplified crosschain intent demo)
- Evidence bundling pipeline
- Basic reputation counters

### 61–90 days: Hardening + adoption
- Add DisputeModule interface (pluggable arbitration)
- Add solver key rotation + jailed states
- Publish "IRSB v0.1" as an ERC-style spec + reference implementation

---

## Next Steps

The next output can be the full "EIP-style" spec text (Abstract, Motivation, Specification, Rationale, Security Considerations, Reference Implementation), plus exact event definitions and reason codes.
