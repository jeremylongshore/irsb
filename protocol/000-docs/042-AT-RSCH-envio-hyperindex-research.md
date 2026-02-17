# Envio HyperIndex: Blockchain Indexing Research for IRSB

**Technical Assessment & Strategic Recommendation**

---

**Document ID:** IRSB-RESEARCH-2026-001
**Date:** February 17, 2026
**Author:** IRSB Technical Team
**Classification:** Internal Research Document

---

## Executive Summary

IRSB's current blockchain indexing infrastructure is non-functional. The existing Graph Protocol subgraph covers only 3 of 8+ deployed contracts, has placeholder deployment URLs, and has never been deployed to production. This leaves the SDK, Dashboard, Watchtower, and AI Agents without historical blockchain data access.

This document evaluates **Envio HyperIndex** as a potential replacement, analyzes 10 competing solutions, assesses risks, and provides a phased implementation recommendation.

### Key Findings

| Category | Assessment |
|----------|------------|
| **Speed** | 103x faster than The Graph (benchmarked) |
| **Developer Experience** | TypeScript handlers (vs AssemblyScript) |
| **Cost** | Free tier sufficient for testnet + early mainnet |
| **Risk** | Medium-High (proprietary EULA, vendor lock-in) |
| **Recommendation** | Adopt Envio with Ponder as open-source fallback |

### Decision Framework

```
┌─────────────────────────────────────────────────────────────────┐
│  IF speed + DX matter most         → Envio HyperIndex          │
│  IF open-source is mandatory       → Ponder (MIT license)      │
│  IF decentralization is critical   → The Graph (fix subgraph)  │
│  IF managed service preferred      → Goldsky                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Product Deep-Dive: Envio HyperIndex](#2-product-deep-dive-envio-hyperindex)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Risk Analysis](#4-risk-analysis)
5. [Risk Mitigation Strategy](#5-risk-mitigation-strategy)
6. [IRSB Application & Requirements](#6-irsb-application--requirements)
7. [Feasibility Assessment](#7-feasibility-assessment)
8. [Recommendation](#8-recommendation)
9. [Appendix A: Event Coverage Matrix](#appendix-a-event-coverage-matrix)
10. [Appendix B: Pricing Comparison](#appendix-b-pricing-comparison)
11. [Appendix C: Decision Framework](#appendix-c-decision-framework)

---

## 1. Current State Assessment

### 1.1 Existing Subgraph Status: NON-FUNCTIONAL

The Graph Protocol subgraph located at `protocol/subgraph/` is incomplete and has never been deployed:

| Aspect | Current State | Required State |
|--------|---------------|----------------|
| **Contracts Indexed** | 3 | 8+ |
| **Deployment Status** | Placeholder URLs | Production endpoint |
| **Event Coverage** | ~40% | 100% |
| **SDK Integration** | Broken | Functional |
| **Dashboard Queries** | Failing | Working |

### 1.2 Contracts Currently Indexed

```yaml
dataSources:
  - SolverRegistry      # ✅ Indexed
  - IntentReceiptHub    # ✅ Indexed
  - DisputeModule       # ✅ Indexed
```

### 1.3 Contracts MISSING from Subgraph

| Contract | Purpose | Impact of Missing |
|----------|---------|-------------------|
| **WalletDelegate** | EIP-7702 delegation | No delegation monitoring |
| **X402Facilitator** | Payment settlement | No payment history |
| **EscrowVault** | Escrow management | No escrow tracking |
| **OptimisticDisputeModule** | Counter-bonds | Incomplete dispute flow |
| **ReceiptV2Extension** | Dual attestation | No V2 receipt queries |
| **CaveatEnforcers** | Spending limits | No limit enforcement data |

### 1.4 Consumer Impact

Four critical ecosystem components depend on indexed blockchain data:

```
┌─────────────────────────────────────────────────────────────────┐
│                    INDEXING CONSUMERS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Watchtower │    │     SDK     │    │  Dashboard  │         │
│  │             │    │             │    │             │         │
│  │ Real-time   │    │ Query API   │    │ Historical  │         │
│  │ monitoring  │    │ for dApps   │    │ analytics   │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                    ┌───────▼───────┐                            │
│                    │  AI Agents    │                            │
│                    │               │                            │
│                    │  RAG context  │                            │
│                    │  for LLMs     │                            │
│                    └───────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Product Deep-Dive: Envio HyperIndex

