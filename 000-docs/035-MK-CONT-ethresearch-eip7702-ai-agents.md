# EthResearch Post: EIP-7702 as the Security Layer for On-Chain AI Agents

> **035-MK-CONT** | Marketing Content (EthResearch Forum Post)
> Last updated: 2026-02-09

---

## Title

EIP-7702 as the Security Layer for On-Chain AI Agents

## Category

Applications / Account Abstraction

## Tags

`eip-7702`, `ai-agents`, `account-abstraction`, `delegation`, `wallet-security`

---

## Post Body

### Motivation

AI agents are gaining direct access to on-chain wallets at increasing scale. Frameworks like Coinbase AgentKit, ElizaOS, Olas, Virtuals Protocol, and Brian AI provide agents with signing capabilities through various mechanisms — MPC wallets, Lit Protocol PKPs, Safe multisigs, and Token Bound Accounts.

None of these frameworks currently provide:

1. **On-chain spending limits** that the agent cannot bypass
2. **Cryptographic execution receipts** for every agent action
3. **Automated monitoring** with on-chain dispute resolution
4. **Portable reputation** based on verifiable execution history

The result is a growing attack surface. Agents hold keys and execute autonomously, but there is no standardized mechanism to constrain their behavior at the protocol level or to provide recourse when they act outside their mandate. The attack vectors are well-documented — prompt injection, key compromise, logic bugs in agent code — and they are amplified by the autonomous nature of agent execution.

This post describes how EIP-7702 delegation, combined with on-chain caveat enforcers, can serve as a standardized security layer for on-chain AI agents.

### Threat Model

We consider three categories of risk for agent wallets:

**1. Prompt injection / adversarial inputs**

An external input (user message, API response, web content) manipulates the agent's reasoning to execute unauthorized transactions. Princeton researchers demonstrated this attack vector against ElizaOS agents in 2025, where crafted inputs could redirect agent wallet operations.

**2. Key compromise**

The agent's signing key is exposed through framework vulnerabilities, infrastructure misconfiguration, or supply chain attacks. Because agents operate autonomously, a compromised key can be exploited before human oversight is possible.

**3. Logic bugs and runaway execution**

Agent code contains bugs that cause it to execute transactions outside its intended scope — wrong amounts, wrong contracts, or excessive frequency. Without on-chain constraints, these bugs manifest as irreversible financial losses.

In all three cases, the core problem is the same: the agent has unrestricted access to wallet signing, and there is no on-chain enforcement layer between the agent's decision and the transaction's execution.

### Architecture: EIP-7702 Delegation with Caveat Enforcers

We propose using EIP-7702 (adopted in Pectra, May 2025) to delegate an agent's EOA to a smart contract that enforces configurable caveats on every transaction.

#### Delegation Setup

```
1. Agent EOA signs EIP-7702 authorization
   → Designates WalletDelegate as the EOA's code
2. Agent (or agent owner) configures enforcers via EIP-712 delegation
   → SpendLimitEnforcer: 0.01 ETH per-tx, 0.1 ETH daily
   → AllowedTargetsEnforcer: [uniswapRouter, aavePool]
   → AllowedMethodsEnforcer: [swap(), supply()]
   → TimeWindowEnforcer: 09:00-17:00 UTC
   → NonceEnforcer: unique nonce per action
3. WalletDelegate stores delegation parameters on-chain
4. All subsequent transactions route through WalletDelegate
```

#### Transaction Flow

```
Agent requests transaction
  → WalletDelegate.execute() called
    → For each enforcer in delegation:
        enforcer.beforeHook(execution) // validate caveats
    → If all enforcers pass:
        Execute transaction
        → For each enforcer:
            enforcer.afterHook(execution) // update state (e.g., spend totals)
        → Post receipt to IntentReceiptHub
    → If any enforcer fails:
        Revert with EnforcerCheckFailed(enforcer, reason)
```

The key property is that enforcement happens at the EVM level. A compromised prompt, a stolen key used through a different client, or a buggy agent script cannot bypass the enforcers because they are smart contracts, not middleware.

#### Caveat Enforcers

We have implemented and deployed five enforcers on Sepolia:

| Enforcer | Contract | Constraint |
|----------|----------|------------|
| `SpendLimitEnforcer` | `0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D` | Daily and per-transaction spending caps (ETH and ERC20) |
| `TimeWindowEnforcer` | `0x51DF412e99E9066B1B3Cab81a1756239659207B4` | Transaction signing restricted to defined time windows |
| `AllowedTargetsEnforcer` | `0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b` | Whitelist of approved contract addresses |
| `AllowedMethodsEnforcer` | `0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf` | Whitelist of approved function selectors |
| `NonceEnforcer` | `0x02962c406A7a29adF26F40657b111B90c236DbF1` | Unique nonce per delegated action (replay prevention) |

Each enforcer implements a `beforeHook` / `afterHook` interface compatible with ERC-7710 delegation redemption. The WalletDelegate contract iterates over all configured enforcers before and after execution.

### Execution Receipts

Every transaction that passes through WalletDelegate produces a receipt posted to IntentReceiptHub. The receipt structure:

