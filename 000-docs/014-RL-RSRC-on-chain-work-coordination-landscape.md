# On-Chain Work Coordination: State of the Ecosystem (2025-2026)

A thorough survey of everything that exists — and what doesn't — in the space of on-chain "wanted boards," work marketplaces, intent protocols, and reputation systems.

---

## Category 1: On-Chain Bounty / Job Boards

### Gitcoin Grants + Bounties
**Status: Partially alive, but pivoting hard away from bounties**

Gitcoin started as a bounty platform but has evolved almost entirely into a grants/quadratic funding machine. In 2025, the Grants Stack infrastructure is being sunset (May 27, 2025), and Gitcoin is doubling down on OSS funding rounds rather than individual task bounties. Their 2025 strategy is about distributing $4.29M across three OSS rounds — not matching buyers and sellers of work.

The Gitcoin Passport product was acquired by Holonym Foundation in February 2025 and rebranded as "Human Passport," now serving as a ZK-powered proof-of-humanity layer for 2M+ users.

**Verdict:** Not a bounty board in 2025. Reputation infrastructure only.

### Dework
**Status: Live, genuinely the closest thing to a web3 wanted board**

Dework is a web3-native task board built specifically for DAOs:
- Task posting with configurable claiming rules (open, gated, application-based)
- On-chain payments to contributors via their wallet
- Reputation tracking tied to completed work
- Discord integration

Used by Gitcoin DAO, Bankless DAO, Developer DAO, Juicebox DAO, ShapeShift DAO, and Aragon DAO. 135k monthly visits. Raised $5M seed.

**Gap:** Payments are triggered manually by admins (not smart-contract enforced). Reputation is siloed on Dework — it doesn't export composably to other platforms. Work verification is human-reviewed, not on-chain proof.

**Verdict:** Best working analog to a wanted board, but off-chain in execution mechanics.

### Layer3
**Status: Live, but it's a quest/gamification platform, not a work marketplace**

Layer3 is a "do tasks to earn rewards" platform, but the tasks are designed by protocols to drive user adoption — not real work. You complete on-chain actions (bridging, staking, using a DEX) and earn XP, NFTs (CUBEs), and tokens.

**Verdict:** Not a work coordination platform. It's a protocol growth tool.

### Wonderverse / Wonder
**Status: Mostly stagnant — last major activity in 2022-2023**

Wonder tried to be "Notion + GitHub + Bounties for DAOs" with on-chain resumes and batch payment features. Never achieved critical mass.

**Verdict:** Appears inactive in 2025.

### Bounties Network
**Status: Technically alive, practically dormant**

The Bounties Network (StandardBounties smart contracts) was one of the earliest on-chain bounty systems — anyone can post a task with ETH/ERC20 collateral, anyone can fulfill it, approvers accept submissions and trigger payment. Still deployed, no development since ~2019-2020.

**What it got right architecturally:** The StandardBounties smart contract is a clean primitive — post work, post payment, accept/reject fulfillments, release payment. This is exactly the wanted-board pattern at the contract level.

**Verdict:** Architecturally correct but abandoned.

### Immunefi
**Status: Thriving, but domain-specific (security only)**

Immunefi is a fully on-chain bug bounty platform — protocols deposit funds into vaults, security researchers find bugs, payouts happen on-chain. Has on-chain vault deposits, structured submission workflows, and whitehat reputation.

This is actually the closest to the full wanted-board pattern in production:
- Work posted with locked payment
- Solvers (researchers) claim and execute
- Verification by protocol + Immunefi triage
- On-chain payout
- Reputation earned (whitehat track record)

**Verdict:** Best working example of the pattern — but domain-locked to security.

---

## Category 2: Intent-Based Work Protocols

### CoW Protocol
**Status: Live on Ethereum + multiple chains**

CoW Protocol is the most mature solver-competition system live today:

1. User signs a "trade intent" (swap X for Y, with constraints)
2. Intents are batched per auction period
3. Solvers compete to submit the best solution (maximize user surplus)
4. Winning solver executes on-chain
5. Solver is rewarded in COW weekly

This is directly analogous to a wanted board with solver competition — someone posts "I want X done under these constraints," solvers race to do it best, the winner gets paid and reputation. **Key difference:** trade-domain only.

### UniswapX
**Status: Live, integrated with ERC-7683**

UniswapX uses "fillers" who compete via Dutch auction to fill user swap intents. Implements ERC-7683 for cross-chain intent standardization.

### 1inch Fusion
**Status: Live, growing strongly**

