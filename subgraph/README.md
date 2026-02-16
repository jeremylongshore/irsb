# IRSB Subgraph

The Graph subgraph for indexing IRSB Protocol events on Sepolia.

## Entities

| Entity | Description |
|--------|-------------|
| `Solver` | Solver registration, bond, reputation, status |
| `Receipt` | Intent receipts with challenge status |
| `Challenge` | Challenge history |
| `Dispute` | Complex dispute tracking |
| `SlashEvent` | Slashing history |
| `BondEvent` | Bond deposit/withdrawal history |
| `ProtocolStats` | Aggregate protocol metrics |
| `DailyStats` | Daily analytics |

## Setup

```bash
# Install dependencies
npm install

# Generate types from schema
npm run codegen

# Build
npm run build
```

## Deploy to Subgraph Studio

1. Create subgraph at https://thegraph.com/studio
2. Authenticate:
   ```bash
   graph auth --studio <DEPLOY_KEY>
   ```
3. Deploy:
   ```bash
   npm run deploy:studio
   ```

## Deploy to Hosted Service

```bash
graph auth --product hosted-service <ACCESS_TOKEN>
npm run deploy:hosted
```

## Local Development

```bash
# Start local Graph node (requires Docker)
docker-compose up

# Create local subgraph
npm run create:local

# Deploy locally
npm run deploy:local
```

## Example Queries

### Get Top Solvers by IntentScore

```graphql
{
  solvers(
    first: 10
    orderBy: intentScore
    orderDirection: desc
    where: { status: Active }
  ) {
    id
    bondAmount
    intentScore
    fillRate
    totalIntents
    successfulIntents
    jailCount
    status
  }
}
```

### Get Protocol Stats

```graphql
{
  protocolStats(id: "stats") {
    totalSolvers
    activeSolvers
    jailedSolvers
    bannedSolvers
    totalBonded
    totalSlashed
    totalReceipts
    totalChallenges
  }
}
```

### Get Recent Receipts

```graphql
{
  receipts(
    first: 20
    orderBy: postedAt
    orderDirection: desc
  ) {
    id
    solver {
      id
      intentScore
    }
    status
    postedAt
    deadline
    challenger
    challengeReason
    slashAmount
  }
}
```

### Get Solver History

```graphql
{
  solver(id: "0x...") {
    id
    bondAmount
    reputation
    intentScore
    fillRate
    totalIntents
    successfulIntents
    jailCount
    status
    receipts(first: 10, orderBy: postedAt, orderDirection: desc) {
      id
      status
      postedAt
    }
    slashEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
      amount
      reason
      timestamp
    }
  }
}
```

### Get Daily Stats

```graphql
{
  dailyStats(
    first: 30
    orderBy: date
    orderDirection: desc
  ) {
    id
    date
    newSolvers
    receiptsPosted
    challengesFiled
    slashEvents
    slashAmount
    bondDeposited
    bondWithdrawn
  }
}
```

## Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## Schema

See `schema.graphql` for full entity definitions.