### 2.1 Architecture Overview

Envio HyperIndex is a real-time blockchain indexing framework that replaces traditional RPC-based indexing with a proprietary **HyperSync** engine.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENVIO ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Blockchain │───▶│  HyperSync  │───▶│  Handlers   │         │
│  │   Nodes     │    │   Engine    │    │ (TypeScript)│         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
│                                               │                 │
│                                        ┌──────▼──────┐         │
│                                        │  PostgreSQL │         │
│                                        │  (managed)  │         │
│                                        └──────┬──────┘         │
│                                               │                 │
│                                        ┌──────▼──────┐         │
│                                        │  GraphQL    │         │
│                                        │    API      │         │
│                                        └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Technology: HyperSync

| Component | Description |
|-----------|-------------|
| **Engine** | Rust-based, bypasses JSON-RPC entirely |
| **Data Source** | Optimized node snapshots (not live RPC) |
| **Speed Claim** | 2000x faster than standard RPC |
| **Benchmark** | 103x faster than The Graph for historical sync |

### 2.3 Developer Experience

```typescript
// Example: Envio handler for IRSB ReceiptPosted event
import { IntentReceiptHub } from "generated";

IntentReceiptHub.ReceiptPosted.handler(async ({ event, context }) => {
  const receipt = {
    id: event.params.receiptId,
    intentHash: event.params.intentHash,
    solverId: event.params.solverId,
    timestamp: event.params.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  };

  context.Receipt.set(receipt);

  // Full TypeScript - can call external APIs, use npm packages
  await notifyWatchtower(receipt);
});
```

### 2.4 Key Differentiators vs The Graph

| Feature | Envio HyperIndex | The Graph |
|---------|-----------------|-----------|
| **Sync Speed** | 103x faster (benchmarked) | Baseline |
| **Language** | TypeScript/ReScript | AssemblyScript (limited) |
| **External Calls** | Yes (fetch, npm packages) | No (sandboxed WASM) |
| **Hosting** | Managed + self-hosted | Decentralized + hosted |
| **Multi-chain** | Single config for 70+ chains | One subgraph per chain |
| **Real-time** | WebSocket streaming | Polling-based |
| **Wildcard Indexing** | Yes (all matching events) | Limited (factory only) |
| **Dynamic Sources** | Yes (register at runtime) | Yes (templates) |

### 2.5 Pricing Tiers

| Tier | Monthly Cost | Events/Day | Storage | Support |
|------|-------------|------------|---------|---------|
| **Free** | $0 | 500K | 1GB | Community |
| **Growth** | $200 | 5M | 10GB | Email |
| **Premium** | $800 | 50M | 100GB | Priority |
| **Enterprise** | Custom | Unlimited | Custom | SLA |

### 2.6 Chain Support

**70+ EVM chains supported:**

- Ethereum Mainnet, Sepolia, Goerli
- Arbitrum One, Arbitrum Nova
- Base, Base Sepolia
- Optimism, OP Sepolia
- Polygon, Polygon zkEVM
- BSC, Avalanche C-Chain
- Linea, Scroll, zkSync Era
- Blast, Mantle, Mode
- And 50+ more...

### 2.7 Licensing: CRITICAL CONSIDERATION