```solidity
struct IntentReceipt {
    bytes32 intentHash;       // Hash of the intended action
    bytes32 constraintsHash;  // Hash of the active enforcer configuration
    bytes32 routeHash;        // Hash of the execution path
    bytes32 outcomeHash;      // Hash of the actual outcome
    bytes32 evidenceHash;     // Hash of supporting evidence bundle
    uint64  createdAt;        // Timestamp
    uint64  expiry;           // Receipt expiry
    bytes32 solverId;         // Agent/solver identifier
    bytes   solverSig;        // Agent's cryptographic signature
}
```

V2 receipts add dual attestation (agent + client EIP-712 signatures) and privacy levels for sensitive execution data.

Receipts serve three functions:

1. **Audit trail** — Verifiable record of every agent action, queryable by anyone
2. **Dispute evidence** — Input to automated dispute resolution
3. **Reputation signal** — Input to on-chain reputation scoring via ERC-8004

### Monitoring and Dispute Resolution

An independent watchtower service scans on-chain receipts and evaluates them against a configurable rule engine. When violations are detected (stale receipts, missed deadlines, pattern anomalies), the watchtower files an on-chain dispute.

The dispute flow:

1. Receipt posted → 1-hour challenge window opens
2. Dispute filed with evidence bond
3. **Deterministic violations** (timeout, incorrect amount): auto-resolved via `resolveDeterministic()`
4. **Complex violations**: optimistic resolution with 24-hour counter-bond window
5. No counter-bond → challenger wins by timeout
6. Counter-bond posted → escalation to arbitrator (7-day timeout)

Slashing distribution: 80% to affected user, 15% to challenger, 5% to treasury.

### Reputation via ERC-8004

Agents register on-chain identities through ERC-8004 (trustless agent identity standard, live on 12+ chains). IRSB publishes validation signals to the ERC-8004 registry based on execution outcomes:

| Event | Signal | Value |
|-------|--------|-------|
| Receipt finalized (no dispute) | `validationResponse` | 100 |
| Dispute opened | `giveFeedback` | -10 |
| Dispute won by agent | `validationResponse` | 90 |
| Dispute lost (minor) | `validationResponse` | 30 |
| Dispute lost (full slash) | `validationResponse` | 0 |

IntentScore aggregates these signals into a composite metric:

```
Score = (40% x SuccessRate) + (25% x DisputeWinRate) + (20% x StakeFactor) + (15% x Longevity) - SlashPenalty
```

This creates portable, execution-based reputation that new protocols can query before granting an agent access.

### Reference Implementation

All contracts are deployed and verified on Sepolia:

| Contract | Address |
|----------|---------|
| WalletDelegate | `0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |
| 5 Caveat Enforcers | See table above |
| ERC-8004 Agent | ID `967` on IdentityRegistry |

Source code: [github.com/intent-solutions-io/irsb-protocol](https://github.com/intent-solutions-io/irsb-protocol) (MIT license, 426 tests including fuzz tests)

The off-chain infrastructure includes:
- Watchtower monitoring service (TypeScript, Fastify) — configurable rule engine
- Solver execution engine (TypeScript, Express) — receipt posting and evidence collection
- Cloud KMS signing — keys never leave HSM hardware, <100ms signing latency

### Open Questions

**1. Standardization path for agent enforcers**

The five enforcers described here cover common constraints, but agent use cases will likely require domain-specific enforcers (e.g., DeFi-specific slippage limits, NFT-specific approval guards). Should enforcer interfaces be proposed as an ERC extension to ERC-7710?

**2. Cross-framework compatibility**

Each agent framework has a different wallet abstraction layer. What is the minimal interface that would allow a single set of enforcers to work across AgentKit, ElizaOS, Olas, and Safe-based agents?

**3. Enforcer composability**

The current model applies all enforcers sequentially. Are there cases where enforcers need conditional logic (e.g., "if target is Uniswap, apply slippage limit; otherwise, apply default spend limit")?

**4. Privacy considerations**

Receipts are currently public on-chain. For sensitive agent operations (e.g., proprietary trading strategies), how should the receipt system balance verifiability with confidentiality? V2 receipts support privacy levels, but the optimal balance is an open question.

**5. Reputation cold start**

New agents have no execution history. The current approach assigns a neutral score (50%), but this creates a potential Sybil vector where agents register new identities to reset negative reputation. What mechanisms beyond staking can address this?

### Call to Action

We are interested in feedback from:

- **Agent framework developers** — What integration constraints exist? What enforcer types would be most valuable?
- **Account abstraction researchers** — How does this approach complement existing AA standards (ERC-4337, ERC-7579)?
- **Security researchers** — What threat vectors does this architecture not address?

Source code and contracts are open source under MIT license. We welcome contributions and integration proposals.

GitHub: [intent-solutions-io](https://github.com/intent-solutions-io)
Contact: jeremy@intentsolutions.io

---

## Formatting Notes

- Post follows EthResearch conventions (markdown, technical depth, open questions)
- No promotional language — positions as research contribution
- Contract addresses are verifiable on Sepolia Etherscan
- References Princeton research on ElizaOS vulnerabilities
- Open questions invite genuine discussion from the community
