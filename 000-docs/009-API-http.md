# HTTP API Reference

## Base URL

```
http://localhost:3000
```

## Endpoints

### Health Check

#### GET /health

Liveness probe. Returns 200 if the service is running.

**Request:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-14T10:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600
}
```

#### GET /health/ready

Readiness probe. Checks if service is ready to accept traffic.

**Request:**
```bash
curl http://localhost:3000/health/ready
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-14T10:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600
}
```

---

### Scanning

#### POST /scan

Trigger a scan cycle and return findings.

**Request:**
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Request Body (optional):**
```json
{
  "ruleIds": ["SAMPLE-001", "MOCK-ALWAYS-FIND"],
  "lookbackBlocks": 1000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ruleIds` | string[] | Specific rules to run (optional, runs all enabled if not specified) |
| `lookbackBlocks` | number | Blocks to look back (optional) |

**Response:**
```json
{
  "success": true,
  "findings": [
    {
      "id": "SAMPLE-001-1000000-1699996400000",
      "ruleId": "SAMPLE-001",
      "title": "Receipt abc123... approaching challenge deadline",
      "description": "Receipt 0xabc123... from solver 0xdef456... will reach its challenge deadline in 5 minutes.",
      "severity": "MEDIUM",
      "category": "RECEIPT",
      "timestamp": "2024-11-14T10:00:00.000Z",
      "blockNumber": "1000000",
      "receiptId": "0xabc123...",
      "solverId": "0xdef456...",
      "recommendedAction": "MANUAL_REVIEW",
      "metadata": {
        "challengeDeadline": "2024-11-14T10:05:00.000Z",
        "timeUntilDeadlineMs": 300000
      },
      "actedUpon": false
    }
  ],
  "metadata": {
    "rulesExecuted": 1,
    "rulesFailed": 0,
    "totalDurationMs": 45,
    "blockNumber": "1000000",
    "timestamp": "2024-11-14T10:00:00.000Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "findings": [],
  "metadata": {
    "rulesExecuted": 2,
    "rulesFailed": 1,
    "totalDurationMs": 30100,
    "blockNumber": "1000000",
    "timestamp": "2024-11-14T10:00:00.000Z"
  },
  "errors": [
    {
      "ruleId": "FAILING-RULE",
      "error": "Rule timed out"
    }
  ]
}
```

#### GET /scan/rules

List available rules.

**Request:**
```bash
curl http://localhost:3000/scan/rules
```

**Response:**
```json
{
  "rules": [
    {
      "id": "SAMPLE-001",
      "name": "Sample Challenge Window Rule",
      "description": "Detects receipts that are approaching their challenge deadline.",
      "severity": "MEDIUM",
      "category": "RECEIPT",
      "enabledByDefault": true,
      "version": "1.0.0"
    },
    {
      "id": "MOCK-ALWAYS-FIND",
      "name": "Mock Always Find Rule",
      "description": "Always produces a finding - for testing only",
      "severity": "INFO",
      "category": "SYSTEM",
      "enabledByDefault": false,
      "version": "1.0.0"
    }
  ]
}
```

---

### Actions

Actions are disabled by default (`ENABLE_ACTIONS=false`). When disabled, these endpoints return 403.

#### POST /actions/open-dispute

Open a dispute against a receipt.

**Request:**
```bash
curl -X POST http://localhost:3000/actions/open-dispute \
  -H "Content-Type: application/json" \
  -d '{
    "receiptId": "0x1234567890abcdef...",
    "reason": "TIMEOUT",
    "evidenceHash": "0xfedcba0987654321...",
    "bondAmount": "100000000000000000"
  }'
```

| Field | Type | Description |
|-------|------|-------------|
| `receiptId` | string | Receipt ID to dispute (bytes32 hex) |
| `reason` | string | Dispute reason (TIMEOUT, WRONG_AMOUNT, etc.) |
| `evidenceHash` | string | Evidence hash (bytes32 hex) |
| `bondAmount` | string | Bond amount in wei |

**Response (when disabled):**
```json
{
  "success": false,
  "error": "Actions are disabled",
  "message": "Set ENABLE_ACTIONS=true to enable on-chain actions"
}
```

**Response (when enabled but not implemented):**
```json
{
  "success": false,
  "error": "Not implemented",
  "message": "Would open dispute for receipt 0x123... with reason \"TIMEOUT\", evidence 0xfed..., bond 100000000000000000 wei"
}
```

**Response (when fully implemented):**
```json
{
  "success": true,
  "txHash": "0x789abc..."
}
```

#### POST /actions/submit-evidence

Submit evidence for an existing dispute.

**Request:**
```bash
curl -X POST http://localhost:3000/actions/submit-evidence \
  -H "Content-Type: application/json" \
  -d '{
    "disputeId": "0xabcdef1234567890...",
    "evidenceHash": "0x9876543210fedcba...",
    "description": "Additional proof of timeout"
  }'
```

| Field | Type | Description |
|-------|------|-------------|
| `disputeId` | string | Dispute ID (bytes32 hex) |
| `evidenceHash` | string | Evidence hash (bytes32 hex) |
| `description` | string | Optional description |

**Response:** Same pattern as open-dispute.

#### GET /actions/status

Check if actions are enabled and signer is healthy.

**Request:**
```bash
curl http://localhost:3000/actions/status
```

**Response:**
```json
{
  "enabled": false,
  "signerConfigured": false,
  "signerType": null,
  "signerHealthy": false
}
```

**Response (with signer):**
```json
{
  "enabled": true,
  "signerConfigured": true,
  "signerType": "local",
  "signerHealthy": true
}
```

---

## Error Responses

### 400 Bad Request

Invalid request body or parameters.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body must be object"
}
```

### 403 Forbidden

Actions disabled or unauthorized.

```json
{
  "success": false,
  "error": "Actions are disabled",
  "message": "Set ENABLE_ACTIONS=true to enable on-chain actions"
}
```

### 500 Internal Server Error

Unexpected server error.

```json
{
  "success": false,
  "error": "Chain connection failed"
}
```

### 501 Not Implemented

Feature not yet implemented.

```json
{
  "success": false,
  "error": "Not implemented",
  "message": "..."
}
```

---

## Content Types

All endpoints accept and return `application/json`.

---

## Rate Limiting

Currently no rate limiting. For production, configure at the infrastructure level (Cloud Run, API Gateway, etc.).

---

## Authentication

Currently no authentication. For production, add:
- API keys
- JWT tokens
- Cloud IAM integration