Fusion uses Dutch auctions where "resolvers" compete to fill swap intents. Q3 2025: 60.6% QoQ volume growth. Removed staking threshold in Q4 2025, making it merit-based rather than capital-gated.

### ERC-7683 (Cross-Chain Intents Standard)
**Status: Live standard, 70+ implementations**

ERC-7683 is the Ethereum standard for cross-chain intent execution. Defines:
- A standard `CrossChainOrder` struct
- `IOriginSettler` and `IDestinationSettler` interfaces
- A filler/solver pattern for cross-chain execution

The Ethereum Foundation launched the Open Intents Framework (OIF) in February 2025, with 30+ teams implementing it.

This is infrastructure for intent-based execution, not a work board itself — but it's the right primitive to build on.

### Across Protocol + UMA
**Status: Live**

Across uses competitive relayers who fulfill cross-chain bridge intents. UMA's Optimistic Oracle verifies fills. The Optimistic Oracle is a general-purpose dispute mechanism — can verify "did X happen?" off-chain and settle it on-chain. Interesting primitive for work verification.

### Anoma
**Status: Mainnet launched September 2025 on Ethereum**

Anoma is the most ambitious intent-centric protocol — an entire intent-native operating system. Key concepts:
- Intents are first-class objects (not just swap orders)
- Decentralized solver network discovers counterparties with matching/complementary intents
- "Pint" programming language for programmable intents

The closest to a general-purpose intent protocol that could power a non-financial wanted board — but extremely early.

### Essential Protocol
**Status: Funded ($11M), building, pre-production**

Building an Ethereum-aligned L2 specifically for intent execution. Developing a universal DSL for intents optimized for solver reasoning.

---

## Category 3: On-Chain Reputation + Work Verification

### Ethereum Attestation Service (EAS)
**Status: Live on Ethereum + multiple chains, heavily used**

EAS lets any party attest to anything about any address using user-defined schemas:
- Free and permissionless
- On-chain or off-chain (with on-chain hash)
- Composable: attestations can reference other attestations
- ZK-compatible
- Already used for: Gitcoin Passport stamps, ENS names, Guild memberships, Optimism RetroPGF

**For a wanted board:** EAS is the ideal receipt mechanism — when work is completed and verified, the verifier issues an EAS attestation. Those attestations compose into reputation.

### Hats Protocol
**Status: Live, trusted by 50+ DAOs**

Hats provides on-chain role management as ERC-1155 tokens ("hats"). A hat represents a role with:
- Associated permissions (smart contract access, multisig signing, Discord roles)
- Accountability (admin relationships, revocation criteria)
- Programmable eligibility (automated granting/revoking)

Now explicitly supports AI agent roles — managing permissions for both human and AI agents.

**For a wanted board:** Hats is the role/permission layer — who can post work, who can claim it, who can verify it.

### Karma
**Status: Live, used by major DAOs**

Karma aggregates DAO contributor activity across Snapshot, on-chain voting, Discord, Discourse, POAPs, GitHub, Dework, and more into a reputation score. Used by ApeCoin DAO (AIP-132).

**Gap:** Reputation is DAO-scoped, doesn't compose portably across organizations. Read-only — doesn't enforce anything on-chain.

### POAP
**Status: Live, 40M+ POAPs minted**

POAPs are ERC-721 NFTs on Gnosis Chain proving attendance/participation. Widely adopted by Google Cloud, Bayer, ETH conferences.

**Gap:** Issued by event organizers with no verification of what was actually done. No cryptographic proof.

---

## Category 4: AI Agent Work Coordination On-Chain

### Olas / Autonolas + Pearl
**Status: Live in production — the most complete AI agent work system**

- **Agent Services:** Multi-agent systems deployed as "services" on-chain. A service has an operator who stakes OLAS, agent operators who run components, and a service registry on-chain.
- **Proof of Active Agent (PoAA):** Novel mechanism combining PoS and PoW — agents must demonstrate active work (completed transactions, met KPIs) to earn OLAS staking rewards. 3.5M+ transactions completed, 700k/month growing 30% MoM.
- **Pearl (November 2025):** The "agent app store" — users install and own autonomous AI agents. Current agents: Modius (DeFAI), Prediction Agent, Optimus, Agents.fun.
- **Raised $13.8M** in OTC round led by 1kx in early 2025.

**Gap:** Oriented toward ongoing services (run this agent continuously) rather than discrete task fulfillment. The wanted board pattern requires one-shot task claiming.

### Virtuals Protocol + Agent Commerce Protocol (ACP)
**Status: Live on Base, $500M agent market cap**

