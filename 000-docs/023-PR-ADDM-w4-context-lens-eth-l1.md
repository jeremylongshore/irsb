# 023-PR-ADDM — W4 Context Lens (Ethereum Level 1)

## Summary

W4 adds a **Context Lens** to the IRSB Watchtower — lightweight Ethereum chain heuristics that analyze agent addresses for funding patterns, counterparty concentration, activity anomalies, and optional payment adjacency.

## Architecture

```
ChainProvider (RPC)
      │
      ▼
ContextDataSource (injectable)
      │
      ▼
syncAndScoreContext()
  ├── getTransactions(address, fromBlock, toBlock)
  ├── classifyFunding() ─────────────── CX_FUNDED_BY_CONTRACT / CX_FUNDED_BY_UNKNOWN
  ├── counterpartyConcentration() ───── CX_COUNTERPARTY_CONCENTRATION_HIGH
  ├── burstDetection() ─────────────── CX_TX_BURST
  ├── dormantThenBurst() ───────────── CX_DORMANT_THEN_BURST
  └── micropaymentSpam() (optional) ── CX_MICROPAYMENT_SPAM
      │
      ▼
  W1 Scoring Pipeline (upsertAgent → insertSnapshot → scoreAgent → report + alerts)
```

## Data Model

Context heuristics produce **Signals** that flow through the existing W1 snapshot pipeline. Only one new table:

| Table | Purpose |
|-------|---------|
| `context_cursor` | Per-agent, per-chain block sync cursor |

## Signals

| Signal | Severity | Weight | Condition |
|--------|----------|--------|-----------|
| `CX_FUNDED_BY_CONTRACT` | LOW | 0.2 | First inbound ETH transfer from a contract |
| `CX_FUNDED_BY_UNKNOWN` | LOW | 0.1 | No inbound transactions found |
| `CX_COUNTERPARTY_CONCENTRATION_HIGH` | MEDIUM | 0.4 | Top counterparty > 80% of txs (min 10 txs) |
| `CX_TX_BURST` | MEDIUM | 0.3 | Current window tx count > 3x prior window |
| `CX_DORMANT_THEN_BURST` | MEDIUM | 0.4 | No prior activity + burst in current window |
| `CX_MICROPAYMENT_SPAM` | MEDIUM | 0.4 | Many tiny token transfers to few peers (opt-in) |

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `chainId` | (required) | Chain ID |
| `maxBlocks` | 50,000 | Max blocks per sync run |
| `minTxForConcentration` | 10 | Min txs for concentration check |
| `concentrationThreshold` | 0.8 | Top-1 counterparty share threshold |
| `burstMultiplier` | 3.0 | Burst detection multiplier |
| `burstMinTx` | 10 | Min tx count to be a burst |
| `dormancyThresholdSeconds` | 30 days | Inactivity threshold |
| `enablePaymentAdjacency` | false | Enable ERC-20 micropayment signals |
| `paymentTokenAddresses` | [] | Token contracts to monitor |
| `allowlistPath` | - | Known-good address tags (CEX, BRIDGE) |
| `denylistPath` | - | Known-bad address tags (MIXER) |

## Allowlist / Denylist Format

One address per line, optionally with tag:
```
0x1234...abcd
0x5678...efgh,CEX
0x9abc...0123,BRIDGE
```

Lines starting with `#` are comments. Addresses are lowercased automatically.

## Design Decisions

- **Injectable ContextDataSource**: Avoids coupling to RPC; tests use mock implementations
- **No new large tables**: Context findings are Signals stored in the existing snapshots table
- **Cursor per agent per chain**: Allows incremental sync without re-scanning
- **Payment adjacency OFF by default**: Avoids unnecessary RPC load; opt-in when needed
- **No hardcoded CEX/MIXER accusations**: Tags come from user-provided files only
- **No clustering/graph analysis**: Deferred to W8+ (Louvain, PageRank, etc.)
