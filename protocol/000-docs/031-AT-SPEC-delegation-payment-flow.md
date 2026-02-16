# 031-AT-SPEC: Delegation Payment Flow

## Overview

Complete buyer/seller payment flow using EIP-7702 delegation with on-chain caveat enforcement through the X402Facilitator contract.

## Buyer Setup (One-Time)

### Step 1: Connect Wallet (ERC-7715)

The dapp calls `wallet_requestExecutionPermissions`:

```json
{
  "chainId": 11155111,
  "address": "0x<WalletDelegate>",
  "permissions": [
    { "type": "spend-limit", "data": { "token": "0x<USDC>", "dailyLimit": "100000000", "perTransactionLimit": "10000000" } },
    { "type": "session", "data": { "validAfter": 1707350400, "validUntil": 1707436800 } },
    { "type": "target-allowlist", "data": { "addresses": ["0x<X402Facilitator>"] } }
  ],
  "expiry": 1707436800
}
```

### Step 2: Sign EIP-7702 Authorization

The wallet signs a type-4 authorization designating WalletDelegate as the EOA's code:

```
authorization = { chainId: 11155111, address: WalletDelegate, nonce: 0 }
signature = sign(keccak256(MAGIC || rlp([chainId, address, nonce])))
```

### Step 3: Sign EIP-712 Delegation

The wallet signs an EIP-712 typed data message creating the delegation:

```
Delegation {
  delegator: buyer_address
  delegate: WalletDelegate_address
  authority: 0x0 (root delegation)
  caveats: [
    { enforcer: SpendLimitEnforcer, terms: encode(USDC, 100e6, 10e6) },
    { enforcer: TimeWindowEnforcer, terms: encode(1707350400, 1707436800) },
    { enforcer: AllowedTargetsEnforcer, terms: encode([X402Facilitator]) }
  ]
  salt: unique_nonce
}
```

### Step 4: Submit On-Chain

The delegation is stored by calling `WalletDelegate.setupDelegation(delegation)`:
- Verifies EIP-712 signature matches delegator
- Validates all caveat enforcers are non-zero addresses
- Stores delegation hash and caveats

## Payment Flow (Per API Call)

```
  Developer                 API Server              X402Facilitator        WalletDelegate
     |                          |                          |                      |
     |--- HTTP request -------->|                          |                      |
     |                          |                          |                      |
     |<-- 402 Payment Required -|                          |                      |
     |    (x402 header)         |                          |                      |
     |                          |                          |                      |
     |--- x402 payment proof -->|                          |                      |
     |                          |                          |                      |
     |                          |-- settleDelegated() ---->|                      |
     |                          |   (delegationHash,       |                      |
     |                          |    paymentHash, amount,   |                      |
     |                          |    seller, buyer, ...)    |                      |
     |                          |                          |                      |
     |                          |                          |-- isDelegationActive->|
     |                          |                          |<-- true -------------|
     |                          |                          |                      |
     |                          |                          |-- executeDelegated() |
     |                          |                          |   (hash, USDC,      |
     |                          |                          |    transfer calldata)|
     |                          |                          |                      |
     |                          |                          |   [beforeHooks:]     |
     |                          |                          |   SpendLimit: OK     |
     |                          |                          |   TimeWindow: OK     |
     |                          |                          |   AllowedTargets: OK |
     |                          |                          |                      |
     |                          |                          |   [execute:]         |
     |                          |                          |   USDC.transfer()    |
     |                          |                          |                      |
     |                          |                          |   [afterHooks:]      |
     |                          |                          |   (no-op for these)  |
     |                          |                          |                      |
     |                          |<-- PaymentSettled event --|                      |
     |                          |                          |                      |
     |<-- 200 OK + response ----|                          |                      |
```

## Seller Flow (Service Provider)

The seller (API service provider) does not need EIP-7702 delegation. The seller:

1. Configures x402 pricing headers on API endpoints
2. Receives USDC directly to their address via X402Facilitator
3. Optionally posts IRSB receipts for reputation building

## Batch Settlement

For high-volume APIs, the seller can batch multiple settlements:

```solidity
X402Facilitator.batchSettle([
  { paymentHash: 0x01..., token: USDC, amount: 1e6, seller: 0xSeller, ... },
  { paymentHash: 0x02..., token: USDC, amount: 2e6, seller: 0xSeller, ... },
  { paymentHash: 0x03..., token: USDC, amount: 0.5e6, seller: 0xSeller, ... },
])
```

## Revocation

The buyer can revoke their delegation at any time:

```solidity
WalletDelegate.revokeDelegation(delegationHash)
```

This immediately prevents any further settlements. The revocation is permanent for that delegation hash; the buyer would need to create a new delegation to resume payments.

## Security Properties

| Property | Mechanism |
|----------|-----------|
| Double-settlement prevention | `settledPayments` mapping in X402Facilitator (XF-1) |
| Spend limits | SpendLimitEnforcer tracks daily + per-tx (SLE-1) |
| Time bounds | TimeWindowEnforcer checks block.timestamp |
| Target restriction | AllowedTargetsEnforcer validates call target |
| Replay prevention | NonceEnforcer + EIP-712 domain separator (chain-specific) |
| Immediate revocation | `revokeDelegation()` sets `active = false` (WD-1) |
| Execution ordering | beforeHooks → execute → afterHooks (WD-2) |

## Gas Costs (Estimated)

| Operation | Estimated Gas |
|-----------|---------------|
| setupDelegation (3 caveats) | ~150,000 |
| executeDelegated (3 beforeHooks + ERC20 transfer) | ~120,000 |
| settleDelegated | ~180,000 |
| batchSettle (10 items) | ~800,000 |
| revokeDelegation | ~30,000 |
