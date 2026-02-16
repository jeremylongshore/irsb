# 030-DR-ARCH: EIP-7702 Delegation Architecture

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-09 |
| **Authors** | Jeremy Longshore |
| **Supersedes** | Lit Protocol PKP signing (agent-passkey) |
| **Standards** | EIP-7702, ERC-7710, ERC-7715, x402 |

## Context

IRSB's signing architecture currently relies on Lit Protocol PKP (2/3 threshold signatures across TEE nodes) via the `agent-passkey` Cloud Run service. All on-chain transactions from the solver and watchtower flow through this service.

### Problems with Current Architecture

1. **No buyer delegation path**: Developers wanting to "connect wallet, set limit, auto-pay" for x402 API calls have no mechanism. EIP-7702 delegation with on-chain caveat enforcers solves this.

2. **Off-chain policy opacity**: The agent-passkey policy engine performs 8 off-chain checks before signing. These checks are invisible to on-chain verifiers. On-chain caveat enforcers provide transparent, verifiable policy enforcement.

3. **Lit SDK instability**: The v8 SDK is alpha-only (`naga` dist-tag), requires type casting hacks (`litNetwork` typed as `'naga-dev' | 'custom'` only), and adds 1-2s latency per signature. The Datil (V0) network shuts down Feb 25, 2026.

4. **Network dependency risk**: Lit Protocol availability is a single point of failure for all IRSB signing operations.

## Decision

Drop Lit Protocol entirely. Replace with:

- **Cloud KMS-backed keys** for solver/watchtower signing (deterministic, no network dependency)
- **EIP-7702 delegation** with on-chain caveat enforcers for buyer authorization
- **WalletDelegate** contract implementing ERC-7710 `redeemDelegations()` for smart contract delegation
- **X402Facilitator** contract for delegated payment settlement

Deprecate the `agent-passkey` service. It remains functional but is no longer the recommended signing path.

## Architecture

### Standards Adopted

| Standard | Role |
|----------|------|
| EIP-7702 | EOA delegates execution to WalletDelegate contract |
| ERC-7710 | `redeemDelegations()` interface for smart contract delegation |
| ERC-7715 | `wallet_requestExecutionPermissions` for dapp UX |
| x402 | HTTP payment protocol (already integrated) |

### Before (Lit Protocol)

```
Solver/Watchtower --> HTTP POST --> agent-passkey --> Lit PKP (2/3 TEE) --> on-chain tx
                                    ^ off-chain policy engine (8 checks)
```

### After (EIP-7702)

```
Solver/Watchtower --> sign locally (Cloud KMS key) --> WalletDelegate (7702) --> on-chain tx
                                                        ^ on-chain caveat enforcers

Buyer (developer) --> 7702 authorize once --> WalletDelegate --> X402Facilitator --> auto-pay USDC
                       ^ caveats: spend limit, time window, allowed targets
```

### Contract Architecture

```
WalletDelegate (ERC-7710)
  |-- setupDelegation(delegation, signature)
  |-- revokeDelegation(delegationHash)
  |-- executeDelegated(delegationHash, target, calldata, value)
  |-- redeemDelegations(delegations[], modes[], executionCalldata[])
  |
  +-- validates caveat enforcers:
       |-- SpendLimitEnforcer    (daily + per-tx caps)
       |-- TimeWindowEnforcer    (session bounds)
       |-- AllowedTargetsEnforcer (approved contracts)
       |-- AllowedMethodsEnforcer (approved selectors)
       |-- NonceEnforcer          (replay prevention)

X402Facilitator
  |-- settlePayment(params)        (direct settlement)
  |-- settleDelegated(hash, params) (via delegation)
  |-- batchSettle(params[])         (high-volume)
  |
  +-- integrates with:
       |-- IntentReceiptHub (post receipts)
       |-- EscrowVault (escrow management)
       |-- WalletDelegate (delegation verification)
```

## Caveat Enforcer Design

