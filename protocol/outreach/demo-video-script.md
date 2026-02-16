# IRSB Demo Video Script

## Overview

**Format**: 5-minute screen recording with voiceover
**Style**: Problem → Solution comparison
**Tool**: Figma prototype or live dashboard walkthrough

---

## Video Structure

### Opening (30 sec)

**Visual**: IRSB logo, tagline

**Voiceover**:
> "Every day, billions of dollars flow through intent-based systems.
> CoWSwap, 1inch Fusion, UniswapX, Across.
>
> But when something goes wrong, who's accountable?
>
> This is IRSB — the accountability layer for intent solvers."

---

### Act 1: The Problem Today (90 sec)

**Scene 1.1: User Intent Submission**

**Visual**: User submitting swap on CoWSwap UI
- 100 USDC → ETH
- Min output: 0.99 ETH
- Deadline: 5 minutes

**Voiceover**:
> "Alice submits an intent: 100 USDC for at least 0.99 ETH.
> A solver picks it up and executes."

---

**Scene 1.2: Violation Occurs**

**Visual**: Settlement showing 0.97 ETH received (below minOut)

**Voiceover**:
> "But when settlement completes, Alice only receives 0.97 ETH.
> That's below her minimum. Something went wrong."

---

**Scene 1.3: No Recourse**

**Visual**: User searching for help, forum posts, waiting

**Voiceover**:
> "What happens now?
>
> Today: Nothing automatic.
>
> Alice files a complaint. The protocol investigates.
> A DAO proposal is drafted. Discussion happens.
> Weeks later, a vote. Maybe compensation.
>
> In the Barter solver hack, this process took 3 weeks
> and $166,000 was lost before action was taken."

---

**Scene 1.4: Governance Bottleneck Stats**

**Visual**: Timeline showing CIP-22 process
- Day 1: Incident
- Day 5: Forum post
- Day 12: Proposal
- Day 21: Vote
- Day 25: Execution

**Voiceover**:
> "This isn't a bug. It's the system working as designed.
> Every dispute requires human governance.
> That doesn't scale."

---

### Act 2: IRSB Changes Everything (120 sec)

**Scene 2.1: Same Intent, Different Outcome**

**Visual**: Same swap UI, but with IRSB indicator

**Voiceover**:
> "Now let's see the same scenario with IRSB.
> Alice submits the same intent: 100 USDC for 0.99 ETH minimum."

---

**Scene 2.2: Solver Posts Receipt**

**Visual**: Blockchain transaction showing receipt posting
- Intent hash
- Constraints hash
- Outcome hash
- Solver signature

**Voiceover**:
> "The solver executes and posts a cryptographic receipt.
> This receipt proves exactly what was promised and delivered.
> It's signed by the solver — non-repudiable."

---

**Scene 2.3: Violation Detected**

**Visual**: Alert showing outcome < minOut

**Voiceover**:
> "Settlement shows 0.97 ETH — below minimum.
> Anyone can see this. The receipt is public."

---

**Scene 2.4: Automatic Challenge**

**Visual**: Challenge transaction being submitted

**Voiceover**:
> "Alice — or anyone — can challenge the receipt.
> They post a small bond (10% of potential slash).
> The challenge is submitted on-chain."

---

**Scene 2.5: Evidence Window**

**Visual**: Timer showing 24-hour evidence window

**Voiceover**:
> "The solver has 24 hours to provide evidence
> that execution was correct.
>
> If the violation is clear (outcome < minOut),
> there's nothing to dispute."

---

**Scene 2.6: Automatic Resolution**

**Visual**: Slashing transaction executing
- 80% → Alice (user refund)
- 15% → Challenger
- 5% → Protocol treasury

**Voiceover**:
> "No DAO vote. No weeks of discussion.
>
> The smart contract sees: outcome less than constraint.
> Slash executes automatically.
>
> Alice gets 80% of the slash as compensation.
> The challenger gets 15% for catching the violation.
> 5% goes to the protocol treasury."

---

**Scene 2.7: Timeline Comparison**

**Visual**: Side-by-side timelines
- Today: 3-4 weeks
- IRSB: <24 hours

**Voiceover**:
> "What took weeks now takes hours.
> No governance overhead. No human bottleneck.
> Deterministic, automatic, fair."

