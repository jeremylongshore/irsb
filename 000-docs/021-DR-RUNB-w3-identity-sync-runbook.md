# 021-DR-RUNB — W3 Identity Sync Runbook

## Prerequisites

- Node.js 20+, pnpm
- Access to an Ethereum RPC endpoint (Alchemy, Infura, etc.)
- `pnpm build` completed

## Initialize Database

```bash
wt init-db
# Creates ./data/watchtower.db with all migrations (001 + 002)
```

## Sync Identity Events

Poll the ERC-8004 IdentityRegistry for Registered + Transfer (mint) events:

```bash
# Sepolia (default)
wt id:sync --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Custom registry / chain
wt id:sync \
  --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  --chain-id 1 \
  --registry 0x... \
  --start-block 18000000
```

The poller:
- Reads cursor from DB (0 on first run)
- Applies reorg overlap (default: 50 blocks back)
- Polls up to `batchSize` blocks (default: 10,000)
- Only processes confirmed blocks (default: 12 confirmations)
- Stores events idempotently (INSERT OR IGNORE)

Run repeatedly to catch up with chain tip.

## Fetch Cards & Score Agents

For each discovered agent, fetch the agent card, validate it, derive signals, and score:

```bash
# All discovered agents
wt id:fetch

# Specific agent token only
wt id:fetch --agent-token 42

# Allow HTTP URIs (not recommended for production)
wt id:fetch --allow-http
```

## View Agent Identity

```bash
wt id:show erc8004:11155111:0x7177a6867296406881e20d6647232314736dd09a:42
```

Shows:
- Chain, registry, token ID
- Recent identity snapshots (fetch status, card hash)
- Latest risk report (risk score, confidence, signals)

## Typical Workflow

```bash
# 1. Init DB
wt init-db

# 2. Sync events from chain
wt id:sync --rpc-url $RPC_URL

# 3. Fetch cards + score
wt id:fetch

# 4. Review results
wt list-alerts
wt id:show erc8004:11155111:0x7177...09a:1
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Nothing to poll" | Chain tip too close to cursor. Wait for more blocks. |
| All agents SSRF_BLOCKED | Agent URIs point to private IPs. Expected for test registrations. |
| DNS lookup failed | Network issue or non-existent domain in agent URI. |
| TIMEOUT | Agent card endpoint slow. Increase `fetchTimeoutMs`. |
