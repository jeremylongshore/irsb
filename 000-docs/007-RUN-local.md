# Running Locally

## Prerequisites

- Node.js 20 or later
- pnpm 8 or later

Verify with:
```bash
node --version   # Should be v20.x.x or later
pnpm --version   # Should be 8.x.x or later
```

## Quick Start (10 minutes)

### 1. Clone and Install

```bash
cd /home/jeremy/000-projects
git clone <repo-url> IRSB-watchtower
cd IRSB-watchtower
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings. Minimum required:
```bash
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
CHAIN_ID=11155111
```

### 3. Run Doctor Check

```bash
./scripts/doctor.sh
```

Should show all checks passing.

### 4. Build

```bash
pnpm build
```

### 5. Run Tests

```bash
pnpm test
```

All tests should pass.

### 6. Start Development Servers

**Terminal 1 - API Server:**
```bash
pnpm dev:api
```

Expected output:
```
[INFO] IRSB Watchtower API started
[INFO] {"port":3000,"host":"0.0.0.0","actionsEnabled":false}
```

**Terminal 2 - Worker:**
```bash
pnpm dev:worker
```

Expected output:
```
[INFO] IRSB Watchtower Worker starting
[INFO] Rules registered {"ruleCount":2,"rules":["SAMPLE-001","MOCK-ALWAYS-FIND"]}
[INFO] Starting scan cycle {"blockNumber":"1000000"}
[WARN] Finding detected {"ruleId":"SAMPLE-001","severity":"MEDIUM",...}
```

### 7. Test API

```bash
# Health check
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","version":"0.1.0","uptime":...}

# Trigger scan
curl -X POST http://localhost:3000/scan
# {"success":true,"findings":[...],"metadata":{...}}

# List rules
curl http://localhost:3000/scan/rules
# {"rules":[{"id":"SAMPLE-001",...},{"id":"MOCK-ALWAYS-FIND",...}]}

# Check action status
curl http://localhost:3000/actions/status
# {"enabled":false,"signerConfigured":false,...}
```

## Development Workflow

### Type Checking
```bash
pnpm typecheck
```

### Linting
```bash
pnpm lint
pnpm lint:fix  # Auto-fix issues
```

### Formatting
```bash
pnpm format
pnpm format:check
```

### Running Specific Tests
```bash
# All tests
pnpm test

# Specific package
pnpm --filter @irsb-watchtower/core test

# Watch mode
pnpm --filter @irsb-watchtower/api test:watch
```

## Configuration Options

### API Server

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | 3000 | HTTP port |
| `API_HOST` | 0.0.0.0 | Bind address |
| `ENABLE_ACTIONS` | false | Enable action endpoints |

### Worker

| Variable | Default | Description |
|----------|---------|-------------|
| `SCAN_INTERVAL_MS` | 60000 | Scan interval (ms) |
| `LOOKBACK_BLOCKS` | 1000 | Blocks to look back |
| `WORKER_POST_TO_API` | false | POST findings to API |
| `API_URL` | http://localhost:3000 | API URL if posting |

### Chain

| Variable | Default | Description |
|----------|---------|-------------|
| `RPC_URL` | (required) | RPC endpoint |
| `CHAIN_ID` | (required) | Chain ID |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | info | trace/debug/info/warn/error/fatal |
| `LOG_FORMAT` | pretty | json/pretty |

## Enabling Actions (Development)

To test action endpoints with a local signer:

```bash
# In .env
ENABLE_ACTIONS=true
SIGNER_TYPE=local
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

⚠️ **Warning**: This key is well-known (Foundry test key). Never use on mainnet.

Then:
```bash
curl http://localhost:3000/actions/status
# {"enabled":true,"signerConfigured":true,"signerType":"local",...}
```

## Troubleshooting

### "Cannot find module" errors
```bash
pnpm install
pnpm build
```

### Port already in use
```bash
# Find process
lsof -i :3000
# Kill it or change API_PORT
```

### TypeScript errors
```bash
pnpm typecheck
# Fix reported issues
```

### "Configuration validation failed"
Check that all required environment variables are set correctly. See `.env.example`.

### Worker not producing findings
The sample rule only fires when mock receipts are approaching deadline. This should happen on every scan. Check:
- Worker is running (`pnpm dev:worker`)
- Log level allows INFO messages (`LOG_LEVEL=info`)