ACP is an open standard for agents to coordinate and transact on-chain. Key properties:
- Verifiable value flow between agents
- Agent-to-agent and agent-to-human coordination
- On-chain commerce for AI agents with ERC-20 agent tokens

As of September 2025: $500M+ combined agent market cap, $8B+ in DEX volume, 90%+ activity on Base.

**For wanted boards:** ACP is the payment and coordination layer — but focused on agent-to-agent coordination, not human-posts-task-for-agent-to-claim.

### Morpheus
**Status: Live on Base, production since December 2025. 1M+ users**

Decentralized AI inference marketplace. Architecture:
- Capital providers stake to fund compute
- Compute providers offer inference
- Builders deploy agents using Morpheus infrastructure
- MOR token rewards all participants

**For wanted boards:** Provides compute marketplace primitive. Execution infrastructure layer, not work coordination.

### SingularityNET / ASI Alliance
**Status: Live marketplace, transitioned to FET/ASI token**

AI marketplace with 40+ active partnerships. Part of the ASI Alliance (with Fetch.ai and Ocean Protocol).

**Verdict:** AI service marketplace oriented toward API calls and inference, not task coordination.

### Fetch.ai / ASI:One
**Status: 3M+ active agents**

Agentverse has 3M+ active agents. Key milestones:
- **World's first AI-to-AI payment (December 18, 2025):** Personal AIs completed autonomous payments on behalf of users while offline, via Visa + USDC + FET.
- **ASI:Chain DevNet (November 2025):** A blockDAG L1 for AI agent coordination.

The Agentverse marketplace is closest to a "job board for agents" — agents are listed with capabilities, others can hire them. But discovery is search-based, not intent-based with solver competition.

### Coinbase x402
**Status: Live since May 2025, V2 in December 2025, 75M transactions**

Revives the HTTP 402 "Payment Required" status code as a machine-native payment protocol. An AI agent hitting a paywalled API receives a 402, pays on-chain (USDC on Base/Solana), and gets access — all without human input.

Stats: 75M transactions, $24M in paid API calls by December 2025.

**For wanted boards:** x402 could be the payment rail — when an agent completes work and it's verified, x402 releases payment.

### ERC-8004 (Agent Trust Registry)
**Status: Proposed August 2025, not yet live**

Community ERC proposal for AI agent trust management. Defines three on-chain registries:
1. **Identity Registry:** Agent credentials and endpoints
2. **Reputation Registry:** Performance history and ratings
3. **Validation Registry:** Authorization to perform certain actions

Almost exactly the wanted board reputation layer described in the gap analysis — but a proposal, not deployed infrastructure.

---

## Category 5: Gap Analysis — What's Missing

### What exists (the pieces)

| Component | Best Current Option | Maturity |
|-----------|-------------------|----------|
| Work posting with locked payment | StandardBounties contracts, Immunefi vaults | Primitive but working |
| Solver/filler competition | CoW Protocol, UniswapX, 1inch Fusion | Production, finance-only |
| Cross-chain intent standard | ERC-7683 + Open Intents Framework | Production |
| On-chain work claims + execution | Olas PoAA, Dework (manual) | Early / semi-manual |
| On-chain receipts (proof of work) | EAS attestations | Production primitive |
| Portable reputation | EAS, Karma, Hats Protocol | Fragmented |
| Role/permission enforcement | Hats Protocol | Production |
| Agent payments | x402, Fetch.ai A2A, Virtuals ACP | Early production |
| Dispute/verification | UMA Optimistic Oracle | Production |

### What does NOT exist as an integrated system

**There is no protocol that combines all five of:**
1. General-purpose work posting (not just swaps or bugs) with on-chain payment escrow
2. Open solver/claimer competition with on-chain claiming mechanics
3. Execution guardrails (policy enforcement during the work, not just at payout)
4. On-chain receipt generation (EAS attestation issued upon verified completion)
5. Portable, composable reputation that follows the worker across platforms

### The six specific gaps

**Gap 1: General-purpose intent execution for non-financial work**

Every mature solver competition system (CoW, UniswapX, 1inch) is financial. The moment you ask "I want this code written" or "I want this data collected," there is no decentralized solver competition mechanism. Anoma aspires to fill this but is very early.

**Gap 2: On-chain policy enforcement during execution**

No system enforces what the solver can or can't do during the execution phase. In financial intents, this is trivially solved — the smart contract specifies exact token amounts and routes. For general work (especially AI agent work), you need guardrails on agent behavior during execution.

**Gap 3: Proof-of-work-done that's cryptographically strong**

