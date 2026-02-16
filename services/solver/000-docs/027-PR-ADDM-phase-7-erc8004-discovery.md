# 027-PR-ADDM-phase-7-erc8004-discovery

**Document ID:** 027-PR-ADDM-phase-7-erc8004-discovery
**Repository:** irsb-solver
**Last Updated:** 2026-02-05
**Timezone:** America/Chicago

---

## Purpose

This addendum documents the ERC-8004 discovery features added in Phase 7.

---

## 1. What is ERC-8004?

ERC-8004 is a proposed standard for agent discovery and registration. It defines:

- **Agent Card**: A JSON document at `/.well-known/agent-card.json` describing the agent
- **Registration**: A payload submitted to a registry for discoverability

---

## 2. How We Use ERC-8004

The IRSB Solver uses ERC-8004 **for discovery only**:

| Feature | Status | Notes |
|---------|--------|-------|
| Agent Card | Implemented | Served at `/.well-known/agent-card.json` |
| Registration | Stub | CLI generates payload, no chain writes |
| LLM/Chat Agent | Not Used | We are not an LLM chat agent |
| Payment/Wallet | Not Used | No payment handling |

---

## 3. Agent Card

### 3.1 Location

```
GET /.well-known/agent-card.json
```

### 3.2 Fields

| Field | Value | Description |
|-------|-------|-------------|
| `agentId` | `irsb-solver@0.1.0` | Stable identifier |
| `name` | `irsb-solver` | Service name |
| `description` | (full text) | What the solver does |
| `version` | `0.1.0` | Semantic version |
| `capabilities` | `["intent-execution", "evidence-generation", "receipt-submission"]` | What we do |
| `endpoints.health` | `/healthz` | Liveness probe |
| `endpoints.metrics` | `/metrics` | Prometheus metrics |
| `endpoints.execute` | `N/A` | Non-interactive |
| `supportedTrust` | `[]` | Placeholder |
| `links.repository` | GitHub URL | Source code |
| `standards` | `["ERC-8004"]` | Implemented standards |

### 3.3 Example Response

```json
{
  "agentId": "irsb-solver@0.1.0",
  "name": "irsb-solver",
  "description": "IRSB Protocol reference solver/executor...",
  "version": "0.1.0",
  "capabilities": [
    "intent-execution",
    "evidence-generation",
    "receipt-submission"
  ],
  "endpoints": {
    "health": "/healthz",
    "metrics": "/metrics",
    "execute": "N/A"
  },
  "supportedTrust": [],
  "links": {
    "documentation": "https://github.com/intent-solutions-io/irsb-solver#readme",
    "repository": "https://github.com/intent-solutions-io/irsb-solver"
  },
  "standards": ["ERC-8004"]
}
```

---

## 4. Registration (Stubbed)

### 4.1 CLI Command

```bash
pnpm cli -- erc8004:register --dry-run
```

### 4.2 What It Does

1. Generates the agent card
2. Computes SHA-256 checksum of the card
3. Builds registration payload
4. Prints what would be sent (does NOT send)

### 4.3 Sample Output

```
=== ERC-8004 Registration (Dry Run) ===

Endpoint: https://registry.erc8004.example/v1/agents
Method: POST

Payload:
{
  "agentId": "irsb-solver@0.1.0",
  "name": "irsb-solver",
  "version": "0.1.0",
  "standards": ["ERC-8004"],
  "agentCardUrl": "http://localhost:8080/.well-known/agent-card.json",
  "agentCardChecksum": "1037ca6ca6aedc5bf121b419845862f68da8d84a30a45b7b49f9898daa150961",
  "registeredAt": "2026-02-05T22:34:44.164Z"
}

---
Note: This is a dry run. No actual registration was performed.
```

---

## 5. What is Intentionally Stubbed

| Feature | Why Stubbed |
|---------|-------------|
| On-chain registration | Requires wallet/key management - Phase 8+ |
| Registry endpoint | Placeholder URL, no real registry yet |
| Trust mechanisms | `supportedTrust` empty - future work |

---

## 6. Security Considerations

- No secrets in agent card
- No internal paths exposed
- No authentication required (public discovery)
- Deterministic output (no timestamps in card)

---

## 7. Verification

```bash
# Start server
pnpm start

# Fetch agent card
curl http://localhost:8080/.well-known/agent-card.json

# Run registration dry-run
pnpm cli -- erc8004:register --dry-run

# Get JSON output
pnpm cli -- erc8004:register --dry-run --format json
```

---

*End of Document*
