# IRSB Watchtower - GCP Infrastructure

This directory contains OpenTofu (Terraform-compatible) configurations for deploying the IRSB Watchtower to Google Cloud Platform.

## Overview

This configuration deploys:
- Cloud Run service for the API
- Cloud Scheduler for periodic scans (optional)
- Secret Manager for sensitive configuration
- IAM bindings for service accounts

## Prerequisites

1. **OpenTofu or Terraform installed**
   ```bash
   # OpenTofu
   brew install opentofu
   # or Terraform
   brew install terraform
   ```

2. **GCP Project configured**
   ```bash
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **APIs enabled**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     cloudscheduler.googleapis.com
   ```

4. **Container image built and pushed**
   ```bash
   # From repo root
   docker build -t gcr.io/YOUR_PROJECT/irsb-watchtower:latest .
   docker push gcr.io/YOUR_PROJECT/irsb-watchtower:latest
   ```

## Usage

### 1. Initialize

```bash
cd infra/tofu/gcp
tofu init
```

### 2. Configure Variables

Create `terraform.tfvars`:
```hcl
project_id = "your-gcp-project"
region     = "us-central1"
image      = "gcr.io/your-project/irsb-watchtower:latest"

# Optional
rpc_url    = "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
chain_id   = "11155111"
```

### 3. Plan

```bash
tofu plan
```

### 4. Apply

```bash
tofu apply
```

### 5. Get Service URL

```bash
tofu output service_url
```

## Configuration

See `variables.tf` for all available configuration options.

### Required Variables

| Variable | Description |
|----------|-------------|
| `project_id` | GCP project ID |
| `region` | GCP region |
| `image` | Container image URL |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `service_name` | irsb-watchtower | Cloud Run service name |
| `rpc_url` | - | RPC endpoint URL |
| `chain_id` | 11155111 | Chain ID (Sepolia) |
| `enable_actions` | false | Enable on-chain actions |
| `scan_schedule` | */5 * * * * | Cron schedule for scans |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Google Cloud                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Cloud      │    │   Cloud      │    │    Secret        │  │
│  │   Scheduler  │───▶│   Run        │◀───│    Manager       │  │
│  │   (cron)     │    │   (API)      │    │    (config)      │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                        │
│                    │   External RPC   │                        │
│                    │   (Alchemy, etc) │                        │
│                    └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## Secrets Management

Sensitive values should be stored in Secret Manager:

```bash
# Create secret for RPC URL
echo -n "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY" | \
  gcloud secrets create irsb-rpc-url --data-file=-

# Create secret for private key (if using local signer)
echo -n "0x..." | \
  gcloud secrets create irsb-private-key --data-file=-
```

Then reference in terraform:
```hcl
rpc_url_secret = "irsb-rpc-url"
private_key_secret = "irsb-private-key"
```

## Cleanup

```bash
tofu destroy
```

## Security Considerations

1. **Never commit secrets** - Use Secret Manager or environment variables
2. **Use service accounts** - Don't use personal credentials
3. **Limit permissions** - Follow principle of least privilege
4. **Enable audit logging** - Monitor for unauthorized access
5. **Use VPC** - For production, deploy in a VPC with private networking

## Troubleshooting

### Service won't start
```bash
gcloud run services logs read irsb-watchtower --region=us-central1
```

### Permission denied
```bash
# Check IAM bindings
gcloud run services get-iam-policy irsb-watchtower --region=us-central1
```

### Secret not found
```bash
# List secrets
gcloud secrets list
# Check secret access
gcloud secrets versions access latest --secret=irsb-rpc-url
```
