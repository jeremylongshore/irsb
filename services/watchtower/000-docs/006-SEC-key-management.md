# Key Management

## Overview

The watchtower needs a signing key to execute on-chain actions (opening disputes, submitting evidence). This document describes the key management approaches.

## Key Management Progression

```
Development          Production           Decentralized
    │                    │                     │
    ▼                    ▼                     ▼
┌─────────┐        ┌──────────┐        ┌────────────┐
│  Local  │   →    │ Cloud    │   →    │  Lit PKP   │
│  Key    │        │ KMS      │        │            │
└─────────┘        └──────────┘        └────────────┘
```

## 1. Local Private Key (Development Only)

**Implementation**: `LocalPrivateKeySigner`

**How it works**:
- Private key loaded from `PRIVATE_KEY` environment variable
- Key exists in memory during process lifetime
- Uses viem's `privateKeyToAccount` for signing

**Security**:
- ⚠️ Key in environment variable is risky
- ⚠️ Key in memory can be extracted
- ⚠️ No audit trail of signing operations

**Use cases**:
- Local development
- Testing
- Testnets

**Configuration**:
```bash
SIGNER_TYPE=local
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**Non-goals**:
- Local keys should NEVER be used in production with real funds
- Local keys should NEVER be committed to git

## 2. Google Cloud KMS (Production)

**Implementation**: `GcpKmsSigner` (stub)

**How it works**:
- Private key generated and stored in Google Cloud KMS HSM
- Key never leaves the HSM
- Watchtower sends signing requests to KMS API
- KMS signs and returns signature

**Security**:
- ✅ Key never exposed to application
- ✅ HSM-backed security
- ✅ IAM-based access control
- ✅ Audit logs of all signing operations
- ✅ Key rotation support

**Use cases**:
- Production deployments
- Enterprise environments
- Compliance requirements

**Configuration** (future):
```bash
SIGNER_TYPE=gcp-kms
GCP_PROJECT_ID=my-project
GCP_KMS_LOCATION=us-central1
GCP_KMS_KEYRING=watchtower
GCP_KMS_KEY=dispute-signer
```

**Implementation notes**:
- Use asymmetric signing key (secp256k1)
- Derive Ethereum address from public key
- Sign transaction/message hashes
- Requires `@google-cloud/kms` package

## 3. Lit Protocol PKP (Decentralized)

**Implementation**: `LitPkpSigner` (stub)

**How it works**:
- Private key split across Lit Protocol nodes (threshold cryptography)
- No single party holds complete key
- Signing requires consensus of Lit nodes
- Can embed conditional logic (Lit Actions)

**Security**:
- ✅ No single point of key compromise
- ✅ Decentralized trust model
- ✅ Programmable signing conditions
- ✅ Cross-chain compatible

**Use cases**:
- Maximum decentralization
- Conditional signing rules
- Multi-party authorization

**Configuration** (future):
```bash
SIGNER_TYPE=lit-pkp
LIT_PKP_PUBLIC_KEY=0x...
LIT_AUTH_SIG=...
LIT_NETWORK=habanero
```

**Implementation notes**:
- Use `@lit-protocol/lit-node-client`
- PKP public key determines Ethereum address
- Can combine with Lit Actions for complex logic

## Signer Selection

The watchtower selects signer based on `SIGNER_TYPE`:

```typescript
function createSigner(config: SignerConfig): Signer {
  switch (config.type) {
    case 'local':
      return new LocalPrivateKeySigner(config);
    case 'gcp-kms':
      return new GcpKmsSigner(config);
    case 'lit-pkp':
      return new LitPkpSigner(config);
    default:
      throw new Error(`Unknown signer type: ${config.type}`);
  }
}
```

## Key Rotation

### Local Keys
Manual rotation:
1. Generate new key
2. Update environment variable
3. Restart watchtower
4. (Optional) Transfer any bonds from old address

### Cloud KMS
Automatic or scheduled rotation:
1. Create new key version in KMS
2. Update watchtower config to use new version
3. Old version remains for signature verification
4. Disable old version after transition period

### Lit PKP
PKP keys don't rotate in the traditional sense. Instead:
1. Create new PKP
2. Update watchtower config
3. Transfer any bonds from old address
4. Retire old PKP

## Non-Goals

This key management system does NOT:
- Store keys in database
- Support multi-sig (handled at contract level)
- Handle key recovery (use KMS backup or Lit's distributed nature)
- Support hardware wallets (Ledger, Trezor)

## Security Best Practices

1. **Never log keys**: Ensure `PRIVATE_KEY` is never in logs
2. **Separate environments**: Different keys for dev/staging/prod
3. **Least privilege**: Watchtower key only needs dispute/evidence permissions
4. **Monitor signing**: Alert on unexpected transaction patterns
5. **Bond awareness**: Key compromise can lead to bond loss
6. **Backup strategy**: For KMS, ensure key backups per GCP guidelines

## Troubleshooting

### "Wallet client not configured"
Signer not set up. Check:
- `SIGNER_TYPE` environment variable
- Required config for that signer type
- `ENABLE_ACTIONS=true` if trying to execute actions

### "GcpKmsSigner is a stub"
KMS signer not yet implemented. Use local signer for development.

### "LitPkpSigner is a stub"
Lit signer not yet implemented. Use local signer for development.
