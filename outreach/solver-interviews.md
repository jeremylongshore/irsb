# IRSB Solver Interview Campaign

## Objective

Validate pain points directly from solvers. Get 5-10 interviews with top intent solvers to understand:
- Current accountability challenges
- Dispute handling costs
- Interest in standardized reputation

## Interview Template (30 minutes)

### Opening (2 min)

```
"Thanks for taking the time. I'm building IRSB — an accountability layer
for intent solvers. I want to understand your challenges before assuming
our solution fits.

This is discovery, not a sales call. Your honest feedback shapes the product.

Mind if I record for notes? I won't share without permission."
```

### Section 1: Current State (10 min)

**Execution Proof**
1. "How do you prove intent execution to users today?"
   - Follow-up: "Is that process manual or automated?"
   - Follow-up: "What happens when proof isn't convincing?"

2. "What percentage of your fills have some form of verifiable record?"
   - Follow-up: "Where does that record live?"

**Dispute Handling**
3. "When a user disputes a fill, what's your process?"
   - Follow-up: "How long does resolution typically take?"
   - Follow-up: "Who handles disputes — you or the protocol?"

4. "What's the most frustrating dispute you've dealt with?"
   - Listen for: time cost, reputation damage, edge cases

### Section 2: Economic Pain (8 min)

**Costs**
5. "Roughly, what does proving execution cost you per month?"
   - Include: time, tools, support, infrastructure

6. "How much time weekly do you spend on post-execution issues?"
   - Follow-up: "Is that trending up or down?"

**Risk**
7. "What's your biggest reputational risk in your operation?"
   - Follow-up: "Has that risk ever materialized?"

8. "Have you ever lost business because of trust issues?"
   - Listen for: user churn, protocol exclusion, volume loss

### Section 3: Solution Validation (8 min)

**Receipts**
9. "If you could post cryptographic proof of every fill, would that change your operations?"
   - Follow-up: "What would that proof need to contain?"

**Reputation**
10. "Your reputation is currently locked to [CoWSwap/1inch/etc]. If it were portable to other protocols, would that matter?"
    - Follow-up: "Would you pay for reputation portability?"

**Standardization**
11. "What would cause you to adopt a standardized receipt format?"
    - Listen for: protocol requirements, competitive pressure, user demand

### Section 4: Partnership Interest (5 min)

**Pilot**
12. "We're running an 8-week pilot on Sepolia. Would you consider participating?"
    - If yes: "What would the pilot need to prove to be worth your time?"
    - If no: "What would change your mind?"

13. "If we could reduce your dispute handling time by 80%, what's that worth to you?"

**Closing**
14. "Is there anything I should have asked but didn't?"

15. "Who else should I talk to?"

### Wrap-up (2 min)

```
"This was incredibly helpful. A few next steps:

1. I'll send you a summary of what I heard
2. If you're interested in the pilot, I'll send details
3. Any questions for me?"
```

---

## Target Interviewees

### CoWSwap Solvers
| Solver | Volume Rank | Status | Contact |
|--------|-------------|--------|---------|
| Beaver Builder | #1 | Target | Via Telegram |
| PMM Solver | #2 | Target | Via Telegram |
| CowDAO Solver | #3 | Target | governance@cow.fi |
| Flashbots Relay | #4 | Target | Via Discord |
| MEV Blocker | #5 | Target | Via Discord |

### Across Relayers
| Relayer | Volume Rank | Status | Contact |
|---------|-------------|--------|---------|
| Risk Labs | #1 | Target | hello@across.to |
| Top relayer 2 | #2 | Research | On-chain |
| Top relayer 3 | #3 | Research | On-chain |

### 1inch Resolvers
| Resolver | Volume Rank | Status | Contact |
|----------|-------------|--------|---------|
| Top resolver 1 | #1 | Research | Via Discord |
| Top resolver 2 | #2 | Research | Via Discord |

---

## Outreach Messages