---

### Act 3: The Bigger Picture (60 sec)

**Scene 3.1: Reputation System**

**Visual**: Solver dashboard showing IntentScore rankings

**Voiceover**:
> "But IRSB isn't just about punishment.
> Every successful receipt builds solver reputation.
>
> IntentScore — calculated from fill rate, speed,
> volume, and dispute history.
>
> High scores mean user preference.
> Good solvers rise. Bad actors fall."

---

**Scene 3.2: Cross-Protocol Portability**

**Visual**: Diagram showing reputation flowing between protocols

**Voiceover**:
> "And reputation is portable.
> Build trust on CoWSwap, carry it to 1inch.
> Excel on Across, bring that history to UniswapX.
>
> One reputation layer for all intent systems."

---

**Scene 3.3: The Standard**

**Visual**: ERC-7683 logo, protocol logos

**Voiceover**:
> "IRSB works with ERC-7683 — the emerging standard
> for cross-chain intents.
>
> We're not replacing protocols. We're adding
> the accountability layer they all need."

---

### Closing (30 sec)

**Visual**: IRSB contracts on Sepolia, GitHub link, contact

**Voiceover**:
> "IRSB is live on Sepolia testnet.
>
> We're piloting with 5 solvers this quarter.
>
> If you're a solver, relayer, or protocol team:
> the accountability layer is here.
>
> github.com/intent-solutions-io/irsb-protocol
> jeremy@intentsolutions.io
>
> IRSB — The credit score layer for intent solvers."

---

## Production Notes

### Visuals Needed

1. **IRSB Logo** - Clean, professional
2. **Protocol UIs** - CoWSwap, 1inch (screenshot or recreate)
3. **Blockchain Transactions** - Etherscan-style views
4. **Timeline Graphics** - Side-by-side comparisons
5. **Dashboard** - Use live Solver Dashboard
6. **Diagrams** - Reputation portability flow

### Recording Options

**Option A: Figma Prototype**
- Create clickable prototype
- Record screen + voiceover
- Most polished look

**Option B: Live Dashboard + Etherscan**
- Record actual Sepolia transactions
- Show real dashboard
- More authentic but less controlled

**Option C: Animated Slides**
- Create in Keynote/Canva
- Add motion graphics
- Fastest to produce

### Recommended Tools

- **Screen Recording**: OBS, Loom, or QuickTime
- **Voiceover**: Audacity for editing
- **Prototype**: Figma
- **Animation**: Canva, After Effects, or Motion

### Distribution

- YouTube (unlisted initially)
- Embed in partnership emails
- Post in protocol Discords/Telegrams
- Landing page hero video

---

## Shot List

| # | Scene | Duration | Visual | Audio |
|---|-------|----------|--------|-------|
| 1 | Logo/tagline | 10s | IRSB branding | Music intro |
| 2 | Problem intro | 20s | Protocol logos | VO: "billions flow..." |
| 3 | Intent submission | 15s | Swap UI | VO: "Alice submits..." |
| 4 | Violation | 15s | Settlement result | VO: "0.97 ETH..." |
| 5 | No recourse | 25s | Help pages, forums | VO: "What happens now..." |
| 6 | Governance timeline | 20s | CIP-22 timeline | VO: "3 weeks..." |
| 7 | IRSB intro | 10s | Same UI + IRSB | VO: "Same scenario..." |
| 8 | Receipt posting | 20s | TX view | VO: "cryptographic receipt..." |
| 9 | Detection | 10s | Alert graphic | VO: "Settlement shows..." |
| 10 | Challenge | 15s | Challenge TX | VO: "Anyone can challenge..." |
| 11 | Evidence window | 10s | Timer | VO: "24 hours..." |
| 12 | Resolution | 20s | Slash TX | VO: "No DAO vote..." |
| 13 | Comparison | 15s | Side-by-side | VO: "weeks → hours..." |
| 14 | Reputation | 20s | Dashboard | VO: "IntentScore..." |
| 15 | Portability | 15s | Flow diagram | VO: "portable..." |
| 16 | Standard | 10s | ERC-7683 | VO: "works with..." |
| 17 | CTA | 30s | Contracts + links | VO: "Live on Sepolia..." |

**Total**: ~5 minutes
