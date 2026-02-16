# IRSB Solver Dashboard

**Live**: https://irsb-protocol.web.app

Public dashboard showing solver reputation and performance metrics.

## Features

- **IntentScore Ranking** - Solvers ranked by composite score
- **Real-time Metrics** - Fill rate, speed, slashing events
- **Status Tracking** - Active, jailed, inactive solvers
- **Bond Visibility** - Staked collateral per solver

## IntentScore Formula

```
IntentScore = (SuccessRate × 0.4) + (SpeedScore × 0.2) +
              (VolumeScore × 0.2) + (DisputeScore × 0.2)
```

- **SuccessRate** (40%): Fill rate percentage
- **SpeedScore** (20%): Average execution speed (faster = better)
- **VolumeScore** (20%): Total intents processed (log scale)
- **DisputeScore** (20%): Fewer slashing events = higher score

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel:

```bash
npm run build
npx vercel
```

## Data Sources

Currently using demo data. In production:
- **The Graph** for CoWSwap settlement events
- **IRSB SolverRegistry** for bond/status info
- **On-chain calculations** for IntentScores

## IRSB Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |
