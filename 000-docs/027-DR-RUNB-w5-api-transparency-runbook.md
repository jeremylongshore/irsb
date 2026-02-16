# W5 Runbook: Watchtower API + Transparency Log

## Quick Start

```bash
# 1. Generate signing keypair
pnpm --filter @irsb-watchtower/watchtower-cli dev -- keygen
# ✓ Keypair saved to ./data/watchtower-key.json
# Public key: MCow...

# 2. Print public key (share with verifiers)
pnpm --filter @irsb-watchtower/watchtower-cli dev -- pubkey

# 3. Start the API server
pnpm --filter @irsb-watchtower/watchtower-api dev
# Watchtower API listening on 127.0.0.1:3100
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3100/healthz
# {"status":"ok","version":"0.3.0","uptime":42}
```

### Get Risk Report
```bash
curl http://localhost:3100/v1/agents/erc8004:11155111:0xabc:42/risk
# {"agentId":"...","overallRisk":42,"confidence":"HIGH",...}
```

### Get Alerts
```bash
curl http://localhost:3100/v1/agents/erc8004:11155111:0xabc:42/alerts
# {"agentId":"...","alerts":[...]}

# Active only
curl 'http://localhost:3100/v1/agents/erc8004:11155111:0xabc:42/alerts?activeOnly=true'
```

### Read Transparency Leaves
```bash
curl 'http://localhost:3100/v1/transparency/leaves?date=2026-02-06'
# {"date":"2026-02-06","count":5,"leaves":[...]}
```

### Verify Transparency Log
```bash
curl 'http://localhost:3100/v1/transparency/verify?date=2026-02-06'
# {"filePath":"...","totalLeaves":5,"validLeaves":5,"invalidLeaves":0,"errors":[]}
```

## CLI Commands

### Generate Keypair
```bash
wt keygen [--key-path ./data/watchtower-key.json] [--force]
```

### Print Public Key
```bash
wt pubkey [--key-path ./data/watchtower-key.json]
```

### Verify Signed Report
```bash
wt verify-report --report report.json --sig signature.json
# ✓ Signature is VALID
# Signed by: MCow...
```

### Append Transparency Leaf
```bash
wt transparency:append --agentId <id> [--key-path ...] [--log-dir ...]
# ✓ Leaf appended to ./data/transparency/leaves-2026-02-06.ndjson
# Leaf ID:  a1b2c3d4e5f6...
# Agent:    erc8004:11155111:0xabc:42
# Risk:     75/100
```

### Verify Transparency Log
```bash
wt transparency:verify [--date 2026-02-06] [--log-dir ...] [--public-key <base64>]
#
#   Transparency Log Verification
#
#   File:    ./data/transparency/leaves-2026-02-06.ndjson
#   Total:   5
#   Valid:   5
#   Invalid: 0
```

## Security: API Key Auth

```bash
# Set API key
export WATCHTOWER_API_KEY=my-secret-key

# Start server (now requires x-watchtower-key header on /v1/* routes)
pnpm --filter @irsb-watchtower/watchtower-api dev

# Authenticated request
curl -H 'x-watchtower-key: my-secret-key' http://localhost:3100/v1/agents/agent-1/risk

# /healthz does NOT require auth
curl http://localhost:3100/healthz
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Key file not found` | Run `wt keygen` first |
| `401 unauthorized` | Add `x-watchtower-key` header or unset `WATCHTOWER_API_KEY` |
| `No risk report found` | Run scoring pipeline first (`wt score-agent` or `wt id:fetch`) |
| `signature verification failed` | Verify with the same public key used to sign |
| Empty transparency log | Run `wt transparency:append` after scoring |
