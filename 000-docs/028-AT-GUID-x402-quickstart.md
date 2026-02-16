# x402 + IRSB Integration Quickstart

**Document ID:** 028-AT-GUID-x402-quickstart
**Category:** Application/Technical (AT) - Guide (GUID)
**Version:** 1.0.0
**Date:** 2026-01-30
**Status:** Active

## Overview

This guide walks through integrating x402 HTTP payments with IRSB accountability receipts. By the end, you'll have a working flow where:

1. Client makes a request to your paid API
2. Service returns HTTP 402 with payment terms
3. Client sends ETH payment on Sepolia
4. Client retries request with payment proof
5. Service generates and signs an IRSB ReceiptV2
6. Client counter-signs and posts receipt on-chain

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Sepolia ETH in a test wallet
- Basic understanding of Ethereum transactions

## Quick Start (5 minutes)

### 1. Clone and Install

```bash
git clone https://github.com/intent-solutions-io/irsb-protocol
cd irsb-protocol
pnpm install
```

### 2. Build the Integration Package

```bash
cd packages/x402-irsb
pnpm build
```

### 3. Configure the Service

```bash
cd examples/x402-express-service
cp .env.example .env
```

Edit `.env` with your values:

```env
# Required
SERVICE_PRIVATE_KEY=0x...your-solver-key...
SERVICE_SOLVER_ID=0x...your-registered-solver-id...
IRSB_HUB_ADDRESS=0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c

# Recommended
SERVICE_WALLET=0x...wallet-to-receive-payments...
RPC_URL=https://rpc.sepolia.org
```

### 4. Configure the Client

```bash
cd examples/x402-client
cp .env.example .env
```

Edit `.env`:

```env
PRIVATE_KEY=0x...your-client-wallet-key...
SERVICE_URL=http://localhost:3000
SERVICE_WALLET=0x...service-wallet-from-step-3...
```

### 5. Run the Flow

Terminal 1 - Start the service:
```bash
cd examples/x402-express-service
pnpm dev
```

Terminal 2 - Run the client:
```bash
cd examples/x402-client
pnpm start "Generate something creative"
```

### 6. Verify on Etherscan

The client outputs links to verify:
- Payment transaction
- Receipt posting transaction
- IntentReceiptHub contract

## Architecture

```
┌──────────────┐     ┌──────────────────────────────┐     ┌────────────────┐
│    Client    │     │    x402 Express Service      │     │ IntentReceiptHub│
├──────────────┤     ├──────────────────────────────┤     ├────────────────┤
│              │ 1.  │                              │     │                │
│  POST /api   ├────►│  402 Payment Required        │     │                │
│              │◄────┤  {amount, recipient, chain}  │     │                │
│              │     │                              │     │                │
│ 2. sendTx() │────►│  (payment goes to wallet)    │     │                │
│              │     │                              │     │                │
│ 3. POST +   │     │                              │     │                │
│    proof    ├────►│  4. Verify payment on-chain  │     │                │
│              │     │  5. Generate ReceiptV2       │     │                │
│              │◄────┤  6. Sign as solver           │     │                │
│              │     │  {result, receipt, payload}  │     │                │
│              │     │                              │     │                │
│ 7. Sign as  │     │                              │     │                │
│    client   │     │                              │     │                │
│              │     │                              │     │                │
│ 8. postReceipt()──┼─────────────────────────────►│  Store receipt  │
│              │     │                              │     │                │
└──────────────┘     └──────────────────────────────┘     └────────────────┘
```

## Key Components

### @irsb/x402-integration Package

The npm package provides all the helpers you need:

```typescript
import {
  // Build receipts
  createPayload,
  buildReceiptV2WithConfig,
  validateReceiptV2,

  // Sign receipts
  signAsService,
  signAsClient,
  signReceiptDual,

  // Post on-chain
  postReceiptV2,
  postReceiptV2FromX402,

  // Network config
  SEPOLIA_CONFIG,
  getNetworkConfig,
  getTransactionUrl,
} from '@irsb/x402-integration';
```

### Service-Side Implementation

The express service shows how to:
1. Return 402 with payment terms
2. Verify payment on-chain
3. Generate and sign receipts

Key files:
- `src/middleware/x402.ts` - Payment middleware
- `src/services/paymentVerifier.ts` - On-chain verification
- `src/services/irsbReceipt.ts` - Receipt generation

### Client-Side Implementation

The client demonstrates:
1. Getting payment terms from 402
2. Sending ETH payment
3. Retrying with proof
4. Signing as client
5. Posting receipt on-chain

Key files:
- `src/pay.ts` - Payment execution
- `src/request.ts` - HTTP 402 flow
- `src/post.ts` - Receipt signing and posting

## Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## E2E Test Script

Run the full flow automatically:

```bash
cd examples
./x402-e2e-test.sh "My test prompt"
```

This starts the service, runs the client, and verifies the receipt.

## Production Considerations

### Payment Verification

The example includes real on-chain verification. For production:

1. ✅ Verify transaction exists
2. ✅ Check sender matches claimed payer
3. ✅ Verify recipient is your wallet
4. ✅ Confirm amount is sufficient
5. ✅ Wait for confirmations (2+ blocks)

### Receipt Posting

Two options:
1. **Client posts** (default) - Client signs and posts, pays gas
2. **Service posts** - Set `POST_RECEIPTS_ON_CHAIN=true` in service

### Security Checklist

- [ ] Never expose private keys
- [ ] Use environment variables
- [ ] Rate limit endpoints
- [ ] Validate all inputs
- [ ] Enable HTTPS in production
- [ ] Monitor for failed payments

## Troubleshooting

### "Insufficient balance"

Your wallet needs Sepolia ETH. Get from:
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia

### "Transaction not found"

Wait a few seconds and retry. The RPC may be slow to index.

### "Solver not registered"

Register your solver with the SolverRegistry:
```bash
cast send 0xB6ab964832808E49635fF82D1996D6a888ecB745 \
  "register(bytes32,string,string)" \
  <YOUR_SOLVER_ID> "Your Service" "https://your-domain.com" \
  --value 0.1ether \
  --rpc-url https://rpc.sepolia.org \
  --private-key $SERVICE_PRIVATE_KEY
```

### "Receipt posting failed"

Check:
1. Solver is registered and active
2. Private key matches solver registration
3. Receipt hasn't already been posted

## Next Steps

1. **Register a solver** on the SolverRegistry
2. **Integrate with your API** - Add x402 middleware to your endpoints
3. **Deploy to production** - Use mainnet contracts
4. **Add escrow** - For commerce mode with held payments

## Related Documentation

- [016-AT-INTG-x402-integration.md](./016-AT-INTG-x402-integration.md) - Full integration specification
- [007-AT-SPEC-irsb-receipt-schema.md](./007-AT-SPEC-irsb-receipt-schema.md) - Receipt schema details
- [010-OD-GUID-deployment-guide.md](./010-OD-GUID-deployment-guide.md) - Contract deployment guide