POAP and EAS attestations are socially-verified. There is no cryptographic proof of work completion for general tasks. Olas' PoAA is the closest: on-chain transaction counts prove agent activity. For qualitative work, verification remains subjective and human-gated.

**Gap 4: Reputation that's portable, composable, and enforceable**

Karma is siloed per DAO. Hats Protocol gives permissions but doesn't track history. EAS is the most composable but requires schemas and integration work that hasn't been standardized for work reputation. No "universal work graph."

**Gap 5: The claim mechanic itself**

The "walk up to the board, see available work, claim it, and the board locks it as yours" pattern barely exists on-chain. Dework has this UI but enforces it off-chain. Bounties Network had the smart contract but no critical mass.

**Gap 6: Human + AI agent coordination in the same work queue**

Fetch.ai and Virtuals coordinate agents with agents. Dework and Layer3 coordinate humans with humans. No system seamlessly puts both in the same work queue with consistent verification and reputation mechanics.

### The full wanted-board pipeline

```
post work (with locked payment + constraints)
    -> solver competition (open claiming with escrow lock)
        -> execution with guardrails (policy enforcement during work)
            -> verification (proof of completion, on-chain receipt)
                -> payout (automatic on verified receipt)
                    -> reputation (EAS attestation, portable)
```

Every node in this pipeline has *some* existing implementation. No single protocol connects them all. The closest full implementations are domain-specific: Immunefi does this for bug bounties, CoW Protocol does this for token swaps. For general work — especially AI agent work — the integrated system does not yet exist.

**The primitives to build it are live and ready:**
- **ERC-7683** for the intent/solver structure
- **EAS** for receipts and reputation
- **Hats Protocol** for role-gating
- **UMA Optimistic Oracle** for dispute resolution
- **x402** for payment release
- **Olas PoAA** for proving agent activity

What doesn't exist is the glue — a protocol that orchestrates these primitives into a general-purpose work coordination loop.

---

## Sources

- [Gitcoin 2025 Strategy](https://www.gitcoin.co/blog/gitcoin-grants-2025-strategy)
- [Grants Stack Winds Down](https://www.gitcoin.co/blog/grants-stack-winds-down--heres-whats-changing-and-what-to-expect)
- [Holonym Acquires Gitcoin Passport](https://chainwire.org/2025/02/10/holonym-foundation-acquires-gitcoin-passport-to-onboard-its-2m-users-to-create-worlds-largest-proof-of-humanity-solution/)
- [Dework](https://dework.xyz/)
- [StandardBounties GitHub](https://github.com/Bounties-Network/StandardBounties)
- [CoW Protocol Solver Rules](https://docs.cow.fi/cow-protocol/reference/core/auctions/competition-rules)
- [ERC-7683 Standard](https://eips.ethereum.org/EIPS/eip-7683)
- [Anoma Mainnet Roadmap](https://anoma.net/blog/anomas-roadmap-to-mainnet)
- [Essential Protocol $11M Raise](https://www.coindesk.com/business/2024/08/13/crypto-project-essential-raises-11m-for-intent-based-blockchain)
- [Across Protocol Intents Architecture](https://docs.across.to/concepts/intents-architecture-in-across)
- [UMA Secures Across](https://blog.uma.xyz/articles/case-study-how-uma-secures-across-protocol)
- [UniswapX Docs](https://docs.uniswap.org/contracts/uniswapx/overview)
- [1inch Fusion Cross-Chain Intents](https://blog.1inch.com/cross-chain-interoperability-an-intent-based-approach/)
- [EAS](https://attest.org/)
- [Hats Protocol](https://www.hatsprotocol.xyz/)
- [Karma](https://www.karmahq.xyz/how-it-works)
- [POAP Guide](https://opensea.io/learn/nft/what-is-poap)
- [Olas / Pearl Launch](https://www.coindesk.com/tech/2025/11/04/olas-launches-pearl-v1-the-first-ai-agent-app-store/)
- [Olas Staking / PoAA](https://olas.network/staking)
- [Virtuals Protocol](https://www.virtuals.io/)
- [Morpheus Marketplace](https://mor.org/)
- [SingularityNET Marketplace](https://marketplace.singularitynet.io/)
- [Fetch.ai AI-to-AI Payment](https://fetch.ai/blog/world-s-first-ai-to-ai-payment-for-real-world-transactions)
- [Coinbase x402 Launch](https://www.coinbase.com/developer-platform/discover/launches/x402)
- [x402 V2](https://www.theblock.co/post/382284/coinbase-incubated-x402-payments-protocol-built-for-ais-rolls-out-v2)
- [Immunefi](https://immunefi.com/)
