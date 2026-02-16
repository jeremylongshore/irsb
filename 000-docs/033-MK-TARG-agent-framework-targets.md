# Agent Framework Target Map

> **033-MK-TARG** | Marketing Target Analysis
> Last updated: 2026-02-09

---

## Overview

This document profiles the six primary AI agent frameworks that give agents on-chain wallet access. For each framework, it describes how they currently handle wallet security, what is missing (the gap IRSB fills), the technical integration path, and priority tier for outreach.

## Priority Tiers

| Tier | Framework | Rationale |
|------|-----------|-----------|
| **Tier 1** | ElizaOS | Largest AI agent community, plugin architecture, already uses Lit/KMS |
| **Tier 1** | Safe | Module system, existing smart account infrastructure, natural fit for WalletDelegate |
| **Tier 2** | Coinbase AgentKit | TypeScript SDK, broad developer reach, Coinbase distribution |
| **Tier 2** | Olas | Autonomous agent services, Safe-based, governance ecosystem |
| **Tier 3** | Brian AI | Natural language to transactions, aggregator model |
| **Tier 3** | Virtuals Protocol | Token-bonded agents, consumer-facing, speculative market |

---

## Tier 1: ElizaOS

### Current Wallet Architecture

ElizaOS (formerly ai16z Eliza) uses a plugin-based architecture where wallet access is provided through framework plugins. Agents can hold keys via Lit Protocol PKPs, local KMS, or imported private keys. The framework does not enforce spending limits or generate execution proofs natively.

**ProofGate** (third-party by Kairos Labs) adds proof-of-execution for ElizaOS agents, but it operates as an external middleware layer, not as on-chain enforcement.

### What Is Missing

- No on-chain spending limits — plugins can execute arbitrary transactions
- No cryptographic receipts for agent actions
- No automated violation detection or dispute resolution
- ProofGate is off-chain and trust-dependent — not verifiable on-chain
- No portable reputation system across ElizaOS instances

### Integration Path

**Approach:** `@irsb/elizaos-plugin` — an ElizaOS plugin that wraps wallet interactions with WalletDelegate delegation.

```
ElizaOS Plugin System
  └── @irsb/elizaos-plugin
       ├── On first load: delegate agent wallet → WalletDelegate (EIP-7702)
       ├── Configure enforcers (spend limits, targets, methods, time windows)
       ├── Wrap all outgoing transactions through WalletDelegate
       ├── Post receipts to IntentReceiptHub after each execution
       └── Register agent identity on ERC-8004
```

