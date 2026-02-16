# 030-DR-THMD-threat-model-v0

**Document ID:** 030-DR-THMD-threat-model-v0
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This document provides the initial threat model (v0) for the IRSB Solver. It identifies assets, trust boundaries, threats, and current mitigations.

---

## 1. Assets

| Asset | Description | Sensitivity |
|-------|-------------|-------------|
| **Intent Data** | Input intents with parameters | Medium - may contain business logic |
| **Artifacts** | Generated reports (JSON, MD) | Medium - execution results |
| **Evidence Bundle** | Manifest + artifact hashes | High - integrity critical |
| **Configuration** | Environment variables, config files | High - contains paths, settings |
| **Logs** | Structured JSON logs | Medium - correlation data |
| **Receipts** | Execution records (future) | High - audit trail |

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUSTED ZONE                              │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │   Operator    │  │  Config Files │  │  Local Storage   │ │
│  │  (Admin CLI)  │  │  (.env, json) │  │  (DATA_DIR)      │ │
│  └───────────────┘  └───────────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    TRUST BOUNDARY                            │
├─────────────────────────────────────────────────────────────┤
│                  SEMI-TRUSTED ZONE                           │
│  ┌───────────────┐  ┌───────────────┐                       │
│  │   Intent      │  │   HTTP        │                       │
│  │   Fixtures    │  │   Endpoints   │                       │
│  └───────────────┘  └───────────────┘                       │
├─────────────────────────────────────────────────────────────┤
│                    TRUST BOUNDARY                            │
├─────────────────────────────────────────────────────────────┤
│                   UNTRUSTED ZONE                             │
│  ┌───────────────┐  ┌───────────────┐                       │
│  │   External    │  │   Chain       │                       │
│  │   Network     │  │   (Future)    │                       │
│  └───────────────┘  └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Threat Analysis

### 3.1 Tampering with Artifacts/Manifest

| Aspect | Detail |
|--------|--------|
| **Threat** | Attacker modifies artifacts or manifest after generation |
| **Impact** | Evidence integrity compromised, invalid receipts |
| **Likelihood** | Medium (requires local access) |
| **Mitigation (Current)** | SHA-256 hashing of all artifacts in manifest |
| **Mitigation (Future)** | Cryptographic signing, append-only storage |

### 3.2 Malicious Intent Inputs

| Aspect | Detail |
|--------|--------|
| **Threat** | Attacker crafts intent to exploit execution |
| **Impact** | Code injection, data exfiltration, resource abuse |
| **Likelihood** | Medium |
| **Mitigation (Current)** | Zod schema validation, policy gates, job type allowlist |
| **Mitigation (Future)** | Sandbox execution, input size limits |

### 3.3 Path Traversal

| Aspect | Detail |
|--------|--------|
| **Threat** | Intent specifies paths outside DATA_DIR |
| **Impact** | Arbitrary file read/write |
| **Likelihood** | Medium |
| **Mitigation (Current)** | Controlled artifact paths, no user-controlled paths |
| **Mitigation (Future)** | Explicit path sanitization, chroot/container |

### 3.4 Log Injection / Secret Leakage

| Aspect | Detail |
|--------|--------|
| **Threat** | Sensitive data logged, or attacker injects log entries |
| **Impact** | Credential exposure, log tampering |
| **Likelihood** | Low-Medium |
| **Mitigation (Current)** | Pino redaction for passwords, tokens, API keys |
| **Mitigation (Future)** | Structured log validation |

### 3.5 Denial of Service (Large Inputs)

| Aspect | Detail |
|--------|--------|
| **Threat** | Attacker sends very large intents or triggers resource exhaustion |
| **Impact** | Service unavailability |
| **Likelihood** | Medium |
| **Mitigation (Current)** | POLICY_MAX_ARTIFACT_MB limit, rate limiting on /readyz |
| **Mitigation (Future)** | Request size limits, queue with backpressure |

### 3.6 Configuration Tampering

| Aspect | Detail |
|--------|--------|
| **Threat** | Attacker modifies config to bypass policy |
| **Impact** | Unauthorized job execution |
| **Likelihood** | Low (requires server access) |
| **Mitigation (Current)** | Environment-based config, no runtime modification |
| **Mitigation (Future)** | Config signing, immutable deployment |

### 3.7 Evidence Bundle Replay

| Aspect | Detail |
|--------|--------|
| **Threat** | Attacker resubmits old evidence as new |
| **Impact** | Stale or invalid receipts accepted |
| **Likelihood** | Low |
| **Mitigation (Current)** | Unique runId derived from intent hash |
| **Mitigation (Future)** | Timestamp validation, nonce tracking |

---

## 4. Attack Surface Summary

| Surface | Exposure | Risk Level |
|---------|----------|------------|
| CLI (local) | Local operator only | Low |
| HTTP /healthz | Public | Low (no data) |
| HTTP /readyz | Public (rate limited) | Low |
| HTTP /metrics | Public | Low (no secrets) |
| HTTP /.well-known/agent-card.json | Public | Low (static data) |
| Filesystem (DATA_DIR) | Local | Medium |
| Future: Intent API | Network | High |
| Future: Chain submitter | Network | High |

---

## 5. Current Security Posture

### Strengths

- Schema validation (Zod) for all inputs
- Policy gate with job type allowlist
- SHA-256 hashing for evidence integrity
- Log redaction for sensitive fields
- Rate limiting on I/O endpoints
- No secrets in agent card or logs
- Deterministic execution (reproducible)

### Gaps (Future Work)

- No input size limits on intents
- No sandbox for job execution
- No cryptographic signing of receipts
- No formal audit completed
- No chain interaction security model

---

## 6. Recommendations (Priority Order)

1. **High**: Add input size limits for intent payloads
2. **High**: Implement execution sandbox (VM/container)
3. **Medium**: Add cryptographic signing for evidence
4. **Medium**: Implement receipt persistence and verification
5. **Low**: Formal security audit before production

---

*End of Document*
