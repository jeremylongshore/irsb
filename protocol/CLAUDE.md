# CLAUDE.md

> **Part of the IRSB monorepo** (`jeremylongshore/irsb`). See root CLAUDE.md for workspace overview.
>
> **AI Context**: For ecosystem-wide reference (contracts, deployments, concepts, glossary), see [../AI-CONTEXT.md](../AI-CONTEXT.md)

This file provides guidance to Claude Code (claude.ai/code) when working with this sub-project.

## Project Overview

**IRSB (Intent Receipts & Solver Bonds)** - The accountability layer for intent-based transactions.

> "Intents need receipts. Solvers need skin in the game."

ERC-7683 standardizes cross-chain intents but doesn't answer: **"What happens when the solver fails?"**

IRSB fills that gap with:
- **Receipts**: On-chain proof of intent execution (V1 single-sig, V2 dual attestation)
- **Bonds**: Staked collateral slashable for violations
- **Disputes**: Deterministic + optimistic resolution with counter-bonds
- **Escrow**: Native ETH and ERC20 tied to receipt lifecycle
- **Reputation**: Portable IntentScore across protocols

**Status**: v1.4.0 released, deployed on Sepolia, open source (MIT)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ SolverRegistry  │◄───►│ IntentReceiptHub │◄───►│  DisputeModule   │
├─────────────────┤     ├──────────────────┤     ├──────────────────┤
│ • Registration  │     │ • Post receipts  │     │ • Evidence       │
│ • Bond staking  │     │ • V2 extension   │     │ • Escalation     │
│ • Slashing      │     │ • Disputes       │     │ • Arbitration    │
│ • Reputation    │     │ • Finalization   │     │                  │
└────────┬────────┘     └────────┬─────────┘     └──────────────────┘
         │                       │
         │              ┌────────▼─────────┐
         │              │   EscrowVault    │
         │              ├──────────────────┤
         │              │ • ETH + ERC20    │
         │              │ • Release/Refund │
         │              │ • Receipt-linked │
         │              └──────────────────┘
         │
┌────────▼────────────────┐     ┌──────────────────────────┐
│ OptimisticDisputeModule │     │    ReceiptV2Extension    │
├─────────────────────────┤     ├──────────────────────────┤
│ • Counter-bond window   │     │ • Dual attestation       │
│ • Timeout resolution    │     │ • EIP-712 signatures     │
│ • Escalation to arb     │     │ • Privacy commitments    │
└─────────────────────────┘     └──────────────────────────┘
```

## Deployments

### Sepolia Testnet (Production)
| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |
| ERC-8004 Agent ID | `967` (on IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`) |

### Operational Accounts (Sepolia)

| Account | Address | Purpose |
|---------|---------|---------|
| **Deployer/Operator** | `0x83A5F432f02B1503765bB61a9B358942d87c9dc0` | Signs receipts, pays gas |
| **Solver ID** | `0xdf816d7b86303c3452e53d84aaa02c01b0de6ae23c1e518bd2642870f9f7603b` | Registered solver identifier |
| **Safe (Owner)** | `0xBcA0c8d0B5ce874a9E3D84d49f3614bb79189959` | Owns all contracts (2/3 multisig) |

**Note**: Safe needs ETH for admin operations (pause, parameter changes). Deployer wallet signs receipts.

## Repository Structure

```
protocol/                           # within monorepo root
├── src/                        # Solidity contracts
│   ├── SolverRegistry.sol      # Solver lifecycle, bonding, slashing
│   ├── IntentReceiptHub.sol    # Receipt posting, disputes, finalization
│   ├── X402Facilitator.sol     # x402 payment settlement (direct + delegated)
│   ├── delegation/
│   │   ├── WalletDelegate.sol  # EIP-7702 delegation + ERC-7710 redemption
│   │   └── DelegationLib.sol   # EIP-712 hashing and verification helpers
│   ├── enforcers/
│   │   ├── SpendLimitEnforcer.sol     # Daily + per-tx spend limits
│   │   ├── TimeWindowEnforcer.sol     # Session time bounds
│   │   ├── AllowedTargetsEnforcer.sol # Approved contracts
│   │   ├── AllowedMethodsEnforcer.sol # Approved selectors
│   │   └── NonceEnforcer.sol          # Replay prevention
│   ├── DisputeModule.sol       # Arbitration for complex disputes
│   ├── EscrowVault.sol         # ETH + ERC20 escrow
│   ├── extensions/
│   │   └── ReceiptV2Extension.sol  # Dual attestation, EIP-712
│   ├── modules/
│   │   └── OptimisticDisputeModule.sol  # Counter-bond disputes
│   ├── adapters/
│   │   └── ERC8004Adapter.sol  # Validation provider
│   ├── interfaces/             # Contract interfaces
│   └── libraries/
│       ├── Types.sol           # V1 structs, enums, constants
│       ├── TypesV2.sol         # V2 structs, PrivacyLevel
│       └── Events.sol          # Shared events
├── test/                       # Foundry tests (552 passing)
│   └── fuzz/                   # Fuzz tests (10k runs)
├── script/                     # Deployment scripts
├── sdk/                        # TypeScript SDK
├── packages/
│   └── x402-irsb/              # x402 HTTP payment integration
├── examples/
│   └── x402-express-service/   # Express example with 402 flow
├── dashboard/                  # Next.js dashboard + landing page
├── subgraph/                   # The Graph indexer
├── deployments/                # Deployed addresses by network
└── 000-docs/                   # Architecture docs, specs, guides
```

