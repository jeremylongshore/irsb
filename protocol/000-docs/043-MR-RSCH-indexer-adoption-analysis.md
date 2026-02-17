# Blockchain Indexer Adoption: Facts Only

**IRSB Research Document | February 17, 2026**
**No hype. No marketing claims. Verified data only.**

---

## At a Glance

| Metric | Envio | Ponder | The Graph | Goldsky |
|--------|-------|--------|-----------|---------|
| **GitHub Stars** | 480 | ~1,000 | ~4,500 | N/A (closed) |
| **Named Production Users** | 3 confirmed | 2 confirmed | 15,500 subgraphs | 7-10 named |
| **Team Size** | Unknown (small) | 3 people | Large (foundation + community) | 30 people |
| **Funding** | $5M seed (Jan 2023) | None (open source) | GRT token ($312M mcap) | $20M seed (Sep 2022) |
| **Series A** | None found | N/A | N/A | None found |
| **License** | Proprietary EULA | MIT | Apache 2.0 | Proprietary |
| **Self-Host** | Yes | Yes (only option) | Yes | No |
| **Managed Hosting** | Yes | No | Decentralized network | Yes (only option) |
| **Language** | TypeScript/ReScript | TypeScript | AssemblyScript | YAML pipelines / GraphQL |
| **Chains** | 70+ EVM | ~20 EVM | 80+ | 40+ (EVM + non-EVM) |

---

## 1. Envio HyperIndex

### Verified Production Deployments (3 confirmed, 1 WIP)

| Project | Status | Migration From | Details |
|---------|--------|---------------|---------|
| **Sablier** | Active production | The Graph | Consolidated 12 subgraphs across 11 chains into 1 indexer |
| **Velodrome/Aerodrome** | Active production | Unknown | Multi-chain DEX indexing (Base, Optimism, Mode, Lisk) |
| **Jarvis Network** | Active production | Unknown | Chainlink price feeds across 4 chains, self-hosted |
| **Polymarket** | WIP (testing) | The Graph | Consolidating all subgraphs into single indexer |

### GitHub Reality

| Metric | Value |
|--------|-------|
| Stars | 480 (10% of The Graph) |
| Forks | 37 |
| Contributors | 18 |
| Open Issues | 75 |
| Releases | 164 total, ~2-3/month |
| Primary Language | ReScript (58%), Rust (28%), TypeScript (6%) |

### Funding

- $5M seed (January 2023), led by 6th Man Ventures
- No Series A found after 3 years
- Based in London
- Team size undisclosed

### Performance Claims (Envio's own benchmarks, NOT third-party verified)

| Claim | Source |
|-------|--------|
| 103x faster than The Graph | Envio blog |
| 80x faster than Ponder | Envio blog (Uniswap V3 benchmark) |
| 2000x faster than standard RPC | Envio marketing |
| 25,000-30,000 events/second | v2.29.0 release notes |

### What's Missing

- Total hosted indexer count: NOT DISCLOSED
- NPM download numbers: NOT PUBLICLY AVAILABLE
- Discord/Telegram community size: UNKNOWN
- Revenue: PRIVATE
- Independent performance verification: NONE

### Bottom Line

Real tool with real deployments, but adoption is small. 3 confirmed production users after 3 years. Technically impressive (Rust + ReScript core), but ReScript is an unusual choice that limits contributor pool. Still seed-funded with no Series A, suggesting either bootstrapping or slow growth.

---

## 2. Ponder

### Verified Production Deployments (2 confirmed)

| Project | Status | Details |
|---------|--------|---------|
| **Uniswap** | Active | Multiple indexers: CCA auctions, The Compact protocol (multichain) |
| **Frak** | Active | Automated on-chain rewards on Arbitrum, high-frequency events |

Other repos found: BasePaint, BuidlGuidl, CONCEALMINT, HyperLendX (smaller projects).

### GitHub Reality

| Metric | Value |
|--------|-------|
| Stars | ~1,000 |
| Forks | 227 |
| Version | v0.16.3 (still pre-1.0) |
| Release cadence | Multiple per month |

### Team & Funding

