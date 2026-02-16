# IRSB Protocol Security Operations Guide

Operational security procedures for maintaining the IRSB protocol infrastructure.

## Key Management

### Current State: Single EOA Owner

Until multisig transition (see `MULTISIG_PLAN.md`), the protocol operates with a single owner EOA.

**Critical Rules:**

1. **Never expose the private key in:**
   - `.env` files committed to git
   - CI/CD logs or environment variables
   - Slack/Discord/email messages
   - Screen shares or recordings

2. **Key Storage:**
   ```
   PRODUCTION: Hardware wallet (Ledger/Trezor) only
   TESTNET: Can use encrypted keystore, never plaintext
   ```

3. **Transaction Signing:**
   ```bash
   # NEVER use --private-key flag with actual key
   # Instead, use frame, ledger, or keystore

   # With Ledger
   cast send $CONTRACT "pause()" --ledger

   # With encrypted keystore (prompts for password - more secure)
   cast send $CONTRACT "pause()" --keystore ~/.foundry/keystores/owner

   # With Frame wallet
   cast send $CONTRACT "pause()" --unlocked
   ```

### Pre-Multisig Operational Checklist

| Item | Frequency | Action |
|------|-----------|--------|
| Verify owner address | Weekly | `cast call $CONTRACT "owner()"` |
| Check contract paused state | Daily | `cast call $CONTRACT "paused()"` |
| Review recent owner txns | Daily | Check Etherscan for owner address |
| Backup keystore | Monthly | Encrypted backup to secure location |
| Test recovery procedure | Quarterly | Verify backup can sign testnet tx |

### Hardware Wallet Best Practices

1. **Purchase directly from manufacturer** (never Amazon/eBay)
2. **Initialize on air-gapped machine** if possible
3. **Store seed phrase in metal** (fire/water resistant)
4. **Use passphrase (25th word)** for additional security
5. **Keep firmware updated** but verify signatures
6. **Test recovery before storing** significant funds

## Forta Monitoring Bots

### Bot Specifications

Deploy Forta bots for real-time threat detection:

#### Bot 1: Bond Drain Detector

```typescript
// bot-config.json
{
  "name": "irsb-bond-drain-detector",
  "description": "Alerts when solver bonds decrease abnormally",
  "severity": "CRITICAL",
  "alertThreshold": {
    "bondDecreasePercent": 20,
    "timeWindowMinutes": 60
  }
}

// Detection logic
function handleTransaction(txEvent) {
  const slashEvents = txEvent.filterLog(SOLVER_SLASHED_EVENT, SOLVER_REGISTRY);

  // Track cumulative slashes in rolling window
  const recentSlashes = getRecentSlashes(60); // minutes
  const totalBonds = getTotalBonds();

  if (recentSlashes / totalBonds > 0.2) {
    return Finding.fromObject({
      name: "Mass Bond Drain Detected",
      description: `${recentSlashes} ETH slashed in 60 minutes (${(recentSlashes/totalBonds*100).toFixed(1)}% of total)`,
      alertId: "IRSB-BOND-DRAIN",
      severity: FindingSeverity.Critical,
      type: FindingType.Exploit
    });
  }
}
```

#### Bot 2: Unauthorized Caller Detector

```typescript
// bot-config.json
{
  "name": "irsb-unauthorized-caller",
  "description": "Detects calls from non-authorized addresses",
  "severity": "HIGH"
}

// Detection logic
function handleTransaction(txEvent) {
  // Check if slash was called by non-hub address
  const slashCalls = txEvent.filterFunction(
    "slash(bytes32,uint256,bytes32,uint8,address)",
    SOLVER_REGISTRY
  );

  for (const call of slashCalls) {
    if (txEvent.from !== INTENT_RECEIPT_HUB) {
      return Finding.fromObject({
        name: "Unauthorized Slash Attempt",
        description: `Slash called by ${txEvent.from}, expected ${INTENT_RECEIPT_HUB}`,
        alertId: "IRSB-UNAUTHORIZED-CALLER",
        severity: FindingSeverity.High,
        type: FindingType.Suspicious
      });
    }
  }
}
```

