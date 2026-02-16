# EIP-7702 On-Chain Guardrails for AI Agents

> **032-MK-PITC** | Marketing Pitch Document
> Last updated: 2026-02-09

---

## The Problem

AI agents are executing on-chain transactions at increasing scale. Every major framework — Coinbase AgentKit, ElizaOS, Olas, Virtuals Protocol, Brian AI — gives agents wallet access. None of them answer a fundamental question:

**What happens when the agent overspends, calls the wrong contract, or acts outside its mandate?**

Today, the answer is: nothing. There are no on-chain spending limits. No verifiable audit trail. No automated recourse mechanism. The agent holds the keys, and the owner trusts that it behaves correctly.

This is not a theoretical risk. Agent wallets face the same attack surfaces as any EOA — prompt injection, key compromise, logic bugs in agent code — but with a critical difference: agents operate autonomously. A compromised agent can drain funds before a human notices.

As agent wallet usage scales, the absence of on-chain constraints becomes a systemic risk.

## Current State of Agent Wallet Security

| Framework | Wallet Mechanism | Spend Limits | Execution Receipts | Automated Monitoring | Dispute Resolution |
|-----------|-----------------|-------------|-------------------|---------------------|-------------------|
| **Coinbase AgentKit** | Coinbase API / MPC | None | None | None | None |
| **ElizaOS** | Lit Protocol / KMS | None (ProofGate is 3rd-party) | None | None | None |
| **Olas** | Safe multisig | Consensus-based | None | None | None |
| **Virtuals Protocol** | TBA / bonding curves | None | None | None | None |
| **Brian AI** | Aggregator routing | Aggregator-level | None | None | None |
| **Safe** | Smart account modules | Module-dependent | None | None | None |
| **IRSB** | **EIP-7702 delegation** | **On-chain enforcers** | **Cryptographic** | **Watchtower** | **On-chain arbitration** |

No framework has native, verifiable, on-chain accountability for agent actions.

## The IRSB Approach

IRSB provides on-chain guardrails through three layers:

### 1. Policy Enforcement (EIP-7702 WalletDelegate)

An agent's EOA delegates execution to a WalletDelegate smart contract via EIP-7702. Every transaction must pass through five caveat enforcers before execution:

| Enforcer | What It Enforces | Example |
|----------|-----------------|---------|
| **SpendLimitEnforcer** | Daily and per-transaction spending caps | Agent limited to 0.01 ETH per transaction, 0.1 ETH daily |
| **TimeWindowEnforcer** | Signing restricted to defined time windows | Agent can only transact during market hours (09:00-17:00 UTC) |
| **AllowedTargetsEnforcer** | Whitelist of approved contract addresses | Agent can only interact with Uniswap V3 Router and Aave V3 Pool |
| **AllowedMethodsEnforcer** | Whitelist of approved function selectors | Agent can call `swap()` and `supply()` but not `approve()` on arbitrary contracts |
| **NonceEnforcer** | Replay prevention | Each delegated action gets a unique nonce, preventing replay attacks |

These are on-chain contracts. They cannot be bypassed by the agent, its framework, or a compromised prompt. A transaction that violates any enforcer is rejected at the EVM level.

### 2. Execution Receipts (IntentReceiptHub)

Every successful transaction produces a cryptographic receipt posted to IntentReceiptHub. Each receipt contains:

- `intentHash` — what the agent intended to do
- `constraintsHash` — the constraints it was operating under
- `outcomeHash` — what actually happened
- `evidenceHash` — supporting evidence
- `solverSig` — the agent's cryptographic signature

V2 receipts add dual attestation (agent + client EIP-712 signatures) and privacy levels for sensitive execution data.

### 3. Automated Monitoring (Watchtower)

The watchtower independently scans on-chain receipts against a configurable rule engine. When a violation is detected — stale receipts, missed deadlines, suspicious patterns — it files a dispute on-chain with supporting evidence. No human intervention required.

Disputes follow a 1-hour challenge window. Deterministic violations (timeout, incorrect amount) resolve automatically. Complex cases use optimistic resolution with counter-bonds and optional arbitrator escalation.

Slashing distribution: 80% to the affected user, 15% to the challenger, 5% to the protocol treasury.

## Concrete Scenario

**Setup:** An AI trading agent is configured with IRSB guardrails on Sepolia.

1. Agent wallet delegates to WalletDelegate via EIP-7702
2. SpendLimitEnforcer set to 0.01 ETH per transaction, 0.1 ETH daily
3. AllowedTargetsEnforcer whitelists the Uniswap V3 Router
4. Agent attempts a 0.05 ETH swap on Uniswap