| Aspect | Details |
|--------|---------|
| **License Type** | Proprietary EULA |
| **Open Source** | NO - source visible but not OSS |
| **Redistribution** | Prohibited without permission |
| **Commercial Use** | Restricted by EULA terms |
| **IRSB Conflict** | IRSB is MIT - creates asymmetry |

---

## 3. Competitive Landscape

### 3.1 Tier 1: Direct Competitors (Indexing Frameworks)

#### The Graph Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│  THE GRAPH                                                      │
├─────────────────────────────────────────────────────────────────┤
│  Type: Decentralized indexing network                          │
│  Language: AssemblyScript (WebAssembly)                        │
│  Chains: 80+                                                    │
│  Pricing: GRT tokens per query                                  │
│  License: Apache 2.0 (open source)                              │
├─────────────────────────────────────────────────────────────────┤
│  Strengths:                                                     │
│  • Decentralization (no single point of failure)                │
│  • Large ecosystem and community                                │
│  • Industry standard                                            │
│  • Open source                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Weaknesses:                                                    │
│  • Slow historical sync                                         │
│  • AssemblyScript is painful                                    │
│  • Query costs scale with usage                                 │
│  • No external API calls in handlers                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Goldsky

```
┌─────────────────────────────────────────────────────────────────┐
│  GOLDSKY                                                        │
├─────────────────────────────────────────────────────────────────┤
│  Type: Managed indexing + streaming platform                    │
│  Features: Mirror (real-time pipelines), Subgraph hosting       │
│  Chains: 140+ (most extensive)                                  │
│  Pricing: Custom/enterprise                                     │
│  License: Proprietary                                           │
├─────────────────────────────────────────────────────────────────┤
│  Strengths:                                                     │
│  • Most chains supported                                        │
│  • Direct database streaming (PostgreSQL, Kafka)                │
│  • No custom code for basic cases                               │
│  • Real-time streaming architecture                             │
├─────────────────────────────────────────────────────────────────┤
│  Weaknesses:                                                    │
│  • Fully managed only (no self-host)                            │
│  • Enterprise pricing                                           │
│  • Complete vendor lock-in                                      │
└─────────────────────────────────────────────────────────────────┘
```

#### Ponder (Open Source)

```
┌─────────────────────────────────────────────────────────────────┐
│  PONDER                                                         │
├─────────────────────────────────────────────────────────────────┤
│  Type: TypeScript-first indexing framework                      │
│  Language: TypeScript                                           │
│  Chains: ~20 (growing)                                          │
│  Pricing: Free (self-hosted only)                               │
│  License: MIT (true open source)                                │
├─────────────────────────────────────────────────────────────────┤
│  Strengths:                                                     │
│  • True open source (MIT license)                               │
│  • Excellent developer experience                               │
│  • Hot reloading in development                                 │
│  • Type-safe schema                                             │
│  • No vendor lock-in                                            │
├─────────────────────────────────────────────────────────────────┤
│  Weaknesses:                                                    │
│  • Smaller ecosystem                                            │
│  • No managed hosting option                                    │
│  • Fewer chains (~20 vs 70+)                                    │
│  • Self-hosting burden                                          │
└─────────────────────────────────────────────────────────────────┘
```

#### Subsquid