#### Bot 3: Dispute Anomaly Detector

```typescript
// bot-config.json
{
  "name": "irsb-dispute-anomaly",
  "description": "Detects unusual dispute patterns",
  "severity": "MEDIUM",
  "alertThreshold": {
    "disputesPerHour": 10,
    "sameChallenger": 5
  }
}

// Detection logic
function handleTransaction(txEvent) {
  const disputeEvents = txEvent.filterLog(DISPUTE_OPENED_EVENT, INTENT_HUB);

  for (const event of disputeEvents) {
    const challenger = event.args.challenger;
    const recentDisputes = getChallengerDisputes(challenger, 60);

    if (recentDisputes.length >= 5) {
      return Finding.fromObject({
        name: "Dispute Griefing Pattern",
        description: `${challenger} opened ${recentDisputes.length} disputes in 1 hour`,
        alertId: "IRSB-DISPUTE-GRIEFING",
        severity: FindingSeverity.Medium,
        type: FindingType.Suspicious
      });
    }
  }
}
```

### Forta Alert Routing

| Alert ID | Severity | Action | Notification |
|----------|----------|--------|--------------|
| IRSB-BOND-DRAIN | Critical | Immediate pause review | PagerDuty + Discord |
| IRSB-UNAUTHORIZED-CALLER | High | Investigate source | Discord + Email |
| IRSB-DISPUTE-GRIEFING | Medium | Monitor pattern | Discord |
| IRSB-PAUSE-EVENT | Info | Confirm intentional | Discord |

### Forta Deployment

```bash
# Install Forta CLI
npm install -g forta-agent

# Initialize bot project
forta-agent init --typescript

# Test locally
npm run test

# Deploy to Forta network
forta-agent publish

# Subscribe to alerts
# https://app.forta.network/alerts
```

## Security Review Process

### Before Any Contract Change

1. **Code Review Checklist:**
   - [ ] No new external calls to untrusted contracts
   - [ ] No unbounded loops added
   - [ ] Reentrancy patterns checked (CEI)
   - [ ] Access control verified
   - [ ] Event emission for state changes
   - [ ] Integer overflow impossible (Solidity 0.8+)

2. **Testing Requirements:**
   - [ ] All existing tests pass
   - [ ] New regression test for any fix
   - [ ] Fuzz tests for parameter handling
   - [ ] Invariant tests still pass
   - [ ] Gas usage acceptable

3. **Static Analysis:**
   ```bash
   # Must pass before merge
   slither . --config-file slither.config.json --fail-high

   # Review any new findings
   slither . --print human-summary
   ```

### Before Any Parameter Change

Parameter changes via owner functions require:

1. **Document rationale** in PR or governance proposal
2. **Calculate impact** on existing users/solvers
3. **Announce in advance** (24h minimum for non-emergency)
4. **Test on fork** before mainnet:
   ```bash
   # Fork mainnet and test parameter change
   anvil --fork-url $MAINNET_RPC

   # In another terminal
   cast send $CONTRACT "setChallengeWindow(uint64)" 7200 --private-key $TEST_KEY --rpc-url http://localhost:8545

   # Verify behavior
   forge test --fork-url http://localhost:8545
   ```

## Operational Runbook

### Daily Security Checks