**Key contacts / resources:**
- Repository: [`elizaOS/eliza`](https://github.com/elizaOS/eliza) (16k+ stars)
- Plugin docs: `/packages/plugin-*/` in the ElizaOS monorepo
- Community: Discord (30k+ members), Twitter @elizaOS
- Key contributor channels: GitHub Discussions, Discord #dev-plugins

### Technical Notes

- ElizaOS v0.x uses a runtime that executes "actions" — wrapping these actions with WalletDelegate calls is the natural integration point
- The plugin system supports lifecycle hooks (`initialize`, `evaluate`, `handler`) that map to delegation setup, enforcer validation, and receipt posting
- Princeton research (2025) demonstrated prompt injection vulnerabilities in ElizaOS agents — IRSB enforcers would have prevented the fund drain scenario

---

## Tier 1: Safe

### Current Wallet Architecture

Safe (formerly Gnosis Safe) is the most widely used smart account infrastructure in Ethereum. It uses a modular architecture with Guards, Modules, and Fallback Handlers. Transactions require M-of-N owner signatures. Guard contracts can implement pre/post-execution checks.

Some AI agent frameworks (notably Olas) use Safe as their underlying wallet infrastructure.

### What Is Missing

- Guard contracts enforce basic checks but lack intent-specific validation
- No native receipt system for executed transactions
- No integrated monitoring/dispute mechanism
- No portable reputation tied to Safe-mediated execution
- Module-based spend limits exist but are not standardized across the ecosystem

### Integration Path

**Approach:** `IRSBGuardModule` — a Safe Module + Guard that enforces IRSB caveats and posts receipts.

```
Safe Smart Account
  └── IRSBGuardModule (installed as Module + Guard)
       ├── Guard: pre-execution check against IRSB enforcers
       │   ├── SpendLimitEnforcer validation
       │   ├── AllowedTargetsEnforcer validation
       │   ├── AllowedMethodsEnforcer validation
       │   └── TimeWindowEnforcer validation
       ├── Module: post-execution receipt posting to IntentReceiptHub
       └── Integration: ERC-8004 reputation signals
```

**Key contacts / resources:**
- Repository: [`safe-global/safe-smart-account`](https://github.com/safe-global/safe-smart-account)
- Module documentation: [Safe Developer Portal](https://docs.safe.global)
- SDK: `@safe-global/protocol-kit`
- Community: Safe Forum, Discord

### Technical Notes

- Safe's Guard interface (`checkTransaction` / `checkAfterExecution`) maps directly to IRSB's pre-execution enforcer validation and post-execution receipt posting
- Safe Modules can execute transactions without owner signatures — this is the same delegation model as EIP-7702, making the integration natural
- The Safe ecosystem already has ~$100B in TVL, providing significant distribution potential

---

## Tier 2: Coinbase AgentKit

### Current Wallet Architecture

AgentKit provides AI agents with wallet access through the Coinbase Developer Platform (CDP). Agents use MPC wallets (Coinbase-hosted) or imported keys. The SDK provides tools for common on-chain actions (transfer, swap, deploy) as LLM tool definitions.

### What Is Missing

- No on-chain spending limits — the CDP API allows any transaction the wallet can sign
- No cryptographic execution receipts
- No automated monitoring or dispute resolution
- Reputation is implicit (Coinbase API key permissions) rather than on-chain and portable
- MPC key management is Coinbase-operated, not agent-controlled

### Integration Path

**Approach:** Wrap the AgentKit wallet provider with WalletDelegate delegation.

```
AgentKit SDK
  └── IRSB Wallet Wrapper
       ├── On initialization: delegate CDP wallet → WalletDelegate (EIP-7702)
       ├── Override sendTransaction() to route through WalletDelegate
       ├── Enforcer configuration via AgentKit's tool definitions
       ├── Auto-post receipts for every tool execution
       └── Expose IntentScore in agent metadata
```

**Key contacts / resources:**
- Repository: [`coinbase/agentkit`](https://github.com/coinbase/agentkit)
- Documentation: [AgentKit Docs](https://docs.cdp.coinbase.com/agentkit)
- Integration examples: `agentkit/typescript/examples/`
- Community: Coinbase Developer Discord

### Technical Notes

- AgentKit's "tools" (transfer, swap, etc.) are already typed actions — mapping to IRSB's typed actions is straightforward
- CDP's MPC wallet model means the private key is not directly accessible — EIP-7702 delegation would need to work through CDP's signing API
- Coinbase's distribution (millions of developer accounts) makes this high-value for reach

---

## Tier 2: Olas

### Current Wallet Architecture

Olas (Autonolas) runs autonomous agent services using the Open Autonomy framework. Agent wallets are typically Safe multisigs where multiple agent components share signing authority through a consensus mechanism. The framework uses a "service" model where agents are composed from reusable components.

### What Is Missing

- Consensus-based spending limits are slow (require multi-agent agreement per transaction)
- No cryptographic execution receipts per agent action
- No independent monitoring — only internal agent consensus
- No on-chain dispute resolution for individual agent actions
- Reputation is based on service staking, not execution history

### Integration Path

**Approach:** IRSB as an Olas service component that wraps outgoing transactions.

```
Olas Autonomous Service
  └── IRSB Component (registered as service component)
       ├── Intercept outgoing transactions from agent behaviors
       ├── Route through WalletDelegate (EIP-7702 delegation on the Safe)
       ├── Enforcer validation before consensus round
       ├── Receipt posting after execution
       └── ERC-8004 reputation integration
```

**Key contacts / resources:**
- Repository: [`valory-xyz/open-autonomy`](https://github.com/valory-xyz/open-autonomy)
- Documentation: [Olas Developer Portal](https://docs.autonolas.network)
- Component registry: [Olas Protocol](https://registry.olas.network)
- Community: Discord, Telegram

### Technical Notes

- Olas uses Safe as the underlying wallet for agent services — the Safe integration (Tier 1) provides the foundation
- The component model allows IRSB to be registered as a reusable component, deployed once and used across multiple services
- Olas staking (OLAS token) provides economic alignment but not execution-level accountability

---

## Tier 3: Brian AI

### Current Wallet Architecture

Brian AI translates natural language into blockchain transactions using an aggregator model. Users describe intent in plain English, Brian generates the calldata, and the user signs. The wallet is typically the user's own EOA or connected wallet — Brian does not custody keys.

### What Is Missing

- No verification that the generated transaction matches the natural language intent
- No on-chain spending limits beyond what the user manually sets
- No execution receipts linking intent description to on-chain outcome
- No monitoring or dispute resolution
- No agent reputation — Brian is a stateless transaction generator

### Integration Path

**Approach:** Add IRSB receipt posting as a post-execution step in Brian's transaction pipeline.

```
Brian AI Transaction Pipeline
  └── Natural language → Calldata generation → User signing
       └── IRSB Post-Execution Layer
            ├── Post receipt with intentHash = hash(natural language prompt)
            ├── Include constraintsHash = hash(expected parameters)
            ├── Watchtower monitoring for outcome verification
            └── Optional: WalletDelegate delegation for automated execution
```

**Key contacts / resources:**
- Repository: [`brian-ai`](https://github.com/brian-knows)
- API: [Brian AI API](https://docs.brianknows.org)
- Community: Discord, Twitter @braborobot

### Technical Notes

- Brian's stateless model means integration is primarily at the API level, not the agent level
- The natural language to calldata pipeline creates a natural mapping to IRSB's intentHash (hash of the user's original request)
- Integration adds accountability to Brian's aggregator model without requiring Brian to change its core architecture

---

## Tier 3: Virtuals Protocol

### Current Wallet Architecture

Virtuals Protocol creates tokenized AI agents where each agent has an associated bonding curve token. Agents operate through Token Bound Accounts (TBAs) — smart contract wallets owned by the agent's NFT. The protocol focuses on consumer-facing AI experiences with financial incentives.

### What Is Missing

- No on-chain spending limits on TBA-held funds
- No execution receipts for agent actions
- No monitoring or dispute resolution
- Token bonding curves create speculative incentives but not execution accountability
- No portable reputation system — agent value is tied to token price, not execution history

### Integration Path

**Approach:** IRSB Guard on agent TBAs.

```
Virtuals Agent TBA
  └── IRSB Guard (installed on Token Bound Account)
       ├── Enforce spend limits on agent transactions
       ├── Whitelist approved contracts and methods
       ├── Post receipts for verifiable execution history
       ├── Enable dispute resolution for token holders
       └── Build execution-based reputation (complement to token price)
```

**Key contacts / resources:**
- Repository: Virtuals Protocol (partially open source)
- Documentation: [Virtuals Developer Docs](https://docs.virtuals.io)
- Community: Discord, Telegram

### Technical Notes

- TBAs (ERC-6551) can implement custom execution logic, making IRSB guard integration technically feasible
- The speculative nature of Virtuals' token model means IRSB adds a fundamentally different value proposition — execution accountability vs. market sentiment
- Lower priority because the primary audience is consumer/speculative rather than developer/infrastructure

---

## Outreach Strategy

### Phase 1: Technical Credibility (Current)
- Deploy demonstration on Sepolia with documented enforcer configuration
- Publish EthResearch post establishing the problem and IRSB's approach
- Build reference integration for one Tier 1 framework

### Phase 2: Framework Engagement
- Open discussions in ElizaOS and Safe developer channels
- Submit integration proposals as framework-native plugins/modules
- Demonstrate working integration with real agent wallets

### Phase 3: Standard Proposal
- Propose ERC for agent wallet guardrails based on the WalletDelegate + enforcer pattern
- Build coalition across frameworks for standard adoption
- Mainnet deployment with production monitoring data
