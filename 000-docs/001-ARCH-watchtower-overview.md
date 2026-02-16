# IRSB Watchtower Overview

## What It Is

IRSB-Watchtower is an off-chain monitoring and enforcement service for the IRSB (Intent Receipts & Solver Bonds) protocol. It observes on-chain activity, detects violations, and optionally takes automated actions.

**Core Functions:**
1. **Monitor**: Watch IRSB contract events and state changes
2. **Detect**: Run rules against chain state to find violations
3. **Report**: Produce structured Findings for review
4. **Act** (optional): Automatically open disputes, submit evidence

## What It Is NOT

- **Not the protocol**: IRSB-Watchtower does not define IRSB semantics. It enforces them.
- **Not a validator**: It doesn't participate in consensus or block production.
- **Not a relayer**: It doesn't relay user intents or solver responses.
- **Not required for IRSB to work**: IRSB functions without watchtowers; they add enforcement.

## Composition with IRSB Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│                        IRSB Protocol                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │SolverRegistry│  │IntentReceipt │  │ DisputeModule  │         │
│  │             │  │    Hub       │  │                │         │
│  └─────────────┘  └──────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ RPC / Events
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                    IRSB-Watchtower                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Chain       │  │    Core      │  │   Runner     │          │
│  │  Adapter     │→ │  Rule Engine │→ │  API/Worker  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                             │                   │
│                                             ▼                   │
│                                    ┌──────────────┐            │
│                                    │   Signer     │            │
│                                    │  (optional)  │            │
│                                    └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Deterministic Core
The rule engine is deterministic. Given the same chain state, it produces the same Findings. No randomness, no LLM inference in the critical path.

### 2. Portable
The core rule engine has no cloud-specific dependencies. It can run locally, in Cloud Run, in Vertex Agent Engine, or anywhere Node.js runs.

### 3. Safe by Default
Actions are disabled by default (`ENABLE_ACTIONS=false`). The system observes and reports before it acts.

### 4. Pluggable Signing
The signer abstraction allows for:
- Local private keys (development)
- Cloud KMS (production)
- Lit PKP (decentralized)

### 5. Observable
Structured logging with pino. Clear Finding schema. Health endpoints. Ready for production monitoring.

## Use Cases

### Passive Monitoring
Run the worker to continuously scan for violations. Review Findings in logs or through the API. Human decides whether to act.

### Semi-Automated
Configure webhooks or integrations to alert when high-severity Findings occur. Human approves disputes before execution.

### Fully Automated
Enable actions with a configured signer. Watchtower automatically opens disputes for clear violations (e.g., challenge window timeout).

## Limitations

- **Not infallible**: Rules may have false positives/negatives
- **Chain visibility only**: Cannot detect off-chain collusion
- **Economic constraints**: Opening disputes costs gas and bonds
- **Signer trust**: Whoever holds the signing key can open disputes

## Next Steps

- See `002-ARCH-runtime-model.md` for execution environments
- See `003-ARCH-finding-schema.md` for Finding structure
- See `004-ARCH-rule-engine.md` for rule implementation
- See `007-RUN-local.md` for getting started