## Build Commands

```bash
# Contracts
forge build                     # Build (via_ir, optimizer 200 runs)
forge test                      # All 552 tests
forge test -vvv                 # Verbose
forge test --gas-report         # Gas analysis
forge fmt                       # Format

# Fuzz tests (CI profile)
FOUNDRY_PROFILE=ci forge test --match-path "test/fuzz/*.sol"

# SDK
cd sdk && pnpm build && pnpm test

# x402 package
cd packages/x402-irsb && pnpm build && pnpm test

# Dashboard
cd dashboard && pnpm dev        # Local dev
cd dashboard && pnpm build      # Production build
```

## Key Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| MINIMUM_BOND | 0.1 ETH | Solver activation threshold |
| CHALLENGE_WINDOW | 1 hour | Time to dispute receipt |
| WITHDRAWAL_COOLDOWN | 7 days | Bond withdrawal delay |
| MAX_JAILS | 3 | Strikes before permanent ban |
| COUNTER_BOND_WINDOW | 24 hours | Time for solver to counter |
| ARBITRATION_TIMEOUT | 7 days | Max time for arbitration |

## Slashing Distribution

| Recipient | Standard | Arbitration |
|-----------|----------|-------------|
| User | 80% | 70% |
| Challenger | 15% | - |
| Treasury | 5% | 20% |
| Arbitrator | - | 10% |

## Receipt Types

### V1 Receipt (Single Attestation)
```solidity
struct IntentReceipt {
    bytes32 intentHash;
    bytes32 constraintsHash;
    bytes32 routeHash;
    bytes32 outcomeHash;
    bytes32 evidenceHash;
    uint64 createdAt;
    uint64 expiry;
    bytes32 solverId;
    bytes solverSig;        // Single signature
}
```

### V2 Receipt (Dual Attestation + Privacy)
```solidity
struct IntentReceiptV2 {
    // ... V1 fields ...
    bytes32 metadataCommitment;  // Hash only, no plaintext
    string ciphertextPointer;     // IPFS CID or digest
    PrivacyLevel privacyLevel;    // PUBLIC | SEMI_PUBLIC | PRIVATE
    bytes32 escrowId;             // Optional escrow link
    bytes clientSig;              // Client/payer attestation (EIP-712)
}
```

## Dispute Flow

```
Receipt Posted
    │
    ├── [1 hour CHALLENGE_WINDOW]
    │
    ├── No dispute → finalize() → Reputation updated
    │
    └── Dispute opened (with bond)
        │
        ├── Deterministic (timeout, wrong amount)
        │   └── resolveDeterministic() → Auto-slash
        │
        └── Optimistic (V2)
            │
            ├── [24h COUNTER_BOND_WINDOW]
            │
            ├── No counter-bond → Challenger wins by timeout
            │
            └── Counter-bond posted → Escalate to Arbitrator
                │
                └── [7d max] → Arbitrator rules → Slash or release
```

## Testing Patterns

```solidity
// Time manipulation for disputes
vm.warp(block.timestamp + 1 hours + 1);

// Deposit bond as operator
vm.deal(operator, 1 ether);
vm.prank(operator);
registry.depositBond{value: 0.1 ether}(solverId);

// Expect custom error
vm.expectRevert(abi.encodeWithSignature("SolverNotActive()"));
```

## x402 Integration

The `irsb-x402` package bridges HTTP 402 payments to IRSB:

```typescript
import { buildReceiptV2FromX402, postReceiptV2FromX402 } from 'irsb-x402';

// After x402 payment verified
const receipt = buildReceiptV2FromX402({
  payload: { service, payment, request, response, timing },
  ciphertextPointer: resultCID,
  solverId: myRegisteredSolverId
});

await postReceiptV2FromX402(irsbClient, receipt, solverSigner);
```

## Environment Setup

Copy `.env.example` to `.env`:
```bash
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://...
ETHERSCAN_API_KEY=...
```

## Key Documentation

| Document | Purpose |
|----------|---------|
| `000-docs/016-AT-INTG-x402-integration.md` | x402 HTTP payment integration guide |
| `000-docs/014-AT-DSGN-privacy-design.md` | On-chain vs off-chain data model |
| `000-docs/010-OD-GUID-deployment-guide.md` | Deployment runbook |
| `000-docs/012-OD-GUID-monitoring-guide.md` | Monitoring checklist |
| `000-docs/011-OD-GUID-incident-playbook.md` | Emergency procedures |
| `000-docs/013-OD-GUID-multisig-plan.md` | Gnosis Safe transition |

## Strategic Context

**Goal**: IRSB aims to become the global standard accountability layer for intent-based systems.

**Competition**: No direct competitors building a cross-protocol intent accountability standard. Protocol-specific solutions (UniswapX, Across, CoW) have internal reputation but nothing portable.

**Path to Standard**:
1. Deploy to mainnet
2. Get 1 major integration (Across, CoW, UniswapX)
3. Submit as ERC/EIP proposal
4. Multi-chain deployment (Arbitrum, Base, Polygon)

**Key Insight**: Don't own a chain. Own the standard. Standards win by being everywhere, not by controlling infrastructure.
