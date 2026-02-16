# Security Threat Model

## Overview

This document outlines the key security threats to the IRSB Watchtower and their mitigations.

## Threat Categories

### 1. Key Management Threats

#### T1.1: Private Key Theft
**Threat**: Attacker obtains the watchtower's signing key

**Impact**:
- Attacker can open fraudulent disputes
- Attacker can drain dispute bonds
- Protocol reputation damage

**Mitigations**:
- Use Cloud KMS or Lit PKP in production (keys never leave secure enclave)
- Rotate keys regularly
- Monitor for unexpected signing activity
- Implement rate limiting on actions
- Use separate keys for different environments

#### T1.2: Key Exposure in Logs
**Threat**: Private key accidentally logged

**Impact**: Key compromise

**Mitigations**:
- Never log `PRIVATE_KEY` environment variable
- Use structured logging with redaction
- Audit logging configuration
- Never include keys in error messages

### 2. Spam and Griefing Threats

#### T2.1: False Dispute Spam
**Threat**: Attacker triggers watchtower to open many invalid disputes

**Impact**:
- Bond losses
- Gas costs
- Reputation damage

**Mitigations**:
- `ENABLE_ACTIONS=false` by default
- Conservative rule thresholds
- Human review for high-impact actions
- Rate limiting on dispute opening
- Bond amount checks before action

#### T2.2: Resource Exhaustion
**Threat**: Attacker creates many receipts to overwhelm scanning

**Impact**: Watchtower falls behind, misses real violations

**Mitigations**:
- Efficient batch queries
- Configurable lookback limits
- Multiple watchtower instances
- Alert on scan lag

### 3. Rule Manipulation Threats

#### T3.1: Rule False Positives
**Threat**: Poorly written rule generates false findings

**Impact**: Unnecessary alerts, potential bond losses if auto-acting

**Mitigations**:
- Thorough rule testing
- Code review for rule changes
- Staged rollout (disable actions during testing)
- Severity levels to prioritize human review

#### T3.2: Rule Bypass
**Threat**: Malicious actor crafts transactions to evade detection

**Impact**: Real violations go undetected

**Mitigations**:
- Multiple independent rules
- Regular rule audits
- Community-contributed rules
- On-chain evidence requirements

### 4. Infrastructure Threats

#### T4.1: RPC Node Manipulation
**Threat**: Attacker controls RPC node, serves false data

**Impact**: Watchtower makes decisions on incorrect state

**Mitigations**:
- Use trusted RPC providers
- Multi-RPC consensus (future)
- Cross-reference with block explorers
- Archive node for historical queries

#### T4.2: Denial of Service
**Threat**: Attacker overwhelms watchtower API/worker

**Impact**: Monitoring stops

**Mitigations**:
- Rate limiting
- Health checks and auto-restart
- Multiple instances
- Separate API and worker processes

### 5. Operational Threats

#### T5.1: Configuration Errors
**Threat**: Wrong contract addresses, wrong chain ID

**Impact**: Monitoring wrong contracts, actions on wrong chain

**Mitigations**:
- Strong config validation (Zod schemas)
- Environment-specific configs
- Config verification on startup
- Integration tests against real contracts

#### T5.2: Stale State
**Threat**: Watchtower scans old blocks, misses real-time violations

**Impact**: Delayed detection

**Mitigations**:
- Block number tracking
- Alert on scan lag
- Configurable lookback
- Real-time event subscriptions (future)

## Security Controls Summary

| Control | Status | Priority |
|---------|--------|----------|
| Actions disabled by default | ✅ Implemented | Critical |
| Config validation | ✅ Implemented | High |
| Structured logging | ✅ Implemented | High |
| Rate limiting | ⚠️ Not yet | High |
| KMS signer | 📋 Stub | High |
| Multi-RPC | 📋 Future | Medium |
| Audit logging | 📋 Future | Medium |

## Incident Response

### If Key Is Compromised

1. Immediately disable watchtower actions
2. Rotate compromised key
3. Review recent transactions for unauthorized activity
4. Notify affected parties
5. Post-mortem analysis

### If False Disputes Opened

1. Identify affected disputes
2. Submit evidence of watchtower error
3. Accept any bond losses as cost
4. Fix rule that caused false positive
5. Review other rules for similar issues

## Security Checklist for Production

- [ ] Actions disabled until rules are validated
- [ ] KMS or Lit signer configured (not local key)
- [ ] Trusted RPC provider
- [ ] Rate limiting enabled
- [ ] Logging to secure destination
- [ ] Alerting configured
- [ ] Runbook for incidents
- [ ] Key rotation schedule
