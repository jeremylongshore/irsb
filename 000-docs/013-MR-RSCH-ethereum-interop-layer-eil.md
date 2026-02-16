# Ethereum Interop Layer (EIL) — Research Notes

| Field | Value |
|-------|-------|
| **Date** | 2026-02-11 |
| **Status** | Testnet (Nov 2025), mainnet TBD |
| **Authors** | Ethereum Foundation, Ambire |
| **Sources** | EF Blog, ethresear.ch, @arjunnchand / @ThewizardofPOS |

## What Is EIL

The Ethereum Interop Layer makes Ethereum's L2 rollups feel like a single chain. A user signs **once** and their wallet executes operations across multiple L2s — no bridges, no intermediaries, no network switching.

**Core idea:** "Account-based interop — the user's own account directly performs every call on every chain."

## How It Works

### Single-Signature Merkle Architecture

1. Wallet generates N separate UserOps (one per target chain)
2. Constructs a Merkle tree of all UserOps
3. User signs the Merkle root **once**
4. Each chain's account validation receives: the UserOp, a Merkle branch proof, and the root signature

This is critical for hardware wallets which can't do parallel multi-sig.

### Cross-Chain Token Movement

Uses **optimistic atomic swaps** via Crosschain Liquidity Providers (XLPs):

1. User locks funds on Chain A, requests a voucher for Chain B
2. XLP provides signed voucher — same signature claims user's Chain A funds and releases XLP's Chain B funds
3. User attaches voucher to Chain B UserOp
4. Funds locked ~1 hour on source (dispute period)
5. L1 dispute resolution if XLP misbehaves (8-day timelock > 7-day fraud proof window)

### Key Contracts

| Contract | Location | Role |
|----------|----------|------|
| **L1CrossChainStakeManager** | L1 | XLP registration, staking, dispute resolution |
| **CrossChainPaymaster** | Each L2 | Voucher verification, fee management, timelocks |

### Fee Discovery

Dutch auction: voucher requests specify fee ranges with per-second increases. First XLP to provide a voucher wins. Efficient XLPs also act as bundlers.

## Standards Stack

| Standard | Role in EIL |
|----------|------------|
| **ERC-4337** | Account abstraction — users deploy ERC-4337 accounts, wallets generate UserOps |
| **EIP-7702** | EOA delegation — EOAs set identical delegations across chains without upgrading to smart accounts |
| **EIP-7701** (future) | Native AA — replaces EntryPoint singleton for better gas and censorship resistance |
| **ERC-7683** | NOT part of EIL — different model (intents vs account-based); complementary for different use cases |
| **New ERCs** (in progress) | Merkle-based multichain signatures standardization |

## EIL vs Intent Protocols (e.g., IRSB, ERC-7683)

This is the key distinction:

| Dimension | EIL | Intent Protocols |
|-----------|-----|-----------------|
| **Who executes** | User's own account on each chain | Solver/relayer executes on user's behalf |
| **Trust model** | User initiates all calls directly | User trusts solver to fulfill intent correctly |
| **Best for** | Known contract calls across chains | Unknown/complex execution paths |
| **Griefing risk** | None (user controls all calls) | Solver could grief via malicious contracts |
| **Speed** | Near-block latency via atomic swaps | Depends on solver competition |
| **Limitations** | User must know exact calls | Solver figures out optimal execution |

**EIL's own assessment:** "Intents are better when the user or dapp cannot specify the exact contract calls." EIL is for when you know what you want done on each chain.

## Relevance to IRSB

### Direct Synergies

1. **EIP-7702 WalletDelegate** — EIL explicitly supports EIP-7702 delegation. IRSB's WalletDelegate + caveat enforcers could theoretically gate EIL-initiated cross-chain calls. User delegates on multiple chains → enforcers validate on each chain → receipts prove execution.

2. **Dispute mechanisms are conceptually parallel** — EIL uses L1-based dispute resolution with 8-day timelocks for XLP misbehavior. IRSB uses DisputeModule with challenge windows and bond slashing. Both follow optimistic-then-dispute patterns.

3. **Receipts as cross-chain proof** — IRSB's IntentReceiptHub could record receipts for EIL-initiated operations, providing an audit trail for AI agent actions across L2s.

4. **Watchtower could monitor EIL operations** — XLP behavior (voucher issuance, fund locking) could be monitored by IRSB's watchtower for policy violations.

### Where They Don't Overlap

- EIL is **not** an intent protocol. IRSB is built around intent receipts and solver accountability. Different execution models.
- EIL replaces the need for solvers in scenarios where the user knows the exact calls. IRSB's solver model is for when a third party executes on the user's behalf.
- EIL's fee model (Dutch auction for XLPs) is different from IRSB's bond/stake model for solvers.

### Strategic Position

**They're complementary, not competing:**

- **EIL** = "I know exactly what I want done on 3 chains, do it atomically" (user-initiated)
- **IRSB** = "I delegated wallet access to an AI agent, prove what it did and punish violations" (third-party execution accountability)

An AI agent using EIL to execute cross-chain operations would still benefit from IRSB's:
- Spend limit enforcers (cap what the agent can move cross-chain)
- Receipt logging (prove the agent's cross-chain actions)
- Dispute resolution (recourse if the agent acts outside its mandate)

### Potential Integration Path

1. Agent signs EIL Merkle root (authorized via IRSB WalletDelegate)
2. Caveat enforcers validate each UserOp in the Merkle tree against spend limits, allowed targets, time windows
3. EIL executes across L2s
4. IRSB receipts log each chain's execution result
5. Watchtower monitors cross-chain receipts for policy violations

This would give AI agents **cross-chain execution with on-chain guardrails** — exactly the IRSB value prop extended to multi-L2.

## Current Status

- **Testnet:** Live as of Nov 2025 (demo app: Stitch)
- **Mainnet:** TBD, pending audit and feedback
- **Wallets:** Ambire implements EIL; ZeroDev and Biconomy have compatible multichain validation modules
- **SDK:** Forthcoming; wallets will use EIL SDK or future ERC-5792
- **Standardization:** New ERCs in progress for merkle-based multichain signatures

## Sources

- [EF Blog: Making Ethereum Feel Like One Chain Again](https://blog.ethereum.org/2025/11/18/eil)
- [ethresear.ch: EIL Trust-Minimized Cross-L2 Interop](https://ethresear.ch/t/eil-trust-minimized-cross-l2-interop/23437)
- [Arjun Chand / @ThewizardofPOS thread](https://x.com/arjunnchand/status/2021245271334904180)
- [The Defiant: Ethereum Unveils New Technical Details](https://thedefiant.io/news/blockchains/ethereum-unveils-new-technical-details-about-interop-layer)
- [Etherspot: EIL + EIP-7702 Integration Explained](https://etherspot.io/blog/ethereum-reveals-new-interop-layer-eil-sequence-launches-trails-for-unified-payments-vitalik-presents-updated-roadmap-at-devconnect-and-eip-7702-infra-integration-explained/)