```
┌─────────────────────────────────────────────────────────────────┐
│  SUBSQUID                                                       │
├─────────────────────────────────────────────────────────────────┤
│  Status: ACQUIRED by Rezolve AI (January 2026)                  │
│  Type: Decentralized data lake with SQD token                   │
│  Language: TypeScript processors                                │
│  Future: UNCERTAIN - pivoting to AI focus                       │
├─────────────────────────────────────────────────────────────────┤
│  Assessment: NOT RECOMMENDED for new projects                   │
│  Reason: Acquisition creates uncertainty about roadmap          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Tier 2: Analytics Platforms

| Platform | Type | Real-time | Custom Indexing | Use Case |
|----------|------|-----------|-----------------|----------|
| **Dune Analytics** | SQL dashboards | No | No | Public analytics |
| **Nansen** | Wallet labeling | Partial | No | Whale tracking |
| **Covalent** | Unified API | No | No | Cross-chain queries |

### 3.3 Tier 3: Node Provider Add-ons

| Provider | Feature | Description |
|----------|---------|-------------|
| **Alchemy** | Subgraph Hosting | Hosts The Graph subgraphs |
| **QuickNode** | Streams | Real-time webhook events |
| **Moralis** | Streams | Webhook-based event delivery |

### 3.4 Competitive Matrix

| Solution | Speed | Open Source | Self-Host | Multi-chain | TypeScript | Monthly Cost |
|----------|-------|-------------|-----------|-------------|------------|--------------|
| **Envio** | Fastest | No (EULA) | Yes | 70+ | Yes | $0-800 |
| **The Graph** | Slow | Yes (Apache) | Yes | 80+ | No (AS) | GRT tokens |
| **Goldsky** | Fast | No | No | 140+ | Partial | Enterprise |
| **Ponder** | Medium | Yes (MIT) | Yes | ~20 | Yes | $0 (infra) |
| **Subsquid** | Medium | Uncertain | Was yes | 50+ | Yes | Uncertain |

---

## 4. Risk Analysis

### 4.1 Risk Summary Matrix

| Risk Category | Severity | Likelihood | Impact | Mitigation |
|---------------|----------|------------|--------|------------|
| Vendor Lock-in | HIGH | High | High | Dual-indexer architecture |
| Business Continuity | MEDIUM | Medium | High | Open-source fallback |
| Licensing Asymmetry | MEDIUM-HIGH | High | Medium | Document + communicate |
| Cost Escalation | LOW-MEDIUM | Low | Medium | Monitor + plan |
| Technical Integration | LOW | Low | Low | Standard TypeScript |

### 4.2 Detailed Risk Analysis

#### Risk 1: Vendor Lock-in (SEVERITY: HIGH)

```
┌─────────────────────────────────────────────────────────────────┐
│  VENDOR LOCK-IN RISK                                            │
├─────────────────────────────────────────────────────────────────┤
│  Severity: HIGH                                                 │
│  Likelihood: HIGH (by design)                                   │
├─────────────────────────────────────────────────────────────────┤
│  Factors:                                                       │
│  • Proprietary EULA prevents forking                            │
│  • HyperSync is closed-source (core speed advantage)            │
│  • Cannot self-host with full functionality                     │
│  • Migration requires handler rewrite                           │
├─────────────────────────────────────────────────────────────────┤
│  Mitigation:                                                    │
│  • Keep handler logic decoupled from Envio-specific APIs        │
│  • Maintain abstraction layer for indexer switching             │
│  • Document portable handler patterns                           │
│  • Maintain Ponder fallback                                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Risk 2: Business Continuity (SEVERITY: MEDIUM)

```
┌─────────────────────────────────────────────────────────────────┐
│  BUSINESS CONTINUITY RISK                                       │
├─────────────────────────────────────────────────────────────────┤
│  Severity: MEDIUM                                               │
│  Likelihood: MEDIUM                                             │
├─────────────────────────────────────────────────────────────────┤
│  Factors:                                                       │
│  • VC-funded startup (acquisition/pivot risk)                   │
│  • Subsquid precedent: acquired by Rezolve AI (Jan 2026)        │
│  • No decentralization ensuring continuity                      │
│  • Single company controls infrastructure                       │
├─────────────────────────────────────────────────────────────────┤
│  Mitigation:                                                    │
│  • Self-hosting exists (degraded without HyperSync)             │
│  • PostgreSQL data is exportable                                │
│  • Ponder fallback provides continuity                          │
│  • Monitor company health signals                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Risk 3: Licensing Asymmetry (SEVERITY: MEDIUM-HIGH)

```
┌─────────────────────────────────────────────────────────────────┐
│  LICENSING ASYMMETRY RISK                                       │
├─────────────────────────────────────────────────────────────────┤
│  Severity: MEDIUM-HIGH                                          │
│  Likelihood: HIGH (immediate)                                   │
├─────────────────────────────────────────────────────────────────┤
│  Factors:                                                       │
│  • IRSB is MIT open-source                                      │
│  • Envio is proprietary EULA                                    │
│  • Contributors cannot fully replicate stack                    │
│  • Community perception risk                                    │
│  • Philosophically inconsistent                                 │
├─────────────────────────────────────────────────────────────────┤
│  Mitigation:                                                    │
│  • Use Envio as one option, not the only option                 │
│  • Maintain open-source fallback (Ponder)                       │
│  • Document in project README                                   │
│  • Community can use Ponder if preferred                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Risk 4: Cost Escalation (SEVERITY: LOW-MEDIUM)