```bash
#!/bin/bash
# daily-security-check.sh

echo "=== IRSB Daily Security Check ==="
echo "Date: $(date)"
echo ""

# 1. Contract pause status
echo "--- Contract Status ---"
cast call $SOLVER_REGISTRY "paused()" --rpc-url $RPC_URL
cast call $INTENT_HUB "paused()" --rpc-url $RPC_URL
cast call $DISPUTE_MODULE "paused()" --rpc-url $RPC_URL

# 2. Owner verification
echo ""
echo "--- Owner Addresses ---"
cast call $SOLVER_REGISTRY "owner()" --rpc-url $RPC_URL
cast call $INTENT_HUB "owner()" --rpc-url $RPC_URL
cast call $DISPUTE_MODULE "owner()" --rpc-url $RPC_URL

# 3. Bond totals
echo ""
echo "--- Bond Status ---"
echo "SolverRegistry balance: $(cast balance $SOLVER_REGISTRY --rpc-url $RPC_URL)"

# 4. Recent events (last 100 blocks)
echo ""
echo "--- Recent Slashes ---"
cast logs --from-block -100 $SOLVER_REGISTRY "SolverSlashed(bytes32,uint256,bytes32,uint8,address)" --rpc-url $RPC_URL | wc -l
echo " slashes in last ~100 blocks"

echo ""
echo "=== Check Complete ==="
```

### Weekly Security Tasks

| Task | Command/Action | Expected Result |
|------|----------------|-----------------|
| Review Forta alerts | Check app.forta.network | No critical unaddressed |
| Audit owner transactions | Etherscan owner address | Only expected txns |
| Check subgraph sync | Query `_meta.block` | Within 50 blocks |
| Review GitHub security | Check Dependabot alerts | All addressed |
| Test backup key access | Sign testnet tx | Success |

### Monthly Security Tasks

| Task | Action |
|------|--------|
| Rotate API keys | RPC endpoints, Etherscan, Graph |
| Review access permissions | GitHub, cloud infrastructure |
| Update dependencies | `forge update`, npm audit fix |
| Backup verification | Restore and test keystore |
| Documentation review | Update any stale procedures |

## Secrets Management

### Required Secrets

| Secret | Location | Rotation |
|--------|----------|----------|
| Owner private key | Hardware wallet | Never (use new wallet) |
| RPC endpoint API keys | `.env` (gitignored) | Quarterly |
| Etherscan API key | `.env` (gitignored) | Annually |
| Graph deploy key | CI secrets | Annually |
| Forta agent key | Forta CLI | As needed |

### Environment File Template

```bash
# .env.example (committed)
# Copy to .env and fill in values (never commit .env)

# RPC Endpoints
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Block Explorer
ETHERSCAN_API_KEY=YOUR_KEY

# Deployment (NEVER store actual key here)
# Use: --keystore or --ledger instead
DEPLOYER_ADDRESS=0x...

# Contract Addresses
SOLVER_REGISTRY=0x...
INTENT_HUB=0x...
DISPUTE_MODULE=0x...
```

### CI/CD Security

1. **Never log secrets** - Use GitHub Actions secret masking
2. **Minimal permissions** - Each job gets only needed secrets
3. **No deploy from PRs** - Only from protected branches
4. **Require reviews** - Enforce branch protection

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    environment: production  # Requires approval
    steps:
      - name: Deploy
        env:
          DEPLOYER_KEY: ${{ secrets.DEPLOYER_KEY }}
        run: |
          # Key is masked in logs, passed explicitly to forge
          forge script script/Deploy.s.sol --broadcast --private-key $DEPLOYER_KEY
```

## Incident Response Quick Reference

| Scenario | Immediate Action | Reference |
|----------|------------------|-----------|
| Suspected exploit | Pause all contracts | INCIDENT_PLAYBOOK.md §1.1 |
| Key compromise | Pause + plan recovery | INCIDENT_PLAYBOOK.md §1.1 |
| Arbitrator unresponsive | Wait for timeout, then resolve | INCIDENT_PLAYBOOK.md §2.1 |
| Infrastructure down | Switch to backup RPC | INCIDENT_PLAYBOOK.md §3.2 |
| Griefing attack | Monitor, adjust parameters | INCIDENT_PLAYBOOK.md §5.1 |

## Related Documentation

- `MULTISIG_PLAN.md` - Transition to Gnosis Safe governance
- `INCIDENT_PLAYBOOK.md` - Emergency response procedures
- `MONITORING.md` - Metrics and alerting configuration
- `DEPLOYMENT.md` - Deployment and verification runbook
