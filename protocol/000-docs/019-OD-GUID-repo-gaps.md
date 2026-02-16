# Repository Gaps & Future Improvements

This document tracks remaining work to achieve "perfect repo" status.

## Completed

- [x] LICENSE (MIT)
- [x] README.md
- [x] CONTRIBUTING.md
- [x] SECURITY.md
- [x] CODE_OF_CONDUCT.md
- [x] SUPPORT.md
- [x] GOVERNANCE.md
- [x] CHANGELOG.md
- [x] CODEOWNERS
- [x] PR template
- [x] Issue templates (bug, feature, question, security)
- [x] CI workflow (tests + Slither)
- [x] v1.0.0 tag

## Pending (Manual Actions)

### High Priority

| Item | Action | Owner |
|------|--------|-------|
| Enable Discussions | Settings → Features → Discussions | Maintainer |
| Create Discussion categories | See 018-OD-GUID-discussions-setup.md | Maintainer |
| Pin welcome discussion | Create after enabling | Maintainer |

### Medium Priority

| Item | Action | Notes |
|------|--------|-------|
| Branch protection | Settings → Branches → Add rule | Require PR reviews, CI pass |
| Dependabot | Add `.github/dependabot.yml` | For npm dependencies |
| Signed commits | Document policy | Optional enforcement |

### Low Priority

| Item | Action | Notes |
|------|--------|-------|
| GitHub Actions hardening | Pin action versions to SHAs | Security best practice |
| Code scanning | Enable CodeQL | If Advanced Security available |
| Docs site | Deploy to GitHub Pages | Architecture diagrams, guides |
| Release automation | GitHub Actions release workflow | Auto-changelog on tag |

## Dependabot Configuration

When ready, add `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/sdk"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/dashboard"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    directory: "/subgraph"
    schedule:
      interval: "weekly"
```

## Branch Protection Rules

Recommended settings for `master`:

- [x] Require pull request before merging
- [x] Require 1 approval
- [x] Require status checks (CI workflow)
- [x] Require branches to be up to date
- [ ] Require signed commits (optional)
- [x] Do not allow bypassing settings

## Release Process (Recommended)

1. Update CHANGELOG.md with release notes
2. Bump version in relevant files
3. Create PR: `chore(release): prepare vX.Y.Z`
4. After merge, create GitHub Release with tag
5. Publish SDK to npm (if applicable)

## Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Test count | 300+ | 325 |
| Test pass rate | 100% | 100% |
| Slither high/critical | 0 | 0 |
| Open issues (bugs) | < 10 | TBD |
| PR merge time | < 1 week | TBD |

---

## V2 Roadmap Items

### Arbitrator Decentralization

**Current State (v1)**: Single trusted arbitrator address set by governance.

**V2 Target**: Decentralized arbitration via integration with established protocols:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **Kleros** | Decentralized court with juror staking | Battle-tested, large juror pool | Integration complexity, fees |
| **UMA** | Optimistic oracle with DVM fallback | Fast resolution, low cost | Requires UMA token holders |
| **Reality.eth** | Bond escalation game | Simple, no external token | Can be slow, bond requirements |

**Implementation Plan**:
1. Define `IArbitrator` interface (already exists)
2. Create adapter contracts for each protocol
3. Allow governance to set arbitrator address to adapter
4. Maintain single-arbitrator fallback for edge cases

**Timeline**: Q2 2026

### Incident Response Automation

**Current State**: Manual incident response per `011-OD-GUID-incident-playbook.md`.

**Future Enhancements**:

| Feature | Description | Priority |
|---------|-------------|----------|
| **Automated pause triggers** | Circuit breakers for unusual slashing volume | High |
| **Monitoring alerts** | PagerDuty/Opsgenie integration for critical events | High |
| **Auto-recovery** | Governance-approved auto-resume after cooldown | Medium |
| **Incident dashboard** | Real-time protocol health visualization | Medium |
| **Post-mortem automation** | Auto-generate incident reports from on-chain data | Low |

**Key Metrics for Automation**:
```
- Slashing rate > 5% in 1 hour → Alert
- Slashing rate > 20% in 1 hour → Auto-pause consideration
- Gas price spike > 500 gwei → Delay non-critical operations
- Solver registration spike > 100/day → Review for sybil attack
```

**Timeline**: Q3 2026