```
┌─────────────────────────────────────────────────────────────────┐
│  COST ESCALATION RISK                                           │
├─────────────────────────────────────────────────────────────────┤
│  Severity: LOW-MEDIUM                                           │
│  Likelihood: LOW (current volume)                               │
├─────────────────────────────────────────────────────────────────┤
│  Current State:                                                 │
│  • Sepolia testnet volume: negligible                           │
│  • Free tier: 500K events/day (more than sufficient)            │
│                                                                 │
│  Projection:                                                    │
│  • Early mainnet: Free tier adequate                            │
│  • Growth phase: $200/mo Growth tier                            │
│  • Scale phase: $800/mo or self-host                            │
├─────────────────────────────────────────────────────────────────┤
│  Mitigation:                                                    │
│  • Start on free tier                                           │
│  • Monitor event volume                                         │
│  • Budget for Growth tier at mainnet launch                     │
│  • Evaluate self-hosting at scale                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Risk Mitigation Strategy

### 5.1 Dual-Indexer Architecture (RECOMMENDED)

```
┌─────────────────────────────────────────────────────────────────┐
│                 DUAL-INDEXER ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌─────────────────┐                          │
│                    │ @irsb/indexer-  │                          │
│                    │     client      │                          │
│                    │  (abstraction)  │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│              ┌──────────────┼──────────────┐                    │
│              │              │              │                    │
│              ▼              ▼              ▼                    │
│     ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│     │   Envio    │  │   Ponder   │  │  Subgraph  │             │
│     │  Adapter   │  │  Adapter   │  │  Adapter   │             │
│     │ (primary)  │  │ (fallback) │  │  (legacy)  │             │
│     └────────────┘  └────────────┘  └────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Abstraction Package Structure

```
packages/indexer-client/
├── src/
│   ├── types.ts          # Common query types
│   ├── interface.ts      # IndexerClient interface
│   ├── envio.ts          # Envio HyperIndex adapter
│   ├── ponder.ts         # Ponder adapter (fallback)
│   └── subgraph.ts       # The Graph adapter (legacy)
├── package.json
└── tsconfig.json
```

### 5.3 Portable Handler Pattern

```typescript
// Shared business logic (portable)
// Located in packages/indexer-handlers/

export function processReceiptPosted(event: ReceiptEvent): Receipt {
  return {
    id: event.receiptId,
    intentHash: event.intentHash,
    solverId: event.solverId,
    timestamp: event.timestamp,
    status: 'posted',
  };
}

// Envio-specific wrapper (thin)
IntentReceiptHub.ReceiptPosted.handler(async ({ event, context }) => {
  const receipt = processReceiptPosted(event.params);
  context.Receipt.set(receipt);
});

// Ponder-specific wrapper (thin)
ponder.on("IntentReceiptHub:ReceiptPosted", async ({ event, context }) => {
  const receipt = processReceiptPosted(event.args);
  await context.db.Receipt.create({ data: receipt });
});
```

---

## 6. IRSB Application & Requirements