### Initial Outreach (Telegram/Discord)

```
Hi [Name],

I'm researching intent solver pain points for a project I'm building.

You're a top [CoWSwap/1inch/Across] solver by volume. Would you have
30 minutes this week for a discovery call?

Not a sales pitch — I want to understand your challenges before
assuming my solution fits.

I can share findings from other solver interviews as a thank-you.

— Jeremy
```

### Email Version

**Subject**: Research call — Intent solver accountability challenges

```
Hi [Name],

I'm building an accountability layer for intent solvers and researching
pain points before launch.

You're a top [protocol] solver. Would you have 30 minutes for a
discovery call? I'm specifically interested in:

- How you prove execution today
- Your dispute handling process
- Costs of maintaining trust

Not selling anything — this is research. I'll share findings as thanks.

Available [Tuesday/Thursday] this week?

Best,
Jeremy
jeremy@intentsolutions.io
```

### Follow-up (3 days)

```
Hi [Name],

Following up on my research request. Would 30 minutes work this week?

I'm talking to 10 solvers across CoWSwap, Across, and 1inch. Happy to
share aggregate findings from those conversations.

— Jeremy
```

---

## Interview Summary Template

After each interview, document:

```markdown
## Interview: [Solver Name]
**Date**: YYYY-MM-DD
**Protocol**: [CoWSwap/Across/1inch]
**Duration**: XX min

### Key Quotes
- "[Quote about biggest pain point]"
- "[Quote about dispute handling]"
- "[Quote about reputation]"

### Pain Points Identified
1. [Pain point 1]
2. [Pain point 2]
3. [Pain point 3]

### Interest Level
- Pilot interest: [High/Medium/Low/None]
- Follow-up requested: [Yes/No]
- Referrals given: [Names]

### Insights for IRSB
- [What this tells us about product/market fit]
- [Feature requests or requirements mentioned]

### Next Steps
- [ ] Send summary email
- [ ] Schedule follow-up (if interested)
- [ ] Add to pilot list (if committed)
```

---

## Tracking

| Date | Solver | Protocol | Contacted | Scheduled | Completed | Pilot Interest |
|------|--------|----------|-----------|-----------|-----------|----------------|
| | | | | | | |
| | | | | | | |
| | | | | | | |

### Metrics

- **Target**: 10 interviews
- **Goal**: 3 pilot commitments
- **Timeline**: 2 weeks

---

## Finding Solvers On-Chain

### CoWSwap (Ethereum Mainnet)
```sql
-- Dune query for top CoWSwap solvers
SELECT
  solver,
  COUNT(*) as trades,
  SUM(trade_value_usd) as volume_usd,
  AVG(surplus_usd) as avg_surplus
FROM cow_protocol_ethereum.trades
WHERE block_time > NOW() - INTERVAL '30 days'
GROUP BY solver
ORDER BY volume_usd DESC
LIMIT 20
```

### Across Protocol
```sql
-- Find top relayers by fill count
SELECT
  relayer,
  COUNT(*) as fills,
  SUM(amount_usd) as volume_usd
FROM across_protocol.fills
WHERE block_time > NOW() - INTERVAL '30 days'
GROUP BY relayer
ORDER BY fills DESC
LIMIT 20
```

### 1inch Fusion
```sql
-- Top resolvers by volume
SELECT
  resolver,
  COUNT(*) as orders,
  SUM(amount_usd) as volume_usd
FROM oneinch_fusion.orders
WHERE block_time > NOW() - INTERVAL '30 days'
GROUP BY resolver
ORDER BY volume_usd DESC
LIMIT 20
```

---

## Resources

- [CoWSwap Solver Telegram](https://t.me/cowswap) - #solvers channel
- [Across Discord](https://discord.gg/across) - #relayers channel
- [1inch Discord](https://discord.gg/1inch) - #resolvers channel
- [Dune Analytics](https://dune.com/) - On-chain queries
