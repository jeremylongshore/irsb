# Twitter/X Thread: On-Chain Guardrails for AI Agents

> **034-MK-CONT** | Marketing Content
> Last updated: 2026-02-09

---

## Thread (10 tweets)

### 1/10 — Hook

Every major AI agent framework gives agents wallet access.

None of them prove what the agent did, limit what it can spend, or provide recourse when things go wrong.

This is a structural gap in on-chain AI infrastructure.

### 2/10 — The landscape

AgentKit: Coinbase API wallet. No limits.
ElizaOS: Lit/KMS keys. No receipts.
Olas: Safe multisig. Consensus, but no proof.
Virtuals: Token-bonded accounts. No guards.

Every framework assumes the agent will behave correctly. None enforce it on-chain.

### 3/10 — The real risk

AI agents face the same attack vectors as any EOA — prompt injection, key compromise, logic bugs — but they operate autonomously.

A compromised agent can drain funds before a human notices. Princeton researchers demonstrated this with ElizaOS in 2025.

### 4/10 — What's needed

On-chain policy enforcement. Not off-chain checks. Not "trust the framework." Not "the agent is well-prompted."

Actual EVM-level constraints that the agent cannot bypass regardless of what its prompt says.

### 5/10 — EIP-7702 delegation

IRSB uses EIP-7702 to delegate an agent's wallet to a WalletDelegate contract. Every transaction must pass through five on-chain caveat enforcers:

- Spend limits (daily + per-tx)
- Time windows
- Approved contracts
- Approved methods
- Replay prevention

### 6/10 — Receipts

Every successful transaction produces a cryptographic receipt on-chain. The receipt contains:

- What the agent intended to do
- What constraints it was operating under
- What actually happened
- The agent's cryptographic signature

Verifiable by anyone. Stored permanently.

### 7/10 — Automated monitoring

The IRSB watchtower independently scans receipts and files disputes when violations occur. No human intervention required.

1-hour challenge window. Deterministic violations auto-resolve. Slashed bonds: 80% to the user, 15% to the challenger.

### 8/10 — Portable reputation

Agents build on-chain track records via ERC-8004. IntentScore is a composite metric from execution history — success rate, dispute outcomes, stake, longevity.

New protocols can query an agent's reputation before granting access. No more starting from zero.

### 9/10 — Deployed now

This is not a whitepaper. All contracts are live on Sepolia:

- WalletDelegate + 5 enforcers
- IntentReceiptHub
- SolverRegistry + DisputeModule
- ERC-8004 Agent #967

426 tests. Cloud KMS signing. Open source (MIT).

github.com/intent-solutions-io

### 10/10 — CTA

Agent wallets need the same rigor we apply to smart contract security — on-chain constraints, verifiable execution, and automated monitoring.

We are integrating with agent frameworks now. If you are building agents with wallet access, reach out.

jeremy@intentsolutions.io

---

## Notes

- Total character count per tweet stays under 280
- Thread connects as a narrative: problem → landscape → risk → solution → deployed → CTA
- No promotional language or unsubstantiated claims
- All technical details are accurate to deployed contracts
- Links to GitHub org, not individual repos (cleaner)