Each enforcer implements `ICaveatEnforcer` with `beforeHook()` / `afterHook()` per ERC-7710:

| Enforcer | Terms Encoding | Invariant |
|----------|---------------|-----------|
| SpendLimitEnforcer | `(address token, uint256 dailyCap, uint256 perTxCap)` | `totalSpent[hash][token] <= dailyCap` per epoch |
| TimeWindowEnforcer | `(uint64 notBefore, uint64 notAfter)` | `notBefore <= block.timestamp <= notAfter` |
| AllowedTargetsEnforcer | `address[]` | `target in allowedTargets` |
| AllowedMethodsEnforcer | `bytes4[]` | `selector in allowedMethods` |
| NonceEnforcer | `(uint256 startNonce)` | Monotonically increasing nonce per delegation |

## Attack Surfaces

### Delegation Replay
- **Threat**: Replaying a delegation setup on a different chain or after revocation.
- **Mitigation**: EIP-712 domain separator includes chain ID. Revocation is permanent (stored in mapping). NonceEnforcer prevents execution replay.

### Caveat Bypass
- **Threat**: Executing delegated calls that bypass enforcer checks.
- **Mitigation**: All enforcers run in sequence via `beforeHook()` before execution. Any revert aborts the entire transaction. `afterHook()` provides post-execution validation.

### Spend Limit Epoch Gaming
- **Threat**: Spending at epoch boundary to double the daily limit.
- **Mitigation**: SpendLimitEnforcer uses `block.timestamp / 1 days` epochs. Per-transaction cap limits single-shot damage regardless of epoch timing.

### Delegator Impersonation
- **Threat**: Setting up a delegation for an address you don't control.
- **Mitigation**: `setupDelegation()` verifies EIP-712 signature from the delegator. `EIP7702Utils.fetchDelegate()` confirms the delegator's code points to WalletDelegate.

### Double Settlement
- **Threat**: Settling the same payment twice via X402Facilitator.
- **Mitigation**: `settledPayments` mapping tracks payment hashes. Second settlement reverts.

## Key Invariants

| ID | Invariant | Enforced By |
|----|-----------|-------------|
| WD-1 | `executeDelegated()` reverts if delegation is revoked | WalletDelegate storage check |
| WD-2 | All caveat `beforeHook`s run before execution, all `afterHook`s after | WalletDelegate execution loop |
| WD-3 | `EIP7702Utils.fetchDelegate(delegator)` must equal WalletDelegate address | WalletDelegate verification |
| SLE-1 | `totalSpent[hash][token] <= dailyCap` for any epoch | SpendLimitEnforcer state |
| XF-1 | `settlePayment()` reverts on double-settlement | X402Facilitator mapping |

## Migration Path

1. Deploy WalletDelegate + caveat enforcers + X402Facilitator to Sepolia
2. Update solver to sign with Cloud KMS directly (bypass agent-passkey)
3. Update watchtower signers package (implement KMS signer, currently stubbed)
4. Add delegation payment monitoring rule to watchtower
5. Deprecate agent-passkey service (keep running but document as legacy)
6. Buyer SDK in x402-irsb package provides delegation setup helpers

## Consequences

### Positive
- Eliminates Lit Protocol dependency and associated latency/availability risk
- On-chain caveat enforcement is transparent and verifiable
- Enables buyer delegation flow (connect wallet, set limits, auto-pay)
- Simpler architecture: fewer moving parts, no external signing service
- Lower per-signature cost (Cloud KMS vs Lit TEE network)

### Negative
- Cloud KMS introduces GCP dependency for seller signing (acceptable: already on GCP)
- On-chain caveat enforcement uses more gas than off-chain policy checks
- EIP-7702 is relatively new (May 2025) with limited ecosystem tooling
- Migration requires coordinated updates across solver, watchtower, and SDK

### Neutral
- agent-passkey service remains functional for any users who prefer threshold signing
- ERC-8004 identity registration is unaffected (separate concern)