### 6.1 Consumer Requirements

| Consumer | Data Needs | Latency Requirement |
|----------|------------|---------------------|
| **Watchtower** | Real-time events | <1 second |
| **SDK** | Historical queries | <100ms |
| **Dashboard** | Analytics, charts | <500ms |
| **AI Agents** | RAG context | <1 second |

### 6.2 Events Requiring Indexing

#### Core Protocol Events

| Contract | Event | Fields | Consumers |
|----------|-------|--------|-----------|
| SolverRegistry | SolverRegistered | solverId, operator, metadata | All |
| SolverRegistry | BondDeposited | solverId, amount, newTotal | SDK, Dashboard |
| SolverRegistry | SolverSlashed | solverId, amount, disputeId | Watchtower, Dashboard |
| SolverRegistry | ReputationUpdated | solverId, oldScore, newScore | SDK, Agents |

#### Receipt Events

| Contract | Event | Fields | Consumers |
|----------|-------|--------|-----------|
| IntentReceiptHub | ReceiptPosted | receiptId, intentHash, solverId | All |
| IntentReceiptHub | ReceiptFinalized | receiptId, intentHash | SDK, Dashboard |
| IntentReceiptHub | DisputeOpened | receiptId, intentHash, challenger | Watchtower |
| ReceiptV2Extension | V2ReceiptPosted | receiptId, solverSig, clientSig | SDK |
| ReceiptV2Extension | ClientAttested | receiptId, attestation | SDK |

#### Dispute Events

| Contract | Event | Fields | Consumers |
|----------|-------|--------|-----------|
| DisputeModule | DisputeCreated | disputeId, receiptId, challenger | All |
| DisputeModule | EvidenceSubmitted | disputeId, submitter, hash | Watchtower |
| DisputeModule | DisputeResolved | disputeId, outcome, slashAmount | All |
| OptimisticDisputeModule | CounterBondPosted | disputeId, amount | Dashboard |
| OptimisticDisputeModule | DisputeEscalated | disputeId, arbitrator | Watchtower |

#### Delegation Events

| Contract | Event | Fields | Consumers |
|----------|-------|--------|-----------|
| WalletDelegate | DelegationSet | wallet, delegate, caveats | Watchtower |
| WalletDelegate | DelegationRevoked | wallet, delegate | Watchtower |
| WalletDelegate | ExecutionAttempted | wallet, success, reason | Agents |

#### Payment Events

| Contract | Event | Fields | Consumers |
|----------|-------|--------|-----------|
| X402Facilitator | PaymentFacilitated | paymentId, amount, solver | SDK |
| X402Facilitator | PaymentDelegated | paymentId, delegator | SDK |
| EscrowVault | EscrowCreated | escrowId, amount, parties | SDK |
| EscrowVault | EscrowReleased | escrowId, recipient | SDK |

### 6.3 Strategic Value

| Benefit | Description | Impact |
|---------|-------------|--------|
| **Unblocks Dashboard** | Currently non-functional for historical data | High |
| **Accelerates Watchtower** | Real-time vs polling (minutes → seconds) | High |
| **Enables Agent RAG** | Historical data feeds AI knowledge base | Medium |
| **Multi-chain Ready** | Single config for L2 deployments | High |
| **Developer Adoption** | Working SDK = lower integration barrier | High |

---

## 7. Feasibility Assessment

### 7.1 Migration Options Comparison

| Option | Effort | Pros | Cons |
|--------|--------|------|------|
| **A: Envio** | ~2 weeks | Fastest sync, TypeScript, managed | Proprietary, vendor risk |
| **B: Fix Subgraph** | ~3 weeks | Open source, decentralized | AssemblyScript, slow sync |
| **C: Ponder** | ~2 weeks | MIT license, TypeScript | No managed hosting |

