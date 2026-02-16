# IRSB Protocol Incident Playbook

Emergency response procedures for IRSB protocol operations.

## Severity Definitions

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P0 | Critical - Protocol at risk | 15 minutes | Exploit in progress, funds draining |
| P1 | High - Significant impact | 4 hours | Arbitrator down, contract paused |
| P2 | Medium - Operational issue | 24 hours | Subgraph lag, high gas costs |
| P3 | Low - Minor issue | 7 days | Documentation gaps, UI bugs |

---

## §1 - Emergency Response (P0)

### 1.1 Suspected Exploit

**Symptoms:**
- Unusual slashing patterns
- Unexpected fund movements
- Failed invariant checks

**Immediate Actions:**

```bash
# 1. Pause all contracts (if owner)
cast send $SOLVER_REGISTRY "pause()" --private-key $OWNER_KEY
cast send $INTENT_HUB "pause()" --private-key $OWNER_KEY
cast send $DISPUTE_MODULE "pause()" --private-key $OWNER_KEY

# 2. Verify pause state
cast call $SOLVER_REGISTRY "paused()"
cast call $INTENT_HUB "paused()"

# 3. Document current state
cast call $SOLVER_REGISTRY "totalBonds()"
cast balance $INTENT_HUB
cast balance $DISPUTE_MODULE
```

**Investigation Steps:**

1. Pull all recent transactions from affected contracts
2. Identify anomalous patterns
3. Trace source of exploit
4. Document timeline
5. Prepare root cause analysis

**Communication:**

```markdown
# Incident Alert - [TIMESTAMP]

## Status: INVESTIGATING

We have detected unusual activity and paused protocol contracts
as a precautionary measure.

- SolverRegistry: PAUSED
- IntentReceiptHub: PAUSED
- DisputeModule: PAUSED

User funds in escrow are safe. We are investigating.

Updates will follow every 30 minutes.
```

### 1.2 Mass Slashing Event

**Symptoms:**
- Multiple `SolverSlashed` events in rapid succession
- Solver bond balances dropping significantly

**Assessment:**

```bash
# Check recent slash events
cast logs --from-block -1000 $SOLVER_REGISTRY "SolverSlashed(bytes32,uint256,bytes32,uint8,address)"

# Verify total bond amounts
cast call $SOLVER_REGISTRY "getSolver(bytes32)" $SOLVER_ID
```

**Actions:**

1. If legitimate (actual violations): Monitor, no action
2. If suspicious (possible exploit): Follow §1.1 exploit response
3. If griefing (false disputes): Review dispute module

---

## §2 - Escalation Timeout (P1)

### 2.1 Arbitrator Unresponsive

**Symptoms:**
- Escalated disputes approaching 7-day timeout
- No `ArbitrationResolved` events from arbitrator

**Investigation:**

```bash
# Check escalated disputes nearing timeout
cast call $DISPUTE_MODULE "canResolveByTimeout(bytes32)" $DISPUTE_ID

# Verify arbitrator address
cast call $DISPUTE_MODULE "getArbitrator()"
```

**Actions:**

1. **Day 5**: Contact arbitrator directly
2. **Day 6**: Prepare timeout resolution
3. **Day 7**: Anyone can call `resolveByTimeout(disputeId)`

```bash
# Timeout resolution (permissionless)
cast send $DISPUTE_MODULE "resolveByTimeout(bytes32)" $DISPUTE_ID
```

### 2.2 Change Arbitrator (Owner Action)

```bash
# Set new arbitrator
cast send $DISPUTE_MODULE "setArbitrator(address)" $NEW_ARBITRATOR --private-key $OWNER_KEY

# Verify
cast call $DISPUTE_MODULE "getArbitrator()"
```

---

## §3 - Infrastructure Issues (P2)

### 3.1 Subgraph Out of Sync

**Symptoms:**
- Dashboard showing stale data
- `_meta.block.number` significantly behind chain head

**Diagnosis:**

```bash
# Check subgraph sync status
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"{ _meta { hasIndexingErrors block { number } } }"}' \
  $SUBGRAPH_URL

# Compare to chain head
cast block-number --rpc-url $RPC_URL
```

**Actions:**

1. Check The Graph status page
2. Review subgraph logs for errors
3. If persistent, redeploy subgraph:

```bash
cd subgraph
graph codegen
graph build
graph deploy --studio irsb-protocol
```

