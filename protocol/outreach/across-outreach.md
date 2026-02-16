# Across Protocol Partnership Outreach

## Context

Across Protocol is the leading cross-chain intent bridge with relayers providing near-instant fills. They've improved failure rates from 18% → 2.3%, but still lack:
- Cryptographic proof of execution
- Standardized reputation across bridges
- Automatic timeout enforcement

IRSB adds the accountability layer they need.

## Outreach Materials

---

### 1. Initial Email

**Target**: Across Protocol team
**Subject**: IRSB + Across: Cross-Chain Receipt Attestation

```
Hi Across Team,

I'm building IRSB — a standardized accountability layer for intent-based bridges.

Across relayers are the gold standard for cross-chain fills. You've achieved incredible reliability (2.3% failure rate), but there's still a gap: proving execution cryptographically across chains.

**What IRSB Adds**

1. **Cross-chain receipts** — Cryptographic proof of fill attestable on any chain
2. **Relayer reputation** — IntentScore works across bridges (not just Across)
3. **Automatic enforcement** — Timeout slashing without manual intervention

**Pilot Proposal**

- 5 relayers participate (opt-in)
- 8 weeks (Sepolia → Arbitrum/Optimism)
- No economic changes to your system
- We handle all infrastructure

**Success Metrics**
- Reduced user dispute rate
- Higher trust scores for participating relayers
- Data for cross-bridge reputation standard

Our contracts are live on Sepolia:
- SolverRegistry: 0xB6ab964832808E49635fF82D1996D6a888ecB745
- IntentReceiptHub: 0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c

Would you be open to a 20-minute call to explore integration?

Best,
Jeremy
jeremy@intentsolutions.io
github.com/intent-solutions-io/irsb-protocol
```

---

### 2. Technical Integration Brief

**Attach to**: Follow-up email or share in call

```
IRSB + Across Integration Overview

CURRENT ACROSS FLOW:
1. User deposits on source chain
2. Relayer fills on destination chain
3. Optimistic verification period
4. Settlement (if no dispute)

IRSB-ENHANCED FLOW:
1. User deposits on source chain
2. Relayer fills on destination chain
3. Relayer posts IRSB receipt (same tx or next block)
4. Receipt includes: intentHash, outcomeHash, attestation signature
5. Optimistic verification period (unchanged)
6. If dispute: IRSB provides cryptographic evidence
7. Settlement (faster resolution)

INTEGRATION POINTS:
- Relayer SDK: Add receipt posting after fill
- Hook: POST_FILL → postReceipt(intentHash, outcomeHash, sig)
- Gas overhead: ~50K gas per receipt
- Latency: 0 (can batch with fill tx)

BENEFITS:
- Disputes resolved with on-chain proof
- Relayer reputation portable to other protocols
- User confidence increases (provable fills)
```

---

### 3. Letter of Intent Template

```
LETTER OF INTENT - IRSB x Across Protocol Pilot

DATE: ___________
PARTIES: IRSB Protocol ("Provider") + Across Protocol ("Partner")

1. PILOT SCOPE
   - Duration: 8 weeks
   - Networks: Sepolia (week 1-2), Arbitrum/Optimism (week 3-8)
   - Relayers: 5 participating (opt-in)

2. PROVIDER RESPONSIBILITIES
   - Deploy IRSB contracts on pilot networks
   - Provide relayer SDK for receipt posting
   - Technical support during integration
   - Weekly metrics (receipts posted, disputes resolved)

3. PARTNER RESPONSIBILITIES
   - Identify pilot relayers
   - Share integration guidance (fill event hooks)
   - Surface reputation data in UI (optional)
   - Provide feedback on friction points

4. SUCCESS METRICS
   - Integration: <1 day per relayer
   - Receipt coverage: >95% of fills have receipts
   - Disputes: <24 hour resolution
   - False positives: 0

5. DATA SHARING
   - IRSB may publish aggregate statistics
   - Individual relayer data shared only with consent

6. NON-BINDING
   Except confidentiality clause.

SIGNATURES:
Provider: _______________    Partner: _______________
```

---

## Contact Information

| Contact | Role | Method |
|---------|------|--------|
| Hart Lambur | Founder | hart@across.to (verify) |
| Across Team | General | hello@across.to |
| Discord | Community | discord.gg/across |

## Tracking

| Date | Action | Contact | Response |
|------|--------|---------|----------|
| | Initial email | team | |
| | Discord intro | #relayers | |
| | Follow-up | | |