### 7.2 Recommended Approach: Option A + C Hybrid

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION TIMELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Envio Setup (Week 1-2)                               │
│  ├── Initialize Envio project                                  │
│  ├── Generate handlers from ABIs (8 contracts)                 │
│  ├── Deploy to Envio hosted service (free tier)                │
│  ├── Update SDK with Envio endpoints                           │
│  └── Fix Dashboard GraphQL queries                             │
│                                                                 │
│  Phase 2: Ponder Fallback (Week 3-4)                           │
│  ├── Initialize Ponder project                                 │
│  ├── Port handler logic from Envio                             │
│  ├── Create @irsb/indexer-client abstraction                   │
│  └── Self-host Ponder instance                                 │
│                                                                 │
│  Phase 3: Integration (Week 5)                                 │
│  ├── Update Watchtower to use indexer-client                   │
│  ├── Configure AI Agents with indexed data                     │
│  └── Documentation and runbooks                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 What NOT to Do

| Anti-pattern | Reason |
|--------------|--------|
| Fix existing subgraph | AssemblyScript is painful, The Graph is slow |
| Build custom indexer | Reinventing the wheel |
| Commit to Envio only | No fallback = unacceptable risk |
| Over-engineer abstraction | YAGNI - start simple |

---

## 8. Recommendation

### 8.1 Primary Recommendation

**Adopt Envio HyperIndex as primary indexer with Ponder as open-source fallback.**

### 8.2 Phased Implementation

#### Phase 1: Now (Testnet)

- Set up Envio HyperIndex for all 8 IRSB contracts on Sepolia
- Use free tier (more than sufficient)
- Replace broken subgraph URLs in SDK and Dashboard
- Estimated effort: 2 weeks

#### Phase 2: Pre-Mainnet

- Add Ponder as open-source fallback
- Port handler logic to Ponder format
- Create `@irsb/indexer-client` abstraction package
- Self-host Ponder instance as backup
- Estimated effort: 2 weeks

#### Phase 3: Post-Mainnet

- Monitor event volume against tier limits
- Evaluate: <500K events/day → stay on free tier
- Scaling: evaluate Growth tier ($200/mo) vs self-hosted Ponder
- If Envio changes terms: switch to Ponder with minimal code changes

### 8.3 Decision Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│  WHEN TO USE EACH INDEXER                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Use ENVIO when:                                                │
│  • Speed is critical (Watchtower real-time monitoring)          │
│  • Hosted service acceptable                                    │
│  • Budget allows Growth/Premium tier                            │
│                                                                 │
│  Use PONDER when:                                               │
│  • Open source is mandatory                                     │
│  • Self-hosting is required                                     │
│  • Envio becomes unavailable                                    │
│  • Community contributors need full stack                       │
│                                                                 │
│  Use SUBGRAPH when:                                             │
│  • Decentralization is critical                                 │
│  • Already invested in The Graph ecosystem                      │
│  • GRT token economics work for use case                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Event Coverage Matrix

