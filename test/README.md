# IRSB Protocol Test Suite

## Testing Philosophy

IRSB follows a **Moloch DAO-inspired testing methodology** combined with Foundry-native patterns:

1. **Trigger every require/revert** - Every revert path in every contract has a dedicated test
2. **Test every modifier** - Each custom modifier has allow/reject test pairs
3. **Verify all state transitions** - Post-condition assertions check ALL affected fields, not just the obvious ones
4. **Test boundary conditions** - Systematic 0, 1, MAX-1, MAX, MAX+1 for every numeric parameter
5. **Fuzz for invariants** - Property-based testing for protocol-wide invariants
6. **Security regressions** - Named tests for every discovered vulnerability (IRSB-SEC-NNN)

## Directory Structure

```
test/
├── SolverRegistry.t.sol          # Core unit tests + security regressions
├── IntentReceiptHub.t.sol         # Receipt lifecycle + challenger bonds
├── DisputeModule.t.sol            # Evidence, escalation, arbitration
├── EscrowVault.t.sol              # Native ETH escrow lifecycle
├── EscrowVaultERC20.t.sol         # ERC20 escrow lifecycle
├── WalletDelegate.t.sol           # EIP-7702 delegation + execution
├── X402Facilitator.t.sol          # x402 payment settlement
├── OptimisticDispute.t.sol        # Counter-bond dispute resolution
├── ReceiptV2Extension.t.sol       # Dual attestation receipts
├── ERC8004Adapter.t.sol           # Validation signal adapter
├── ERC8004Integration.t.sol       # End-to-end ERC-8004 flow
├── CredibilityRegistry.t.sol      # Credibility tracking
├── AcrossAdapter.t.sol            # Across bridge integration
│
├── moloch/                        # Moloch DAO-style systematic tests
│   ├── RequireAudit.t.sol         # Every untested revert path (~43 tests)
│   ├── StateTransitions.t.sol     # Comprehensive state verification (~10 tests)
│   ├── BoundaryTests.t.sol        # 0/1/MAX boundary conditions (~27 tests)
│   └── ModifierTests.t.sol        # Modifier allow/reject pairs (~17 tests)
│
├── enforcers/                     # Caveat enforcer tests
│   ├── SpendLimitEnforcer.t.sol
│   ├── TimeWindowEnforcer.t.sol
│   ├── AllowedTargetsEnforcer.t.sol
│   ├── AllowedMethodsEnforcer.t.sol
│   └── NonceEnforcer.t.sol
│
├── fuzz/                          # Fuzz tests (256 runs default, 10k in CI)
│   ├── SolverRegistryFuzz.t.sol
│   ├── IntentReceiptHubFuzz.t.sol
│   ├── EscrowVaultFuzz.t.sol
│   ├── ReceiptV2Fuzz.t.sol
│   ├── OptimisticDisputeFuzz.t.sol
│   ├── SpendLimitEnforcer.fuzz.t.sol
│   └── WalletDelegate.fuzz.t.sol
│
├── invariants/                    # Invariant tests
│   ├── SolverRegistry.invariants.t.sol
│   ├── IntentReceiptHub.invariants.t.sol
│   └── DisputeModule.invariants.t.sol
│
├── helpers/                       # Test utilities
│   ├── MockTarget.sol             # Simple target for delegation tests
│   ├── MockETHRejecter.sol        # Rejects ETH (tests transfer failures)
│   └── VerificationHelpers.sol    # Reusable state-checking assertions
│
└── security-exercise/             # Vulnerability demonstration
    ├── Attacker.sol
    ├── VulnerableVault.sol
    ├── SecureVault.sol
    └── VulnerableVault.t.sol
```

## Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Core unit | `test_[FunctionName]` | `test_RegisterSolver` |
| Revert | `test_[FunctionName]_Revert[Reason]` | `test_DepositBond_RevertZeroAmount` |
| Require audit | `test_requireFail_[Contract]_[function]_[reason]` | `test_requireFail_SolverRegistry_slash_transferFailed` |
| Boundary | `test_boundary_[Contract]_[parameter]_[condition]` | `test_boundary_IntentReceiptHub_batchSize_max` |
| State transition | `test_stateTransition_[action]_[assertion]` | `test_stateTransition_depositBond_activationThreshold` |
| Modifier | `test_modifier_[name]_[allows\|rejects]_[who]` | `test_modifier_onlyOperator_rejects_nonOperator` |
| Security | `test_IRSB_SEC_NNN_[description]` | `test_IRSB_SEC_005_zeroSlashAmountReverts` |
| Fuzz | `testFuzz_[Action]([params])` | `testFuzz_DepositAndWithdraw(uint256 amount)` |
| Invariant | `invariant_[property]` | `invariant_totalBondedMatchesSum` |

## Running Tests

```bash
# All tests
forge test

# Specific category
forge test --match-path "test/moloch/*"                    # All Moloch-style tests
forge test --match-test "test_requireFail"                 # Require audit only
forge test --match-test "test_boundary"                    # Boundary tests only
forge test --match-test "test_stateTransition"             # State transitions only
forge test --match-test "test_modifier"                    # Modifier pairs only

# Verbose (see revert messages)
forge test --match-path "test/moloch/*" -vvv

# Gas report
forge test --gas-report

# Fuzz (CI profile: 10k runs)
FOUNDRY_PROFILE=ci forge test --match-path "test/fuzz/*"

# Single test file
forge test --match-path "test/SolverRegistry.t.sol"
```

## Key Parameters

| Parameter | Value | Tested Boundaries |
|-----------|-------|-------------------|
| MINIMUM_BOND | 0.1 ETH | 0, 1 wei, MIN-1, MIN, MIN+1 |
| MAX_BATCH_SIZE | 50 | 0, 1, 50, 51 |
| CHALLENGE_WINDOW | 1 hour | 14m59s, 15m, 24h, 24h+1s |
| MAX_JAILS | 3 | Jail #2 (jailed), Jail #3 (banned) |
| WITHDRAWAL_COOLDOWN | 7 days | 7d (fail), 7d+1s (pass) |
| ARBITRATION_TIMEOUT | 7 days | Before/after timeout |

## Security Regression Policy

Every discovered vulnerability gets a permanent regression test named `test_IRSB_SEC_NNN_*`:

| ID | Vulnerability | Test |
|----|--------------|------|
| IRSB-SEC-001 | Cross-chain/contract replay | `test_IRSB_SEC_001_crossChainReplayPrevented` |
| IRSB-SEC-002 | Escalation DoS by third parties | Checked in DisputeModule tests |
| IRSB-SEC-003 | Re-challenge after rejected dispute | `test_IRSB_SEC_003_rejectedDisputeCannotBeRechallenged` |
| IRSB-SEC-005 | Zero-amount slash silent no-op | `test_IRSB_SEC_005_zeroSlashAmountReverts` |
| IRSB-SEC-006 | Same-chain nonce replay | Verified in all receipt posting tests |
| IRSB-SEC-009 | Batch post skipping validation | Verified in batch post tests |
| IRSB-SEC-010 | Zero-slash rounding in arbitration | Checked in DisputeModule resolve |