### 3.2 RPC Endpoint Down

**Symptoms:**
- Dashboard cannot load
- Transactions failing

**Actions:**

1. Switch to backup RPC:

```bash
# Update .env
SEPOLIA_RPC_URL=https://backup-rpc.example.com

# Verify
cast block-number --rpc-url $SEPOLIA_RPC_URL
```

2. Update dashboard config
3. Notify users if extended outage

---

## §4 - Cost Optimization (P2)

### 4.1 Gas Price Spike

**Symptoms:**
- Transaction costs significantly higher
- User complaints about fees

**Assessment:**

```bash
# Check current gas price
cast gas-price --rpc-url $RPC_URL

# Estimate transaction costs
cast estimate $INTENT_HUB "postReceipt((bytes32,bytes32,bytes32,bytes32,bytes32,uint64,uint64,bytes32,bytes))" $RECEIPT_DATA
```

**Actions:**

1. Monitor for sustained spike vs temporary
2. Update gas price recommendations in docs
3. Consider delaying non-urgent operations
4. Communicate expected costs to users

---

## §5 - Abuse Prevention (P1/P2)

### 5.1 Dispute Griefing

**Symptoms:**
- High volume of disputes against legitimate solvers
- Same challenger opening multiple disputes
- Disputes consistently rejected

**Investigation:**

```bash
# Check challenger's dispute history
cast logs $INTENT_HUB "DisputeOpened(bytes32,bytes32,address,uint8)" --from-block -10000 | grep $CHALLENGER_ADDRESS

# Check resolution outcomes
cast logs $INTENT_HUB "DisputeResolved(bytes32,bytes32,bool,uint256)"
```

**Actions:**

1. Document griefing pattern
2. Consider increasing challenger bond minimum (owner action):

```bash
cast send $INTENT_HUB "setChallengerBondMin(uint256)" 50000000000000000 --private-key $OWNER_KEY
# Sets challenger bond minimum to 0.05 ETH (50000000000000000 wei)
```

### 5.2 Evidence Spam

**Symptoms:**
- Excessive evidence submissions
- Gas costs rising for participants

**Actions:**

1. Document spam pattern
2. Evidence window is 24 hours - wait for expiry
3. Consider adding rate limiting in future version

---

## Post-Incident Procedures

### Incident Report Template

```markdown
# Incident Report: [TITLE]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours
- **Severity**: P0/P1/P2/P3
- **Status**: Resolved / Ongoing

## Timeline
- HH:MM - Event detected
- HH:MM - Response initiated
- HH:MM - Root cause identified
- HH:MM - Resolution deployed
- HH:MM - All clear confirmed

## Impact
- Users affected: X
- Funds at risk: X ETH
- Actual loss: X ETH (or none)

## Root Cause
[Detailed technical explanation]

## Resolution
[Actions taken to resolve]

## Prevention
[Changes to prevent recurrence]

## Action Items
- [ ] Item 1 - Owner - Due date
- [ ] Item 2 - Developer - Due date
```

### Communication Templates

**Initial Alert:**
> We are aware of [ISSUE] affecting [SCOPE]. Our team is investigating. Updates will follow.

**Update:**
> Update on [ISSUE]: We have identified [ROOT CAUSE]. Working on [RESOLUTION]. ETA: [TIME].

**Resolution:**
> [ISSUE] has been resolved. [BRIEF EXPLANATION]. No user funds were affected. Full post-mortem to follow.

---

## Emergency Contacts

| Role | Contact Method | Escalation Time |
|------|----------------|-----------------|
| On-call Engineer | PagerDuty | Immediate |
| Protocol Lead | Signal | 15 minutes |
| Core Team | Discord #emergency | 30 minutes |
| Arbitrator | Email | 4 hours |

---

## Contract Admin Functions

Quick reference for owner-only emergency functions:

```solidity
// Pause/Unpause (all contracts)
function pause() external onlyOwner
function unpause() external onlyOwner

// SolverRegistry
function banSolver(bytes32 solverId) external onlyOwner
function unjailSolver(bytes32 solverId) external onlyOwner

// IntentReceiptHub
function setChallengeWindow(uint64 window) external onlyOwner
function sweepForfeitedBonds(address treasury) external onlyOwner

// DisputeModule
function setArbitrator(address arbitrator) external onlyOwner
function withdrawFees() external onlyOwner
```
