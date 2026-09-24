# On-Chain Accountability as Competitive Moat

> Strategic vision: How IRSB + Moat + Scout creates a defensible, economically-secured accountability layer for AI agent work.
> Last updated: 2026-03-04

---

## The Problem Nobody Else Solves

Every AI agent framework gives agents wallet access. None provide:
- **Cryptographic proof** of what the agent actually did
- **Economic consequences** for bad work (bond slashing)
- **Automated enforcement** of execution policy (on-chain, not honor-system)
- **Portable reputation** that agents carry across platforms

Soft reputation systems (database attestations, API-backed trust scores) have a fundamental weakness: the authority backing them can be compromised, bribed, or simply wrong. They require trusting someone.

IRSB replaces trust with math and economics.

---

## The Three-Layer Stack

### Layer 1: IRSB Protocol — Cryptographic Accountability

Every piece of work produces an on-chain receipt:

```
Intent → Solver executes → Evidence bundle → Receipt posted on IntentReceiptHub
   ↓                                              ↓
1hr challenge window                    Watchtower monitors
   ↓                                              ↓
Finalized (reputation ↑)               Disputed → bond slashing
```

**Why this is defensible:**
- Receipts are immutable and on-chain — no central authority can alter or delete them
- Solver bonds (0.1 ETH minimum, 5% volume-proportional) create real economic skin in the game
- Dispute resolution is automated (watchtower) and programmable (DisputeModule)
- "Can't stamp your own work" — receipts require verifiable evidence, and anyone can challenge

### Layer 2: Moat — Policy-Enforced Execution

Every agent call passes through the Moat Gateway, which enforces:
- **Scope policies** — which capabilities the agent can access
- **Budget policies** — spending limits per tenant/time period
- **Domain allowlists** — no open proxy, only declared outbound domains
- **Default-deny** — if not explicitly allowed, it's blocked

The Gateway produces a receipt on every call (append-only audit trail) and routes work through the appropriate adapter.

### Layer 3: Scout — Intelligent Brokering

Scout discovers available work (bounties on Algora, Gitcoin, Polar, GitHub), matches it to the right solver/agent, and routes it through Moat. This is the "matchmaking brain" — it doesn't do the work, it finds the right worker and ensures the work flows through policy enforcement.

---

## What Makes This a Moat (Not Just a Feature)

### 1. On-Chain Receipts > Database Attestations

A database-backed reputation system (even an auditable one like Dolt) requires trusting the database operator. On-chain receipts are:
- **Permissionless** — anyone can verify, no API key needed
- **Immutable** — can't be silently edited or deleted
- **Composable** — other protocols can build on top without permission
- **Portable** — an agent's track record follows it everywhere

### 2. Economic Security > Honor Systems

Solver bonds create real consequences:
- **0.1 ETH minimum bond** to register
- **Volume-proportional bonding** (5% of volume handled)
- **3-strikes jail** → permanent ban
- **Slashing distribution** — 80% to user, 15% to challenger, 5% to treasury

An honor-system "trust score" costs nothing to game. A bonded system costs real money to attack.

### 3. Programmable Policy > Manual Review

EIP-7702 delegation with 5 caveat enforcers means agents operate within cryptographically-enforced guardrails:
- SpendLimitEnforcer — daily + per-tx caps
- TimeWindowEnforcer — session time bounds
- AllowedTargetsEnforcer — contract whitelist
- AllowedMethodsEnforcer — function selector whitelist
- NonceEnforcer — replay prevention

These execute on-chain. There's no "trust me, I'll follow the rules." The rules are the code.

### 4. Automated Monitoring > Trust and Verify

The Watchtower runs continuously:
- Scans all receipts in challenge windows
- Evaluates configurable rules (e.g., ReceiptStaleRule auto-challenges at 55 minutes)
- Files disputes automatically, with evidence
- Circuit breaker + retry for resilience

This means bad actors get caught by software, not by humans reviewing logs weeks later.

### 5. Standards Composability > Walled Gardens

IRSB implements 6 Ethereum standards (ERC-7683, EIP-7702, ERC-7710, ERC-7715, ERC-8004, x402). Other protocols can:
- Query any agent's receipt history on-chain
- Build their own watchtower rules
- Use IRSB receipts as inputs to their own systems
- Integrate via SDK without permission

---

## Concept Mapping

| Traditional Accountability | IRSB Equivalent | Why It's Better |
|---|---|---|
| Work queue / job board | Bounty platforms (Algora, Gitcoin, GitHub) | Scout discovers + routes automatically |
| Worker picks up task | Scout matches intent to solver via Moat | Policy-enforced, not open proxy |
| Completion stamp / attestation | IntentReceiptHub on-chain receipt | Cryptographic, immutable, permissionless |
| Trust levels / reputation tiers | Caveat enforcers (spend, time, target, method) | Programmable, on-chain enforcement |
| Auditable ledger (database) | Blockchain | No trust required, inherently auditable |
| Bad work → complaint | Dispute → bond slashing (watchtower auto-files) | Economic consequences, automated |
| Reputation score | IntentScore (on-chain, decaying) | 30-day half-life, composable, portable |

---

## Competitive Landscape

### Web2 MCP Governance

Runlayer ($11M), Natoma ($7M), Acuvity, Lasso — all provide AI agent governance but **none have cryptographic receipts or on-chain enforcement**. They're database-backed honor systems with dashboards.

### Web3 Intent Protocols

CoW Protocol, Across/UMA, Coinbase AgentKit+x402 — handle on-chain intents but **none have the Web2 dimension** (MCP governance, bounty discovery, policy enforcement layer).

### The Gap IRSB Fills

**Unified Web2 + Web3 intent governance with cryptographic accountability.** Nobody else occupies this position.

### Strategic Threats

1. Coinbase assembles the full stack first (AgentKit + x402 + accountability)
2. ERC-7683/OIF adds their own accountability layer
3. Runlayer adds on-chain proofs to their existing governance

### Regulatory Tailwind

EU AI Act compliance deadline: August 2, 2026 (high-risk AI systems). IRSB receipts natively satisfy the record-keeping and traceability requirements. This is a selling point, not an afterthought.

---

## The Full Flow

```
1. Work appears (bounty, intent, API request)
        ↓
2. Scout discovers it (bounty.discover across 4 platforms)
        ↓
3. Scout matches to solver/agent (capability matching)
        ↓
4. Routed through Moat Gateway (policy enforcement)
        ↓
5. Solver executes (deterministic, evidence-producing)
        ↓
6. Receipt posted on-chain (IntentReceiptHub)
        ↓
7. 1-hour challenge window (watchtower monitors)
        ↓
8. Finalized → reputation updated (IntentScore)
   OR Disputed → bond slashed → attacker pays
        ↓
9. Indexed (Envio HyperIndex → GraphQL)
        ↓
10. Visible on dashboard (irsb-protocol.web.app)
```

Every step is auditable. Every receipt is permanent. Every bad actor pays.