| Contract | Event | Subgraph | Envio | Ponder |
|----------|-------|----------|-------|--------|
| SolverRegistry | SolverRegistered | ✅ | ✅ | ✅ |
| SolverRegistry | BondDeposited | ✅ | ✅ | ✅ |
| SolverRegistry | BondWithdrawn | ✅ | ✅ | ✅ |
| SolverRegistry | SolverSlashed | ✅ | ✅ | ✅ |
| SolverRegistry | SolverStatusChanged | ✅ | ✅ | ✅ |
| IntentReceiptHub | ReceiptPosted | ✅ | ✅ | ✅ |
| IntentReceiptHub | ReceiptFinalized | ✅ | ✅ | ✅ |
| IntentReceiptHub | DisputeOpened | ✅ | ✅ | ✅ |
| IntentReceiptHub | DisputeResolved | ✅ | ✅ | ✅ |
| DisputeModule | DisputeEscalated | ✅ | ✅ | ✅ |
| DisputeModule | EvidenceSubmitted | ✅ | ✅ | ✅ |
| DisputeModule | ArbitrationResolved | ✅ | ✅ | ✅ |
| WalletDelegate | DelegationSet | ❌ | ✅ | ✅ |
| WalletDelegate | DelegationRevoked | ❌ | ✅ | ✅ |
| WalletDelegate | ExecutionAttempted | ❌ | ✅ | ✅ |
| X402Facilitator | PaymentFacilitated | ❌ | ✅ | ✅ |
| X402Facilitator | PaymentDelegated | ❌ | ✅ | ✅ |
| EscrowVault | EscrowCreated | ❌ | ✅ | ✅ |
| EscrowVault | EscrowReleased | ❌ | ✅ | ✅ |
| OptimisticDisputeModule | CounterBondPosted | ❌ | ✅ | ✅ |
| OptimisticDisputeModule | DisputeEscalated | ❌ | ✅ | ✅ |
| ReceiptV2Extension | V2ReceiptPosted | ❌ | ✅ | ✅ |
| ReceiptV2Extension | ClientAttested | ❌ | ✅ | ✅ |

**Legend:** ✅ = Covered, ❌ = Not implemented

---

## Appendix B: Pricing Comparison

### Monthly Cost at Various Scales

| Scale | Envio | The Graph | Goldsky | Ponder |
|-------|-------|-----------|---------|--------|
| **Testnet** | $0 | $0 (hosted) | Custom | $0 (infra) |
| **100K events/day** | $0 | ~$50 GRT | Custom | $20 (VPS) |
| **1M events/day** | $0 | ~$200 GRT | Custom | $50 (VPS) |
| **10M events/day** | $200 | ~$1000 GRT | Custom | $200 (VPS) |
| **100M events/day** | $800 | ~$5000 GRT | Custom | $500 (VPS) |

### IRSB Projected Usage

| Phase | Estimated Events/Day | Recommended Tier |
|-------|---------------------|------------------|
| Testnet (now) | <10K | Envio Free |
| Early Mainnet | <100K | Envio Free |
| Growth | 100K-1M | Envio Free / Growth |
| Scale | 1M-10M | Envio Growth |

---

## Appendix C: Decision Framework

### Quick Decision Tree

```
START
  │
  ├── Is open source mandatory?
  │   ├── YES → Use Ponder
  │   └── NO → Continue
  │
  ├── Is decentralization critical?
  │   ├── YES → Fix The Graph subgraph
  │   └── NO → Continue
  │
  ├── Need managed hosting?
  │   ├── YES, and budget > $500/mo → Goldsky
  │   ├── YES, budget < $500/mo → Envio
  │   └── NO → Ponder (self-host)
  │
  └── Default recommendation: Envio + Ponder fallback
```

### Weighted Scoring (IRSB Priorities)

| Factor | Weight | Envio | The Graph | Ponder | Goldsky |
|--------|--------|-------|-----------|--------|---------|
| Speed | 25% | 10 | 3 | 6 | 8 |
| DX | 20% | 9 | 4 | 9 | 7 |
| Cost | 20% | 9 | 6 | 10 | 4 |
| Open Source | 15% | 2 | 9 | 10 | 2 |
| Chain Support | 10% | 8 | 9 | 5 | 10 |
| Risk | 10% | 5 | 8 | 9 | 4 |
| **Weighted Total** | 100% | **7.45** | 5.75 | **7.85** | 5.9 |

**Interpretation:** Ponder scores highest overall due to open-source bonus, but Envio wins on speed and DX. The hybrid approach captures both strengths.

---

## Document Information

**Version:** 1.0
**Status:** Final
**Prepared for:** IRSB Technical Decision Making
**Next Steps:** If approved, proceed with Phase 1 Envio implementation

---

*This document was prepared as part of IRSB infrastructure planning. For questions or clarifications, contact the IRSB Technical Team.*
