# IRSB Protocol - Security Audit Scope

## Overview

IRSB (Intent Receipts & Solver Bonds) is an accountability layer for intent-based transactions on Ethereum. It provides cryptographic receipts, bonded collateral, and deterministic dispute resolution for ERC-7683 intent solvers.

## Contracts in Scope

| Contract | SLOC | Description |
|----------|------|-------------|
| `SolverRegistry.sol` | ~350 | Solver registration, bond management, slashing |
| `IntentReceiptHub.sol` | ~300 | Receipt posting, challenges, deterministic resolution |
| `DisputeModule.sol` | ~250 | Evidence submission, arbitration, complex disputes |

**Total**: ~900 SLOC

## Out of Scope

- Frontend dashboard code
- Deployment scripts
- Test files
- External dependencies (OpenZeppelin)

## Contract Addresses (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│ SolverRegistry  │◄────────► IntentReceiptHub │
├─────────────────┤         ├──────────────────┤
│ • Registration  │         │ • Receipt post   │
│ • Bond mgmt     │         │ • Challenges     │
│ • Slashing      │         │ • Finalization   │
│ • Reputation    │         │ • Settlement     │
└─────────────────┘         └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │  DisputeModule   │
                            ├──────────────────┤
                            │ • Evidence       │
                            │ • Escalation     │
                            │ • Arbitration    │
                            └──────────────────┘
```

## Key Functionality

### SolverRegistry
1. **Registration**: Solvers register with minimum 0.1 ETH bond
2. **Bond Management**: Deposit, withdraw (7-day cooldown), top-up
3. **Slashing**: Authorized callers can slash bonds (percentage-based)
4. **Jailing**: Automatic jail after violations, permanent ban after 3 jails
5. **Reputation**: On-chain reputation score with 30-day half-life decay

### IntentReceiptHub
1. **Receipt Posting**: Solvers post cryptographic receipts for executed intents
2. **Challenges**: Anyone can challenge receipts within 1-hour window
3. **Deterministic Resolution**: Automatic slashing for provable violations
4. **Settlement Proof**: Operators can submit settlement proofs
5. **Bond Sweeping**: Treasury can sweep forfeited challenger bonds

### DisputeModule
1. **Evidence Submission**: Parties submit evidence within 24-hour window
2. **Escalation**: Disputes can escalate to arbitration
3. **Arbitration**: Trusted arbitrator resolves complex disputes
4. **Timeout Resolution**: Automatic resolution if arbitration times out

## Access Control

| Role | Contract | Capabilities |
|------|----------|--------------|
| Owner | All | Admin functions, parameter updates |
| AuthorizedCaller | SolverRegistry | Slash bonds, lock bonds |
| Operator | IntentReceiptHub | Submit settlement proofs |
| Arbitrator | DisputeModule | Resolve arbitrated disputes |

## Economic Parameters

| Parameter | Value | Location |
|-----------|-------|----------|
| MINIMUM_BOND | 0.1 ETH | SolverRegistry |
| WITHDRAWAL_COOLDOWN | 7 days | SolverRegistry |
| MAX_JAILS | 3 | SolverRegistry |
| CHALLENGE_WINDOW | 1 hour | IntentReceiptHub |
| CHALLENGER_BOND_BPS | 1000 (10%) | IntentReceiptHub |
| EVIDENCE_WINDOW | 24 hours | DisputeModule |
| ARBITRATION_TIMEOUT | 7 days | DisputeModule |

## Slashing Distribution

### Standard Slash (IntentReceiptHub)
- 80% → User (refund)
- 15% → Challenger (reward)
- 5% → Treasury

### Arbitration Slash (DisputeModule)
- 70% → User
- 20% → Treasury
- 10% → Arbitrator

## External Calls

| Contract | External Call | Purpose |
|----------|---------------|---------|
| SolverRegistry | `payable.transfer()` | Bond withdrawals |
| IntentReceiptHub | `SolverRegistry.slash()` | Trigger slashing |
| IntentReceiptHub | `SolverRegistry.getSolverInfo()` | Verify solver status |
| DisputeModule | `SolverRegistry.slash()` | Trigger slashing |
| DisputeModule | `IntentReceiptHub.getReceipt()` | Verify receipt exists |

## Known Trust Assumptions

1. **Owner Trust**: Owner can update critical parameters, set authorized callers
2. **Arbitrator Trust**: Arbitrator can resolve disputes with final authority
3. **Operator Trust**: Operators can submit settlement proofs
4. **Oracle Trust**: No external price oracles; all values are user-provided

## Areas of Concern

### High Priority
1. **Reentrancy**: ETH transfers in withdrawal and slashing flows
2. **Access Control**: Authorization checks for slashing/locking
3. **Signature Verification**: Receipt signature validation
4. **Integer Overflow**: Bond calculations, percentage splits

### Medium Priority
5. **Front-running**: Challenge/evidence submission ordering
6. **Timestamp Dependence**: Deadline and window calculations
7. **Denial of Service**: Gas limits on loops
8. **State Consistency**: Cross-contract state synchronization

### Lower Priority
9. **Centralization Risks**: Owner/arbitrator power
10. **Upgrade Path**: No upgradability (immutable deployment)

## Test Coverage

| Contract | Tests | Status |
|----------|-------|--------|
| SolverRegistry | 36 | All passing |
| IntentReceiptHub | 38 | All passing |
| DisputeModule | 21 | All passing |
| **Total** | **95** | **All passing** |

## Build & Test

```bash
# Install dependencies
forge install

# Build
forge build

# Run tests
forge test

# Run tests with gas report
forge test --gas-report

# Run specific test file
forge test --match-path test/SolverRegistry.t.sol -vvv
```

## Contact

- **Protocol Lead**: jeremy@intentsolutions.io
- **GitHub**: github.com/intent-solutions-io/irsb-protocol
- **Dashboard**: https://irsb-protocol.web.app
