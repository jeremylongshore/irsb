# Running on Vertex AI Agent Engine

## Overview

Vertex AI Agent Engine provides a managed runtime for executing agent code. The IRSB Watchtower can run as a Vertex agent, with the Agent Engine handling:

- Scheduling and execution
- Resource management
- Logging and monitoring
- Authentication

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                 Vertex AI Agent Engine                     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                   Agent Runtime                       │ │
│  │  ┌────────────┐    ┌─────────────────────────────┐  │ │
│  │  │  Trigger   │───▶│    IRSB Watchtower          │  │ │
│  │  │ (schedule) │    │  ┌─────────┐  ┌─────────┐   │  │ │
│  │  └────────────┘    │  │  Core   │  │  Chain  │   │  │ │
│  │                    │  │ Engine  │  │ Adapter │   │  │ │
│  │                    │  └────┬────┘  └────┬────┘   │  │ │
│  │                    │       │            │        │  │ │
│  │                    │       ▼            ▼        │  │ │
│  │                    │  ┌─────────────────────┐    │  │ │
│  │                    │  │     Findings        │    │  │ │
│  │                    │  └─────────────────────┘    │  │ │
│  │                    └─────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│                              │                             │
│                              ▼                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Cloud Logging / Pub/Sub                  │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## Integration Pattern

### Option 1: Scheduled Job

Run the watchtower as a scheduled job that:
1. Executes on a cron schedule
2. Runs a single scan cycle
3. Outputs findings to Cloud Logging
4. Exits

**Entry point**:
```typescript
// vertex-entrypoint.ts
import { RuleEngine, createDefaultRegistry } from '@irsb-watchtower/core';
import { createChainContext } from './chain-context';

export async function handler(event: VertexEvent): Promise<VertexResponse> {
  const engine = new RuleEngine(createDefaultRegistry());
  const context = await createChainContext();

  const result = await engine.execute(context);

  // Log findings (goes to Cloud Logging)
  for (const finding of result.findings) {
    console.log(JSON.stringify(finding));
  }

  return {
    statusCode: 200,
    body: {
      findingsCount: result.findings.length,
      rulesExecuted: result.rulesExecuted,
    },
  };
}
```

### Option 2: HTTP Service

Deploy the watchtower API as an HTTP service:
1. Agent Engine invokes the `/scan` endpoint
2. Results returned in response
3. Agent can take follow-up actions

**Benefits**:
- Reuses existing Fastify API
- Supports on-demand scans
- Can integrate with Agent Engine tools

### Option 3: Event-Driven

Trigger scans based on events:
1. Subscribe to IRSB contract events via webhook
2. Agent Engine invokes watchtower for each event
3. Targeted analysis of specific receipts

## Configuration for Vertex

### Environment Variables

Same as local, but set via Vertex AI Agent Engine config:

```yaml
env:
  - name: RPC_URL
    value: https://eth-sepolia.g.alchemy.com/v2/...
  - name: CHAIN_ID
    value: "11155111"
  - name: LOG_FORMAT
    value: json  # Important for Cloud Logging
  - name: LOG_LEVEL
    value: info
```

### Secrets

For the signer key, use Secret Manager:

```yaml
env:
  - name: SIGNER_TYPE
    value: gcp-kms
  - name: GCP_PROJECT_ID
    value: my-project
  - name: GCP_KMS_KEYRING
    value: watchtower
  - name: GCP_KMS_KEY
    value: dispute-signer
```

## Actions via Agent Tools

Agent Engine can invoke watchtower actions as tools:

```yaml
tools:
  - name: scan_irsb
    description: Scan IRSB protocol for violations
    endpoint: /scan
    method: POST

  - name: open_dispute
    description: Open a dispute against a receipt
    endpoint: /actions/open-dispute
    method: POST
    parameters:
      - name: receiptId
        type: string
        required: true
      - name: reason
        type: string
        required: true
```

## Logging

Use JSON format for Cloud Logging integration:

```bash
LOG_FORMAT=json
```

Findings are logged as structured JSON:
```json
{
  "level": "warn",
  "time": 1699996400000,
  "msg": "Finding detected",
  "finding": {
    "id": "SAMPLE-001-1000000-...",
    "ruleId": "SAMPLE-001",
    "severity": "MEDIUM",
    ...
  }
}
```

## Monitoring

### Cloud Monitoring Metrics

Create custom metrics for:
- `watchtower/findings_total` - Counter of findings by severity
- `watchtower/scan_duration_ms` - Histogram of scan durations
- `watchtower/rules_failed` - Counter of rule failures

### Alerting

Set up alerts for:
- HIGH or CRITICAL severity findings
- Rule failures
- Scan duration exceeding threshold
- No scans in expected interval

## Cost Considerations

- **Compute**: Pay per invocation/runtime
- **Networking**: RPC calls to external nodes
- **Logging**: Cloud Logging ingestion
- **Actions**: Gas costs for on-chain transactions

Optimize by:
- Batching RPC calls
- Limiting lookback range
- Using efficient rules

## Deployment

1. Build container:
```bash
docker build -t gcr.io/PROJECT/irsb-watchtower .
docker push gcr.io/PROJECT/irsb-watchtower
```

2. Deploy to Agent Engine:
```bash
gcloud agent-engine deploy \
  --image=gcr.io/PROJECT/irsb-watchtower \
  --env-vars-file=env.yaml
```

3. Configure schedule:
```bash
gcloud scheduler jobs create http watchtower-scan \
  --schedule="*/5 * * * *" \
  --uri="https://agent-engine.../scan"
```

## Limitations

- Cold start latency for infrequent scans
- Network egress for RPC calls
- Timeout constraints (configure appropriately)
- No persistent state between invocations

## Best Practices

1. Use JSON logging for Cloud Logging
2. Set appropriate timeouts
3. Use GCP KMS for signing (not local keys)
4. Monitor and alert on findings
5. Test locally before deploying
6. Use staging environment first
