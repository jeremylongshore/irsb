# Runtime Model

## Three-Layer Architecture

IRSB-Watchtower uses a three-layer architecture to separate concerns and enable portability:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Layer 3: Runner                         │
│  Environment-specific orchestration, scheduling, API serving    │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 2: Core                           │
│  Rule engine, Finding generation, chain context processing      │
├─────────────────────────────────────────────────────────────────┤
│                         Layer 1: Signer                         │
│  Transaction signing, key management, action execution          │
└─────────────────────────────────────────────────────────────────┘
```

## Layer 1: Signer

The signer layer handles cryptographic operations for on-chain actions.

**Interface:**
```typescript
interface Signer {
  getAddress(): Promise<Address>;
  signTransaction(tx: TransactionRequest): Promise<SignedTransaction>;
  signMessage(message: SignableMessage): Promise<Hex>;
  signTypedData(data: TypedData): Promise<Hex>;
  isHealthy(): Promise<boolean>;
}
```

**Implementations:**
- `LocalPrivateKeySigner`: Uses env var `PRIVATE_KEY` (development only)
- `GcpKmsSigner`: Uses Google Cloud KMS (production stub)
- `LitPkpSigner`: Uses Lit Protocol PKP (decentralized stub)

## Layer 2: Core

The core layer is portable and deterministic.

**Components:**
- `RuleEngine`: Orchestrates rule execution
- `Rule`: Interface for violation detection rules
- `Finding`: Structured output from rules
- `ChainContext`: Normalized view of chain state

**Key Property**: No cloud dependencies. Pure TypeScript with injected interfaces.

## Layer 3: Runner

The runner layer adapts the core to specific execution environments.

### Local CLI
```bash
pnpm dev:worker   # Background scanner
pnpm dev:api      # HTTP API server
```

### Worker Process
Long-running process with configurable scan interval:
1. Fetch current block
2. Build ChainContext
3. Execute rule engine
4. Log/store Findings
5. Sleep for interval
6. Repeat

### HTTP API
Fastify server exposing:
- `GET /health`: Liveness probe
- `POST /scan`: On-demand scan
- `POST /actions/*`: Action execution

### Vertex Agent Engine
See `008-RUN-vertex-agent-engine.md` for details.

## Data Flow

```
┌──────────┐     ┌─────────────┐     ┌────────────┐
│  Chain   │────▶│ChainContext │────▶│ RuleEngine │
│  (RPC)   │     │  (adapter)  │     │            │
└──────────┘     └─────────────┘     └─────┬──────┘
                                           │
                                           ▼
                                    ┌────────────┐
                                    │  Findings  │
                                    └─────┬──────┘
                                          │
                      ┌───────────────────┼───────────────────┐
                      ▼                   ▼                   ▼
               ┌────────────┐     ┌────────────┐     ┌────────────┐
               │    Log     │     │   Store    │     │   Action   │
               │  (pino)    │     │  (future)  │     │  (signer)  │
               └────────────┘     └────────────┘     └────────────┘
```

## Concurrency Model

The current implementation is single-threaded and sequential:
- One scan at a time
- Rules execute sequentially (parallel execution is a future optimization)
- No shared mutable state

This simplifies reasoning and testing. Scaling is achieved by running multiple instances monitoring different block ranges or rule sets.

## Error Handling

**Rule Errors:**
- Logged but don't stop the scan
- Other rules continue executing
- Error count tracked in result

**Chain Errors:**
- Logged with retry suggestion
- Worker continues to next interval
- API returns 5xx error

**Signer Errors:**
- Action fails with clear error message
- Finding is not marked as "acted upon"
- Human intervention may be needed

## Configuration

All configuration via environment variables (validated by Zod):

| Variable | Purpose | Required |
|----------|---------|----------|
| `RPC_URL` | Chain RPC endpoint | Yes |
| `CHAIN_ID` | Target chain | Yes |
| `SCAN_INTERVAL_MS` | Worker scan interval | No (default: 60000) |
| `ENABLE_ACTIONS` | Allow on-chain actions | No (default: false) |
| `PRIVATE_KEY` | Signer key (dev only) | Only if actions enabled |

See `.env.example` for full list.
