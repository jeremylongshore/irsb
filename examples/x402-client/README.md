# x402 Client Example

Demonstrates the complete x402 payment → receipt → on-chain posting flow.

## Flow

```
1. Load config from .env
2. Make initial request → receive 402 with payment terms
3. Execute ETH payment on Sepolia
4. Wait for confirmation (2 blocks)
5. Retry request with X-Payment-Proof header
6. Receive result + receipt + signingPayload
7. Sign receipt as client (EIP-712 dual attestation)
8. Post receipt to IntentReceiptHub
9. Output: receiptId, txHash, etherscan links
```

## Prerequisites

- Node.js 18+
- Sepolia ETH in your wallet (get from [Sepolia Faucet](https://sepoliafaucet.com/))
- A running x402 service (see `examples/x402-express-service/`)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your values:
# - PRIVATE_KEY: Your wallet private key (with Sepolia ETH)
# - SERVICE_URL: URL of the x402 service
# - SERVICE_WALLET: The service's receiving wallet address
```

## Usage

```bash
# Start the x402 service first (in another terminal)
cd ../x402-express-service && pnpm dev

# Run the client with default prompt
pnpm start

# Run with custom prompt
pnpm start "Generate a creative story about space exploration"
```

## Example Output

```
============================================================
x402 Client - Payment → Receipt → Post Flow
============================================================

[Config] RPC URL: https://rpc.sepolia.org
[Config] Service URL: http://localhost:3000
[Config] Chain ID: 11155111
[Config] Hub Address: 0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c

[Prompt] "Hello, generate something creative!"

[Wallet] Address: 0x1234...
[Wallet] Balance: 0.5 ETH

[Step 1] Getting payment terms...
[Request] Requesting http://localhost:3000/api/generate...
[Request] Payment required: { amount: '1000000000000000', asset: 'ETH', ... }
[Terms] Amount: 0.001 ETH
[Terms] Chain ID: 11155111

[Step 2] Executing payment...
[Payment] Sending 0.001 ETH to 0x...
[Payment] Transaction sent: 0xabc...
[Payment] Waiting for 2 confirmation(s)...
[Payment] Confirmed in block 12345678
[Payment] Total cost: 0.001021 ETH

[Step 3] Requesting with payment proof...
[Request] Retrying with payment proof...
[Request] Success! Request ID: uuid-here

[Step 4] Signing and posting receipt...
[Post] Signing receipt as client...
[Post] Client signature: 0xdef...
[Post] Posting to IntentReceiptHub...
[Post] Receipt posted!
[Post] Receipt ID: 0x...
[Post] Transaction: 0x...

============================================================
SUCCESS!
============================================================

Receipt ID: 0x...
Transaction: 0x...
Block: 12345680
Gas used: 150000

Links:
  Payment Tx: https://sepolia.etherscan.io/tx/0xabc...
  Post Tx: https://sepolia.etherscan.io/tx/0xdef...
  Hub: https://sepolia.etherscan.io/address/0xD66A...
```

## Modules

| File | Purpose |
|------|---------|
| `src/index.ts` | Main entry point, orchestrates the flow |
| `src/pay.ts` | ETH payment execution on Sepolia |
| `src/request.ts` | x402 HTTP request flow (402 → pay → retry) |
| `src/post.ts` | Receipt signing and on-chain posting |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Wallet private key (0x...) |
| `SERVICE_URL` | No | x402 service URL (default: http://localhost:3000) |
| `SERVICE_WALLET` | Yes* | Service receiving address (* or from 402 response) |
| `RPC_URL` | No | Ethereum RPC (default: https://rpc.sepolia.org) |
| `CHAIN_ID` | No | Chain ID (default: 11155111 for Sepolia) |
| `IRSB_HUB_ADDRESS` | No | IntentReceiptHub address (default: Sepolia deployment) |

## Troubleshooting

**"Insufficient balance"**: Get Sepolia ETH from a faucet.

**"Transaction not found"**: Wait for transaction indexing, or check RPC endpoint.

**"No recipient address"**: Set `SERVICE_WALLET` in .env or ensure service returns it in 402.

**"Receipt posting failed"**: Ensure the service's solver is registered in SolverRegistry.

## Related

- [x402 Express Service](../x402-express-service/) - Server side of this flow
- [@irsb/x402-integration](../../packages/x402-irsb/) - Core integration library
- [IRSB Protocol](../../) - Intent Receipts & Solver Bonds