- **3 people** (Kevin, Kyle, Jay)
- **No VC funding** - pure open source
- **Team joined Monad Foundation** (recent)
- MIT license - true open source, no restrictions

### NPM Downloads

- **@ponder/core: 601 weekly downloads**
- Classification: "Not popular"
- For context: popular frameworks get thousands daily

### Technical Limitations (Documented)

1. Self-hosted only (no managed option)
2. Requires PostgreSQL with <50ms latency
3. Still v0.16 (pre-1.0, API may change)
4. ~20 chains supported (EVM only)
5. 80x slower than Envio in benchmarks (Envio's test)
6. Experimental parallel processing
7. Requires DevOps expertise to run

### Developer Sentiment

- Praised for hot-reload DX and TypeScript-native experience
- "Still super early = some bugs" (@sweetman_eth)
- Small but engaged community
- Team responsive to feedback

### Bottom Line

Best open-source option (MIT license, no vendor risk). Uniswap using it is meaningful signal. But 3-person team, 601 weekly downloads, and pre-1.0 versioning are honest concerns. If you need zero vendor lock-in and can self-host, this is the pick. If you need speed or managed hosting, look elsewhere.

---

## 3. The Graph

### Current Usage (Q4 2025, Messari)

| Metric | Value | Trend |
|--------|-------|-------|
| Active Subgraphs | 15,500 | All-time high (7 quarters of growth) |
| Q4 2025 Queries | 4.97 billion | Down 8.9% QoQ |
| Q1 2025 Queries | 6.1 billion | Peak |
| Cumulative Queries | 1.27 trillion | Growing |
| Active Indexers | 71 serving queries | Down 23% from 92 |
| Indexers with Stake | 94 | Down 20% from 118 |

### Token Economics (February 2026)

| Metric | Value |
|--------|-------|
| GRT Price | $0.03 |
| Market Cap | $312.9M |
| Down from Highs | -82% |
| Query Fee Revenue (Q4) | $8.1M quarterly (~$32M annualized) |
| Token Inflation | ~$10.3M annually (3% of supply) |
| Daily Fees | $4.83 (!!) |
| Substreams Revenue | 6.08M GRT ($348K) - record high, only bright spot |

**Critical finding:** Daily query fees of $4.83 means query monetization is fundamentally broken. The protocol runs on inflation rewards, not real revenue.

### Who Still Uses It

**Confirmed active (legacy, not new adopters):**
- Uniswap (multiple subgraphs)
- Aave (10+ subgraphs)
- Compound (community subgraphs)
- 70%+ of major DeFi protocols

**Key context:** These protocols inherited The Graph from 2021-2023 when it was the only option. Switching costs keep them there, not satisfaction.

### Who Left

| Project | Left For | Reason |
|---------|----------|--------|
| Sablier | Envio | Speed, multi-chain consolidation |
| UNCX | Subsquid (SQD) | 1-week indexing lag on biggest chain |
| Ostium ($150M+/day) | Ormi | Undisclosed |
| Polymarket | Envio (testing) | Consolidating subgraphs |

### AssemblyScript Problem

The Graph requires AssemblyScript (WebAssembly), not TypeScript:
- No private class variable enforcement
- Strict type system breaks backwards compatibility
- Runtime errors instead of compile-time catches
- Steep learning curve for JavaScript developers
- Every competitor uses TypeScript specifically because of this pain point

### Reliability Issues (from GitHub)

- Subgraphs fail mid-sync with no logs
- PostgreSQL store unavailability causes 30-minute halts
- "Subgraph writer poisoned" errors requiring node restart
- graph-node v0.36.0: new subgraphs wouldn't start without restart
- Uniswap subgraph has had documented outages

### Hosted Service Sunset (Completed June 2024)

- Forced migration of all hosted subgraphs to decentralized network
- Created exit ramp for developers to evaluate alternatives
- Goldsky, Ponder, Envio all published migration guides
- Some developers left; most stayed due to switching costs

### Bottom Line

The Graph dominates by installed base (15,500 subgraphs), not by developer enthusiasm. GRT token down 82%, query monetization broken ($4.83/day in fees), indexer count shrinking 20%. AssemblyScript is a real pain point every competitor exploits. Still the default choice for projects that don't evaluate alternatives, but new projects increasingly skip it. Like Yahoo in 2005 - dominant, but not growing.

---

## 4. Goldsky

### Verified Production Customers

| Customer | Details | Verified |
|----------|---------|----------|
| **Polymarket** | 400+ events/sec, 99.9% uptime, $32M trading volume | Case study |
| **Phantom** | Multi-chain wallet | Named in marketing |
| **Coinbase** | Exchange | Named in marketing |
| **Kraken** | Exchange | Named in marketing |
| **Privy** | 120M+ wallets | Named in marketing |
| **POAP** | NFT attestation | Named in marketing |
| **Arweave** | Permanent storage | Named in marketing |
| **Hashflow** | DEX | Named in marketing |

**Only Polymarket has a detailed case study.** Others are "named in marketing" without specifics.

### Funding

- $20M seed (September 2022), led by Felicis Ventures + Dragonfly Capital
- Angel investors: Plaid founders, leaders from Uniswap Labs, 0x, Magic Eden, Compound
- No Series A found (2+ years post-seed)
- 30-person team (SF + Toronto)

### Product Architecture

Two distinct products:

**Subgraphs** (GraphQL API)
- Managed hosting for The Graph-compatible subgraphs
- Best for: <100 events/sec, straightforward queries
- Drop-in replacement from The Graph

**Mirror Pipelines** (Data Streaming)
- Streams blockchain data directly to your database
- 2,000 rows/sec default, 100,000+ rows/sec (XXL tier)
- Backfill: ~3 hours full Ethereum, <4 min with max scaling
- 40+ networks including Solana and Sui (non-EVM)
- Exports to Parquet, Iceberg, Kafka, S3, GCS (standard formats)

### Pricing

- **Not publicly disclosed** - enterprise quotes only
- Three tiers: Starter (self-serve), Scale (fixed), Enterprise (custom)
- Billing: monthly quoted, hourly metered
- Contact sales for actual numbers

### Reliability Concerns

**Documented incidents (from status.goldsky.com):**
- Database connectivity issues
- Subgraph indexing halts
- Mirror product lag from ingestion issues
- Hosted database downtime

**Notable:** Ostium ($150M+/day perp exchange) migrated FROM Goldsky to Ormi. Reason undisclosed.

**WarpStream case study** revealed tiered storage caused severe reliability issues - poor historical data reading locked up entire cluster.

### Data Portability (Positive)

- Exports to industry-standard formats (Parquet, Iceberg, Kafka, S3)
- NOT proprietary data formats
- If Goldsky dies, your data is extractable
- Pipeline logic (YAML transforms) would need rewriting

### Bottom Line

Best managed option. Polymarket at 400+ events/sec with 99.9% uptime is a real proof point. Enterprise customers (Coinbase, Kraken, Phantom) are serious names. But: no public pricing, no Series A after 2 years, Ostium migration away is a yellow flag, and you can't self-host. If you want managed and don't mind vendor dependency, this works. If you need transparency or self-hosting, look elsewhere.

---

## Head-to-Head: What Actually Matters for IRSB

### Speed (Historical Sync)

| Indexer | Uniswap V3 Sync | Relative |
|---------|-----------------|----------|
| Envio | 9.67 min | 80x faster |
| The Graph | ~1,000 min | 1.3x slower than Ponder |
| Ponder | 780 min | Baseline |
| Goldsky Mirror | ~3 hrs (full ETH) | Fast but different benchmark |

*Source: Envio's benchmark (not independently verified)*

### Confirmed Production Scale

| Indexer | Largest Known Deployment |
|---------|------------------------|
| **The Graph** | Uniswap, Aave (billions of queries) |
| **Goldsky** | Polymarket (400+ events/sec, 99.9% uptime) |
| **Envio** | Sablier (11 chains consolidated) |
| **Ponder** | Uniswap (specific sub-indexers, not main) |

### Survival Risk

| Indexer | Risk | Reasoning |
|---------|------|-----------|
| **The Graph** | LOW | Decentralized network, GRT token, $312M mcap |
| **Goldsky** | MEDIUM | $20M seed, no Series A, 30 people, enterprise revenue likely |
| **Envio** | MEDIUM-HIGH | $5M seed, no Series A, team size unknown |
| **Ponder** | MEDIUM | 3 people, no funding, but MIT = community can fork |

### IRSB-Specific Fit

| Factor | Best Choice | Why |
|--------|------------|-----|
| Sepolia testnet now | Envio (free tier) | Fastest to set up, free |
| Watchtower real-time | Envio or Goldsky | WebSocket/streaming |
| SDK/Dashboard queries | Any of the 4 | Standard GraphQL |
| Open-source parity | Ponder | MIT license matches IRSB |
| Multi-chain mainnet | Goldsky (40+) or Envio (70+) | Most chain coverage |
| Zero vendor risk | Ponder + self-host | Only truly independent option |
| Lowest effort | Goldsky | Fully managed, no DevOps |

---

## Data Gaps (Honest Disclosure)

Things I could NOT verify despite systematic research:

| Data Point | Status |
|------------|--------|
| Envio total hosted indexers | NOT DISCLOSED |
| Envio team size | NOT DISCLOSED |
| Goldsky pricing (actual numbers) | NOT DISCLOSED |
| Goldsky revenue | NOT DISCLOSED |
| Ponder total production deployments | Claimed "hundreds", UNVERIFIED |
| The Graph query fee per-query cost | Complex tokenomics, varies |
| Independent speed benchmarks | NONE EXIST (all vendor-published) |
| Envio NPM downloads | NOT AVAILABLE in search |
| Any indexer's actual uptime SLA | Only Goldsky publishes status page |

---

## Sources

### Envio
- [GitHub enviodev/hyperindex](https://github.com/enviodev/hyperindex) (480 stars, 37 forks)
- [Sablier Case Study](https://docs.envio.dev/blog/case-study-sablier)
- [Jarvis Network Case Study](https://docs.envio.dev/blog/envio-empowers-jarvis-network)
- [Velodrome Indexer (GitHub)](https://github.com/velodrome-finance/indexer)
- [Envio Benchmarks](https://docs.envio.dev/blog/indexer-benchmarking-results)
- [Crunchbase - Envio](https://www.crunchbase.com/organization/envio-71bf)

### Ponder
- [GitHub ponder-sh/ponder](https://github.com/ponder-sh/ponder) (~1000 stars)
- [Ponder Team Joins Monad Foundation](https://blog.monad.xyz/blog/ponder-team-joins)
- [npm-stat @ponder/core](https://npm-stat.com/charts.html?package=@ponder/core) (601/week)
- [Uniswap/cca-indexer](https://github.com/Uniswap/cca-indexer)
- [Frak + Ponder (Medium)](https://medium.com/frak-defi/building-cost-effective-blockchain-infrastructure-a-journey-with-erpc-and-ponder-e3866b0c76d7)

### The Graph
- [State of The Graph Q4 2025 (Messari)](https://messari.io/report/state-of-the-graph-q4-2025)
- [State of The Graph Q3 2025 (Messari)](https://messari.io/report/state-of-the-graph-q3-2025)
- [Hosted Service Sunset (Blog)](https://thegraph.com/blog/sunsetting-hosted-service/)
- [CoinGecko GRT](https://www.coingecko.com/en/coins/the-graph)
- [AssemblyScript Issues (Docs)](https://thegraph.com/docs/en/subgraphs/developing/creating/graph-ts/common-issues/)

### Goldsky
- [Polymarket Case Study](https://goldsky.com/case-studies/polymarket-goldsky)
- [Goldsky Pricing](https://goldsky.com/pricing)
- [Goldsky Docs](https://docs.goldsky.com/)
- [Goldsky Status Page](https://status.goldsky.com/)
- [Crunchbase - Goldsky](https://www.crunchbase.com/organization/goldsky)
- [WarpStream Case Study](https://www.warpstream.com/blog/the-road-to-100pibs-and-hundreds-of-thousands-of-partitions-goldsky-case-study)

### Comparative
- [Best Blockchain Indexers 2026 (Ormi Labs)](https://blog.ormilabs.com/best-blockchain-indexers-in-2025-real-time-web3-data-and-subgraph-platforms-compared/)
