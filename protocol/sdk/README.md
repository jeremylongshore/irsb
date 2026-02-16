# irsb-sdk

TypeScript SDK for the IRSB Protocol (Intent Receipts & Solver Bonds).

[![npm version](https://badge.fury.io/js/irsb-sdk.svg)](https://www.npmjs.com/package/irsb-sdk)
[![CI](https://github.com/intent-solutions-io/irsb-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/intent-solutions-io/irsb-protocol/actions/workflows/ci.yml)

## Installation

```bash
npm install irsb-sdk ethers
```

## Examples

See the [`examples/`](./examples) directory for complete integration examples:

- **[solver-integration.ts](./examples/solver-integration.ts)** - Full solver workflow: register, bond, post receipts, handle disputes
- **[challenger-integration.ts](./examples/challenger-integration.ts)** - Monitor and challenge invalid receipts
- **[query-subgraph.ts](./examples/query-subgraph.ts)** - Query protocol data from The Graph

## Quick Start

```typescript
import { IRSBClient } from '@irsb/sdk';
import { ethers } from 'ethers';

// Connect to Sepolia
const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const client = new IRSBClient({
  chain: 'sepolia',
  signer,
});

// Check if registered
const isActive = await client.isActiveSolver(signer.address);
console.log('Active solver:', isActive);
```

## Solver Registration

```typescript
// Register with minimum bond (0.1 ETH)
const tx = await client.register({
  value: ethers.parseEther('0.1'),
});
await tx.wait();
console.log('Registered as solver');

// Deposit more bond
await client.depositBond({
  value: ethers.parseEther('0.5'),
});

// Check bond balance
const bond = await client.getSolverBond(signer.address);
console.log('Total bond:', ethers.formatEther(bond), 'ETH');
```

## Posting Receipts

After executing an intent off-chain, post a receipt:

```typescript
import { IRSBClient, PostReceiptParams } from '@irsb/sdk';

// Prepare receipt data
const intentHash = ethers.keccak256(ethers.toUtf8Bytes('intent-data'));
const constraintsHash = ethers.keccak256(ethers.toUtf8Bytes('constraints'));
const outcomeHash = ethers.keccak256(ethers.toUtf8Bytes('outcome'));
const evidenceHash = ethers.ZeroHash; // or IPFS hash of proof
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

// Sign the receipt
const solverSig = await client.signReceipt({
  intentHash,
  constraintsHash,
  outcomeHash,
  evidenceHash,
  deadline,
});

// Post on-chain
const tx = await client.postReceipt({
  intentHash,
  constraintsHash,
  outcomeHash,
  evidenceHash,
  deadline,
  solverSig,
});
await tx.wait();
console.log('Receipt posted:', tx.hash);
```

## Challenging Receipts

If you observe a violation:

```typescript
import { DisputeReason } from '@irsb/sdk';

// Calculate required bond (10% of potential slash)
const slashAmount = ethers.parseEther('0.1');
const challengerBond = client.calculateChallengerBond(slashAmount);

// Submit challenge
const tx = await client.challengeReceipt(
  intentHash,
  DisputeReason.MinOutViolation,
  { value: challengerBond }
);
await tx.wait();
console.log('Challenge submitted');
```

## Withdrawing Bond

```typescript
// Request withdrawal (starts 7-day cooldown)
await client.requestWithdrawal(ethers.parseEther('0.1'));

// After 7 days, execute withdrawal
await client.executeWithdrawal();

// Or cancel if needed
await client.cancelWithdrawal();
```

## Reading State

```typescript
// Get solver info
const solver = await client.getSolver('0x...');
console.log('Status:', solver.status);
console.log('Bond:', ethers.formatEther(solver.bondAmount));
console.log('Reputation:', solver.reputation);
console.log('Jail count:', solver.jailCount);

// Get receipt
const receipt = await client.getReceipt(intentHash);
if (receipt) {
  console.log('Solver:', receipt.solver);
  console.log('Status:', receipt.status);
}

// Get challenge
const challenge = await client.getChallenge(intentHash);
if (challenge) {
  console.log('Challenger:', challenge.challenger);
  console.log('Reason:', challenge.reason);
}
```

## Types

```typescript
import {
  SolverStatus,
  ReceiptStatus,
  DisputeReason,
  SolverInfo,
  IntentReceipt,
  CONSTANTS,
} from '@irsb/sdk';

// Enums
SolverStatus.Active    // 1
ReceiptStatus.Posted   // 1
DisputeReason.Timeout  // 0x01

// Constants
CONSTANTS.MINIMUM_BOND         // 0.1 ETH
CONSTANTS.WITHDRAWAL_COOLDOWN  // 7 days
CONSTANTS.CHALLENGE_WINDOW     // 1 hour
```

## Custom Chain Config

```typescript
const client = new IRSBClient({
  chain: {
    chainId: 1,
    rpcUrl: 'https://mainnet.infura.io/v3/...',
    solverRegistry: '0x...',
    intentReceiptHub: '0x...',
    disputeModule: '0x...',
  },
  signer,
});
```

## Contract Addresses

### Sepolia Testnet

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## API Reference

### IRSBClient

#### Constructor

```typescript
new IRSBClient(options: {
  chain: string | ChainConfig;
  signer?: Signer;
  provider?: Provider;
})
```

#### Solver Registry Methods

| Method | Description |
|--------|-------------|
| `getSolver(address)` | Get solver info |
| `isActiveSolver(address)` | Check if active |
| `getSolverBond(address)` | Get total bond |
| `getAvailableBond(address)` | Get unlocked bond |
| `register({ value })` | Register as solver |
| `depositBond({ value })` | Add to bond |
| `requestWithdrawal(amount)` | Start withdrawal |
| `executeWithdrawal()` | Complete withdrawal |
| `cancelWithdrawal()` | Cancel withdrawal |
| `unjail({ value })` | Pay to unjail |

#### Receipt Hub Methods

| Method | Description |
|--------|-------------|
| `getReceipt(intentHash)` | Get receipt |
| `getChallenge(intentHash)` | Get challenge |
| `postReceipt(params)` | Post receipt |
| `challengeReceipt(hash, reason, { value })` | Challenge |
| `finalizeReceipt(intentHash)` | Finalize |

#### Dispute Module Methods

| Method | Description |
|--------|-------------|
| `getDispute(intentHash)` | Get dispute |
| `submitEvidence(hash, evidenceHash)` | Submit evidence |
| `escalateToArbitration(intentHash)` | Escalate |

#### Utilities

| Method | Description |
|--------|-------------|
| `signReceipt(params)` | Sign receipt data |
| `calculateChallengerBond(slashAmount)` | Calculate bond |
| `getAddresses()` | Get contract addresses |

## License

MIT