**What happens:**
- WalletDelegate receives the transaction
- SpendLimitEnforcer rejects: 0.05 ETH exceeds the 0.01 ETH per-tx limit
- Transaction fails on-chain — funds are safe
- The rejection is logged and visible on-chain

**If the transaction had been within limits:**
- All five enforcers validate
- Transaction executes
- Receipt posted to IntentReceiptHub
- Watchtower monitors the receipt
- 1-hour challenge window passes → receipt finalized
- Agent reputation updated via ERC-8004

## Integration Path

IRSB is designed for framework-level integration. The target is a minimal surface area that agent developers configure once.

```typescript
// Conceptual SDK interface (development)
import { createAgentWallet } from '@irsb/agent-sdk';

const wallet = await createAgentWallet({
  agentKey: process.env.AGENT_PRIVATE_KEY,
  enforcers: {
    spendLimit: { daily: '0.1', perTx: '0.01', token: 'ETH' },
    allowedTargets: ['0x...uniswapRouter', '0x...aavePool'],
    allowedMethods: ['swap()', 'supply()'],
    timeWindow: { start: '09:00', end: '17:00', timezone: 'UTC' },
  },
});

// Every transaction goes through WalletDelegate → enforcers → receipt
const receipt = await wallet.execute({
  to: '0x...uniswapRouter',
  data: swapCalldata,
  value: '0.005',
});
// receipt.hash → on-chain receipt ID
// receipt.enforcerResults → which enforcers validated
```

Integration paths for specific frameworks:

| Framework | Integration Point | Approach |
|-----------|------------------|----------|
| **ElizaOS** | Plugin system | `@irsb/elizaos-plugin` wrapping wallet interactions |
| **Safe** | Module | `IRSBGuardModule` enforcing caveats on Safe transactions |
| **AgentKit** | Wallet provider | Wrap Coinbase wallet with WalletDelegate delegation |
| **Olas** | Service component | IRSB guardrails as an Olas autonomous service |

## Deployed Infrastructure

IRSB is not a whitepaper. All contracts are deployed and verified on Sepolia testnet.

| Contract | Address | Status |
|----------|---------|--------|
| SolverRegistry | [`0xB6ab964832808E49635fF82D1996D6a888ecB745`](https://sepolia.etherscan.io/address/0xB6ab964832808E49635fF82D1996D6a888ecB745) | Verified |
| IntentReceiptHub | [`0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c`](https://sepolia.etherscan.io/address/0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c) | Verified |
| DisputeModule | [`0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D`](https://sepolia.etherscan.io/address/0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D) | Verified |
| WalletDelegate | [`0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB`](https://sepolia.etherscan.io/address/0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB) | Verified |
| SpendLimitEnforcer | [`0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D`](https://sepolia.etherscan.io/address/0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D) | Verified |
| TimeWindowEnforcer | [`0x51DF412e99E9066B1B3Cab81a1756239659207B4`](https://sepolia.etherscan.io/address/0x51DF412e99E9066B1B3Cab81a1756239659207B4) | Verified |
| AllowedTargetsEnforcer | [`0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b`](https://sepolia.etherscan.io/address/0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b) | Verified |
| AllowedMethodsEnforcer | [`0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf`](https://sepolia.etherscan.io/address/0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf) | Verified |
| NonceEnforcer | [`0x02962c406A7a29adF26F40657b111B90c236DbF1`](https://sepolia.etherscan.io/address/0x02962c406A7a29adF26F40657b111B90c236DbF1) | Verified |
| ERC-8004 Agent ID | `967` on [`IdentityRegistry`](https://sepolia.etherscan.io/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) | Registered |

Additional infrastructure:
- 426 passing tests (including fuzz tests with 10,000 runs)
- Cloud KMS signing (keys never leave HSM hardware, <100ms latency)
- Watchtower monitoring service (TypeScript, Fastify)
- Solver execution engine (TypeScript, Express)
- ERC-8004 agent registration for portable identity

## Open Standards Alignment

| Standard | Role in IRSB |
|----------|-------------|
| **EIP-7702** | EOA delegation to WalletDelegate for policy-enforced execution |
| **ERC-7710** | `redeemDelegations()` interface for smart contract delegation redemption |
| **ERC-7715** | `wallet_requestExecutionPermissions` for user-facing permission UX |
| **ERC-7683** | Cross-chain intent format — receipts reference intent hashes |
| **ERC-8004** | Agent identity and reputation registry — IRSB publishes validation signals |
| **x402** | HTTP payment protocol — receipts prove paid API service delivery |

## Contact

- GitHub: [intent-solutions-io](https://github.com/intent-solutions-io)
- Email: jeremy@intentsolutions.io
- Dashboard: [IRSB Protocol](https://irsb-protocol.vercel.app)
