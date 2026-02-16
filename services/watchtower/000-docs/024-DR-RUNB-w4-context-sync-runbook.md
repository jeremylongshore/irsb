# 024-DR-RUNB — W4 Context Sync Runbook

## Prerequisites

- Node.js 20+, pnpm installed
- `pnpm install && pnpm build` completed
- An Ethereum RPC endpoint (e.g. Alchemy, Infura, local node)
- An agent ID (from W3 identity discovery or manual)

## Commands

### Initialize Database

```bash
pnpm --filter @irsb-watchtower/watchtower-cli start -- init-db
```

### Sync Context for an Agent

```bash
# Basic sync (uses cursor, scans up to 50k blocks)
pnpm --filter @irsb-watchtower/watchtower-cli start -- cx:sync \
  --agentId "erc8004:11155111:0x7177a6867296406881E20d6647232314736Dd09A:42" \
  --address "0xAgentEthereumAddress" \
  --rpc-url "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY" \
  --chain-id 11155111

# With explicit block range
pnpm --filter @irsb-watchtower/watchtower-cli start -- cx:sync \
  --agentId "erc8004:11155111:0xRegistry:42" \
  --address "0xAgentAddress" \
  --rpc-url "$RPC_URL" \
  --from-block 1000000 \
  --to-block 1050000

# With allowlist/denylist
pnpm --filter @irsb-watchtower/watchtower-cli start -- cx:sync \
  --agentId "erc8004:11155111:0xRegistry:42" \
  --address "0xAgentAddress" \
  --rpc-url "$RPC_URL" \
  --allowlist ./known-cex.txt \
  --denylist ./known-mixers.txt

# With payment adjacency enabled
pnpm --filter @irsb-watchtower/watchtower-cli start -- cx:sync \
  --agentId "erc8004:11155111:0xRegistry:42" \
  --address "0xAgentAddress" \
  --rpc-url "$RPC_URL" \
  --enable-payment-adjacency \
  --payment-tokens "0xUSDC,0xDAI"
```

### Show Context Analysis

```bash
pnpm --filter @irsb-watchtower/watchtower-cli start -- cx:show \
  "erc8004:11155111:0x7177a6867296406881E20d6647232314736Dd09A:42"
```

## Expected Output

### cx:sync
```
  Context Sync

  ✓ Scanned blocks 950000–999999
  Transactions: 23
  Signals:      2
  Risk:         12/100
  Alerts:       0
  Report:       a1b2c3d4e5f6...
```

### cx:show
```
  Context: erc8004:11155111:0xRegistry:42

  Latest Risk Report:
    Risk:       12/100
    Confidence: MEDIUM
    Generated:  2026-02-06T07:00:00.000Z
    Report ID:  a1b2c3d4e5f6...

  Context Signals:
    LOW CX_FUNDED_BY_CONTRACT
    MEDIUM CX_COUNTERPARTY_CONCENTRATION_HIGH

  Context Evidence:
    [fundingKind] CONTRACT
    [fundingSource] 0xcontractsender
    [topCounterparty] 0xmainpeer
    [topShare] 0.9231
```

## Allowlist/Denylist File Format

Create plain text files, one address per line:

```
# known-cex.txt
0x28C6c06298d514Db089934071355E5743bf21d60,CEX
0xDFd5293D8e347dFe59E90eFd55b2956a1343963d,CEX

# known-mixers.txt
0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b,MIXER
```

Tags: `CEX`, `BRIDGE`, `MIXER`, `CONTRACT`, `EOA`. Default tag if omitted: `CEX` for allowlist, `MIXER` for denylist.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Nothing to sync" | Agent cursor already at chain tip; use `--from-block` to re-scan |
| No signals produced | Check that `--address` is correct; verify there are on-chain txs |
| Payment signals not appearing | Add `--enable-payment-adjacency` and `--payment-tokens` |
