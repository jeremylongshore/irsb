# IRSB Protocol Deployment Runbook

Complete guide for deploying IRSB Protocol to supported networks.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Network Reference](#network-reference)
- [Deployment Steps](#deployment-steps)
  - [Sepolia Deployment](#sepolia-deployment)
  - [Polygon Amoy Deployment](#polygon-amoy-deployment)
- [Post-Deployment](#post-deployment)
- [Verification](#verification)
- [Rollback Procedures](#rollback-procedures)
- [Multisig Transition](#multisig-transition)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Software Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Foundry | Latest | Solidity development |
| Node.js | 18+ | SDK and dashboard |
| Git | 2.40+ | Version control |

### Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version
cast --version
```

### Wallet Requirements

- Deployer wallet with:
  - Sepolia: ≥0.2 ETH
  - Amoy: ≥0.5 POL
- Private key (without 0x prefix)
- Hardware wallet recommended for mainnet

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/intent-solutions-io/irsb-protocol.git
cd irsb-protocol
```

### 2. Install Dependencies

```bash
# Solidity dependencies
forge install

# SDK dependencies
cd sdk && npm install && cd ..

# Dashboard dependencies (optional)
cd dashboard && npm install && cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Required for all deployments
PRIVATE_KEY=your_private_key_without_0x

# Sepolia
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=your_etherscan_api_key

# Polygon Amoy
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

### 4. Verify Configuration

```bash
# Load environment
source .env

# Test RPC connections
cast chain-id --rpc-url $SEPOLIA_RPC_URL    # Should return 11155111
cast chain-id --rpc-url $AMOY_RPC_URL       # Should return 80002

# Check deployer balance
cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $SEPOLIA_RPC_URL
cast balance $(cast wallet address $PRIVATE_KEY) --rpc-url $AMOY_RPC_URL
```

---

## Network Reference

| Network | Chain ID | Native Token | Explorer | Faucet |
|---------|----------|--------------|----------|--------|
| Sepolia | 11155111 | ETH | [sepolia.etherscan.io](https://sepolia.etherscan.io) | [sepoliafaucet.com](https://sepoliafaucet.com) |
| Amoy | 80002 | POL | [amoy.polygonscan.com](https://amoy.polygonscan.com) | [faucet.polygon.technology](https://faucet.polygon.technology) |

### RPC Endpoints

**Sepolia:**
- Public: `https://rpc.sepolia.org`
- Alchemy: `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`
- Infura: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

**Polygon Amoy:**
- Public: `https://rpc-amoy.polygon.technology`
- Alchemy: `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY`

---

## Deployment Steps

### Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Deployer wallet funded
- [ ] RPC endpoints working
- [ ] All tests passing: `forge test`
- [ ] Code formatted: `forge fmt --check`
- [ ] Git status clean

### Sepolia Deployment

```bash
# 1. Run tests
forge test

# 2. Dry-run (simulation)
forge script script/Deploy.s.sol:DeploySepolia \
  --rpc-url $SEPOLIA_RPC_URL \
  -vvv

# 3. Deploy (broadcast transactions)
forge script script/Deploy.s.sol:DeploySepolia \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  -vvvv

# 4. Verify contracts
forge verify-contract <SOLVER_REGISTRY_ADDRESS> \
  src/SolverRegistry.sol:SolverRegistry \
  --chain sepolia \
  --etherscan-api-key $ETHERSCAN_API_KEY

forge verify-contract <INTENT_RECEIPT_HUB_ADDRESS> \
  src/IntentReceiptHub.sol:IntentReceiptHub \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(address)" <SOLVER_REGISTRY_ADDRESS>) \
  --etherscan-api-key $ETHERSCAN_API_KEY

forge verify-contract <DISPUTE_MODULE_ADDRESS> \
  src/DisputeModule.sol:DisputeModule \
  --chain sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" <HUB_ADDRESS> <REGISTRY_ADDRESS> <ARBITRATOR_ADDRESS>) \
  --etherscan-api-key $ETHERSCAN_API_KEY

# 5. Update deployments/sepolia.json with new addresses
```

### Polygon Amoy Deployment

```bash
# 1. Run tests
forge test

# 2. Dry-run (simulation)
forge script script/DeployAmoy.s.sol:DeployAmoy \
  --rpc-url $AMOY_RPC_URL \
  -vvv

# 3. Deploy with verification
forge script script/DeployAmoy.s.sol:DeployAmoy \
  --rpc-url $AMOY_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $POLYGONSCAN_API_KEY \
  -vvvv

# 4. If verification failed, run manually
# SolverRegistry (no constructor args)
forge verify-contract <SOLVER_REGISTRY_ADDRESS> \
  src/SolverRegistry.sol:SolverRegistry \
  --chain amoy \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# IntentReceiptHub (requires SolverRegistry address)
forge verify-contract <INTENT_RECEIPT_HUB_ADDRESS> \
  src/IntentReceiptHub.sol:IntentReceiptHub \
  --chain amoy \
  --constructor-args $(cast abi-encode "constructor(address)" <SOLVER_REGISTRY_ADDRESS>) \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# DisputeModule (requires Hub, Registry, and Arbitrator addresses)
# Note: Replace <ARBITRATOR_ADDRESS> with the deployer address or designated arbitrator
forge verify-contract <DISPUTE_MODULE_ADDRESS> \
  src/DisputeModule.sol:DisputeModule \
  --chain amoy \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" <INTENT_RECEIPT_HUB_ADDRESS> <SOLVER_REGISTRY_ADDRESS> <ARBITRATOR_ADDRESS>) \
  --etherscan-api-key $POLYGONSCAN_API_KEY

# 5. Update deployments/amoy.json with new addresses
```

---

## Post-Deployment

### 1. Update Deployment Records

Edit `deployments/<network>.json`:

```json
{
  "network": "amoy",
  "chainId": 80002,
  "nativeToken": "POL",
  "deployedAt": "2026-01-28T12:00:00Z",
  "deployer": "0xYourDeployerAddress",
  "contracts": {
    "SolverRegistry": "0xNewAddress",
    "IntentReceiptHub": "0xNewAddress",
    "DisputeModule": "0xNewAddress",
    "ERC8004Adapter": "0xNewAddress"
  },
  "polygonscan": {
    "SolverRegistry": "https://amoy.polygonscan.com/address/0xNewAddress",
    "IntentReceiptHub": "https://amoy.polygonscan.com/address/0xNewAddress",
    "DisputeModule": "https://amoy.polygonscan.com/address/0xNewAddress",
    "ERC8004Adapter": "https://amoy.polygonscan.com/address/0xNewAddress"
  }
}
```

### 2. Update SDK Configuration

Edit `sdk/src/types.ts`:

```typescript
amoy: {
  chainId: 80002,
  name: 'Polygon Amoy',
  rpcUrl: 'https://rpc-amoy.polygon.technology',
  explorer: 'https://amoy.polygonscan.com',
  nativeToken: 'POL',
  solverRegistry: '0xNewAddress',
  intentReceiptHub: '0xNewAddress',
  disputeModule: '0xNewAddress',
  erc8004Adapter: '0xNewAddress',
},
```

### 3. Update Dashboard Configuration

Edit `dashboard/src/lib/config.ts`:

```typescript
amoy: {
  chainId: 80002,
  name: 'Polygon Amoy',
  // ... update contract addresses
}
```

### 4. Update Subgraph (if applicable)

Edit `subgraph/networks.json` with new addresses, then:

```bash
cd subgraph
npm run codegen
npm run build
npm run deploy:amoy  # If configured
```

### 5. Commit and Tag

```bash
git add deployments/ sdk/src/types.ts dashboard/src/lib/config.ts
git commit -m "chore(deploy): update addresses for amoy deployment"
git tag -a v1.0.0-amoy -m "Polygon Amoy deployment"
git push origin main --tags
```

---

## Verification

### Verify Deployment State

```bash
# Check contract ownership
cast call <SOLVER_REGISTRY> "owner()(address)" --rpc-url $AMOY_RPC_URL

# Check authorized callers
cast call <SOLVER_REGISTRY> "authorizedCallers(address)(bool)" <HUB_ADDRESS> --rpc-url $AMOY_RPC_URL

# Check dispute module configuration
cast call <HUB_ADDRESS> "disputeModule()(address)" --rpc-url $AMOY_RPC_URL

# Check arbitrator
cast call <DISPUTE_MODULE> "arbitrator()(address)" --rpc-url $AMOY_RPC_URL
```

### Smoke Test

```bash
# Register a test solver (requires ETH/POL)
cast send <SOLVER_REGISTRY> \
  "registerSolver(string,address)(bytes32)" \
  "ipfs://QmTestMetadata" \
  $(cast wallet address $PRIVATE_KEY) \
  --rpc-url $AMOY_RPC_URL \
  --private-key $PRIVATE_KEY
```

---

## Rollback Procedures

### If Deployment Fails Mid-Way

1. **DO NOT** redeploy partially
2. Note which contracts deployed successfully
3. Check transaction hashes in broadcast logs: `broadcast/<chainId>/run-latest.json`
4. If SolverRegistry deployed but Hub failed:
   - Redeploy Hub and DisputeModule only
   - Manually call `setAuthorizedCaller`

### If Wrong Configuration Applied

1. Check owner has access
2. Use admin functions to correct:
   ```bash
   # Fix authorized callers
   cast send <SOLVER_REGISTRY> \
     "setAuthorizedCaller(address,bool)" \
     <CORRECT_ADDRESS> true \
     --rpc-url $AMOY_RPC_URL \
     --private-key $PRIVATE_KEY
   ```

### If Critical Bug Found

1. **Pause if possible** (contracts have Pausable)
   ```bash
   cast send <CONTRACT> "pause()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
   ```
2. Notify team immediately
3. Do NOT unpause until fix deployed
4. Deploy new contracts
5. Migrate state if needed (coordinate with users)

---

## Multisig Transition

### Recommended Multisig Setup

| Role | Type | Threshold |
|------|------|-----------|
| Owner | Gnosis Safe | 2-of-3 |
| Arbitrator | Gnosis Safe | 2-of-3 |
| Treasury | Gnosis Safe | 2-of-3 |

### Transfer Ownership to Multisig

```bash
# 1. Deploy Gnosis Safe (or use existing)
# 2. Transfer ownership
cast send <SOLVER_REGISTRY> \
  "transferOwnership(address)" \
  <SAFE_ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

cast send <HUB_ADDRESS> \
  "transferOwnership(address)" \
  <SAFE_ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

# 3. Update arbitrator
cast send <DISPUTE_MODULE> \
  "setArbitrator(address)" \
  <ARBITRATOR_SAFE_ADDRESS> \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY

# 4. Verify transfers
cast call <SOLVER_REGISTRY> "owner()(address)" --rpc-url $RPC_URL
```

### Emergency Multisig Procedures

1. **Emergency Pause**: Any signer can propose, requires threshold approval
2. **Ownership Recovery**: If keys lost, coordinate with remaining signers
3. **Key Rotation**: Add new signer, remove old, maintain threshold

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Not on Sepolia!` | Wrong network | Check RPC URL points to correct chain |
| `Insufficient ETH` | Low balance | Fund deployer wallet |
| `nonce too low` | Transaction already mined | Wait and retry, or increment nonce |
| `replacement underpriced` | Gas price too low | Increase gas price or wait |
| `execution reverted` | Contract revert | Check constructor args, verify dependencies |
| `contract size exceeds` | Too large | Enable optimizer, reduce code |

### Verification Failures

```bash
# If verification fails, try:
# 1. Wait longer (etherscan may be slow)
forge verify-contract <ADDRESS> <CONTRACT> --chain <CHAIN> --watch

# 2. Check compiler version matches
forge verify-contract <ADDRESS> <CONTRACT> --chain <CHAIN> --compiler-version 0.8.25

# 3. Flatten and verify manually
forge flatten src/Contract.sol > flat/Contract.sol
# Then verify via etherscan UI
```

### Gas Estimation Errors

```bash
# Increase gas limit
forge script ... --gas-estimate-multiplier 150

# Or set explicit gas
forge script ... --with-gas-price 30gwei
```

---

## Quick Reference Commands

```bash
# Build
forge build

# Test
forge test
forge test -vvv  # Verbose

# Deploy dry-run
forge script script/Deploy.s.sol:DeploySepolia --rpc-url $SEPOLIA_RPC_URL -vvv

# Deploy live
forge script script/Deploy.s.sol:DeploySepolia --rpc-url $SEPOLIA_RPC_URL --broadcast -vvvv

# Verify
forge verify-contract <ADDR> <CONTRACT> --chain <CHAIN> --etherscan-api-key <KEY>

# Read contract
cast call <ADDR> "functionName()(returnType)" --rpc-url $RPC_URL

# Write contract
cast send <ADDR> "functionName(args)" --rpc-url $RPC_URL --private-key $KEY

# Check balance
cast balance <ADDR> --rpc-url $RPC_URL

# Get chain ID
cast chain-id --rpc-url $RPC_URL
```

---

## Related Documents

- [IRSB Protocol Overview](./001-RL-PROP-irsb-solver-accountability.md)
- [Privacy Architecture](./PRIVACY.md)
- [Validation Provider](./VALIDATION_PROVIDER.md)
- [Monitoring Checklist](./MONITORING.md) *(Phase 7)*
