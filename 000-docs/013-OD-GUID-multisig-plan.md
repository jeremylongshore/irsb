# IRSB Protocol Multisig Transition Plan

This document outlines the transition from single-owner contracts to Gnosis Safe multisig governance.

## Current State

All IRSB contracts use OpenZeppelin's `Ownable`:

| Contract | Owner | Critical Functions |
|----------|-------|-------------------|
| SolverRegistry | Deployer EOA | pause, setAuthorizedCaller, banSolver |
| IntentReceiptHub | Deployer EOA | pause, setChallengeWindow, setDisputeModule |
| DisputeModule | Deployer EOA | pause, setArbitrator, withdrawFees |
| AcrossAdapter | Deployer EOA | pause |

**Risk:** Single point of failure, key compromise = total protocol compromise

## Target State

```
                    ┌─────────────────────────┐
                    │     Gnosis Safe 2/3     │
                    │   (Protocol Multisig)   │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│SolverRegistry │       │IntentReceiptHub│       │ DisputeModule │
│   (Owned)     │       │    (Owned)     │       │   (Owned)     │
└───────────────┘       └───────────────┘       └───────────────┘
```

## Gnosis Safe Configuration

### Recommended Setup (Mainnet)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Threshold | 2 of 3 | Balance security with availability |
| Signers | 3 team members | Distribute key responsibility |
| Network | Same as contracts | Sepolia → Sepolia Safe, Mainnet → Mainnet Safe |

### Signer Requirements

Each signer must:
- Use a hardware wallet (Ledger, Trezor)
- Store seed phrase securely (metal backup recommended)
- Enable 2FA on associated email
- Not share signing access
- Be geographically distributed (if possible)

## Transition Procedure

### Phase 1: Create Gnosis Safe

```bash
# 1. Navigate to Safe app
# https://app.safe.global/new-safe/create

# 2. Select network (Sepolia for testnet)

# 3. Add signers
# Signer 1: 0x... (hardware wallet A)
# Signer 2: 0x... (hardware wallet B)
# Signer 3: 0x... (hardware wallet C)

# 4. Set threshold: 2

# 5. Deploy Safe
# Note the Safe address: 0x...
```

### Phase 2: Test Safe Operations

Before transferring ownership, verify Safe works:

```bash
# Send test ETH to Safe
cast send $SAFE_ADDRESS --value 0.01ether --private-key $TEST_KEY

# Verify balance
cast balance $SAFE_ADDRESS

# Create test transaction (send ETH back)
# Use Safe UI to initiate and confirm with 2 signers
```

### Phase 3: Transfer Ownership

**WARNING:** This is irreversible. Triple-check the Safe address.

```bash
# SolverRegistry
cast send $SOLVER_REGISTRY "transferOwnership(address)" $SAFE_ADDRESS --private-key $CURRENT_OWNER_KEY

# IntentReceiptHub
cast send $INTENT_HUB "transferOwnership(address)" $SAFE_ADDRESS --private-key $CURRENT_OWNER_KEY

# DisputeModule
cast send $DISPUTE_MODULE "transferOwnership(address)" $SAFE_ADDRESS --private-key $CURRENT_OWNER_KEY

# AcrossAdapter (if deployed)
cast send $ACROSS_ADAPTER "transferOwnership(address)" $SAFE_ADDRESS --private-key $CURRENT_OWNER_KEY
```

### Phase 4: Verify Ownership

```bash
# Verify new owner
cast call $SOLVER_REGISTRY "owner()"
# Expected: $SAFE_ADDRESS

cast call $INTENT_HUB "owner()"
# Expected: $SAFE_ADDRESS

cast call $DISPUTE_MODULE "owner()"
# Expected: $SAFE_ADDRESS
```

### Phase 5: Test Multisig Operations

Verify the Safe can execute contract functions:

1. Create proposal to call `setAuthorizedCaller` with a test address
2. Collect 2 signatures
3. Execute transaction
4. Verify state change
5. Revert test change

## Emergency Procedures

### Emergency Pause (Requires 2 Signatures)

```solidity
// Queue transaction in Safe:
Target: SolverRegistry
Function: pause()
Value: 0

Target: IntentReceiptHub
Function: pause()
Value: 0

Target: DisputeModule
Function: pause()
Value: 0
```

### Key Compromise Response

If a signer key is compromised:

1. **Immediately** queue transaction to remove compromised signer
2. Get remaining signers to approve removal
3. Add new signer with secure key
4. Rotate any API keys the compromised key had access to
5. Audit recent transactions for unauthorized actions

### Lost Key Recovery

If a signer loses access to their key:

1. Remaining 2 signers can still operate (2/3 threshold)
2. Queue transaction to remove lost signer
3. Add replacement signer
4. Execute with 2 remaining signatures

## Governance Guidelines

### When to Use Multisig

| Action | Approval Required | Notes |
|--------|-------------------|-------|
| Pause contracts | 2/3 signatures | Emergency only |
| Unpause contracts | 2/3 signatures | After incident resolved |
| Change arbitrator | 2/3 signatures | Rare operation |
| Adjust parameters | 2/3 signatures | Document rationale |
| Withdraw treasury | 2/3 signatures | Track in accounting |

### Transaction Review Process

1. **Proposal**: Any signer can propose
2. **Review**: At least 24 hours for non-emergency
3. **Discussion**: Document in Discord/forum
4. **Approval**: Collect required signatures
5. **Execution**: Any signer can execute after threshold met

### Record Keeping

Maintain audit trail:
- Screenshot every Safe transaction
- Document rationale for each action
- Record signer who initiated, who approved
- Store in shared secure location

## Timeline

| Phase | Duration | Completion Criteria |
|-------|----------|---------------------|
| Safe Creation | 1 day | Safe deployed and funded |
| Testing | 3 days | Test transactions executed |
| Ownership Transfer | 1 day | All contracts transferred |
| Verification | 1 day | All operations confirmed |
| Documentation | Ongoing | Playbooks updated |

**Total Estimated Time:** 1 week

## Checklist

### Pre-Transfer
- [ ] Safe deployed on correct network
- [ ] All signers confirmed and tested signing
- [ ] Test transaction executed successfully
- [ ] Safe has ETH for gas
- [ ] Current owner key securely accessible

### Transfer
- [ ] SolverRegistry ownership transferred
- [ ] IntentReceiptHub ownership transferred
- [ ] DisputeModule ownership transferred
- [ ] AcrossAdapter ownership transferred (if applicable)

### Post-Transfer
- [ ] All ownership verified via `owner()` calls
- [ ] Test multisig operation executed
- [ ] Old owner key archived securely
- [ ] Team notified of new governance
- [ ] Documentation updated

## Resources

- [Gnosis Safe Documentation](https://docs.safe.global/)
- [Safe Web App](https://app.safe.global/)
- [OpenZeppelin Ownable](https://docs.openzeppelin.com/contracts/4.x/api/access#Ownable)
