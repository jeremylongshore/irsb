# GitHub Repository Operations Guide

**Document ID:** 010-DR-GUID-github-repo-operations
**Created:** 2026-02-04
**Timezone:** America/Chicago

---

## Overview

This document describes how the irsb-solver GitHub repository is configured and managed.

---

## Repository Settings

### Enabled Features

| Feature | Status | Reason |
|---------|--------|--------|
| Issues | Enabled | Bug reports, feature requests |
| Discussions | Enabled | Q&A, announcements, ideas |
| Wiki | Disabled | Docs live in `000-docs/` |
| Projects | Disabled | Using Beads for task tracking |

### Merge Strategy

| Strategy | Status |
|----------|--------|
| Squash merge | Enabled (preferred) |
| Rebase merge | Enabled |
| Merge commits | Disabled |

### Security Features

| Feature | Status |
|---------|--------|
| Code scanning (CodeQL) | Enabled |
| Secret scanning | Enabled (GitHub default) |
| Push protection | Enabled |
| Dependabot | **Disabled** (intentional) |

---

## Why Dependabot is Disabled

Dependabot is intentionally not enabled to avoid:
- Email notification spam
- Noisy PR backlog
- False urgency on low-risk updates

**Alternative security measures:**
- CodeQL analysis on every PR
- `pnpm audit` in CI (high/critical only)
- Periodic manual dependency review
- Security advisories monitoring

---

## Repository Metadata

### Description
> Reference off-chain solver/executor for the IRSB accountability protocol. Deterministic evidence + receipts for intent-based workflows.

### Topics
- blockchain
- ethereum
- evm
- web3
- protocol
- accountability
- intent-based
- receipts
- auditability
- verifiable-computation

---

## Managing Settings via CLI

### Update Description
```bash
gh repo edit intent-solutions-io/irsb-solver \
  --description "Reference off-chain solver/executor for the IRSB accountability protocol."
```

### Add Topics
```bash
gh repo edit intent-solutions-io/irsb-solver \
  --add-topic blockchain \
  --add-topic ethereum \
  --add-topic web3
```

### Enable Features
```bash
gh repo edit intent-solutions-io/irsb-solver \
  --enable-discussions \
  --enable-issues \
  --enable-squash-merge \
  --disable-merge-commit
```

---

## Branch Protection (Future)

When ready for production:

```bash
gh api repos/intent-solutions-io/irsb-solver/branches/main/protection \
  -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["build"]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":1}'
```

---

## Workflows

| Workflow | File | Triggers |
|----------|------|----------|
| CI Gate | `.github/workflows/ci.yml` | PR, push to main |
| CodeQL | `.github/workflows/codeql.yml` | PR, push to main, weekly |

---

## Templates

| Template | Location |
|----------|----------|
| PR Template | `.github/pull_request_template.md` |
| Bug Report | `.github/ISSUE_TEMPLATE/bug_report.yml` |
| Feature Request | `.github/ISSUE_TEMPLATE/feature_request.yml` |
| Security Report | `.github/ISSUE_TEMPLATE/security_report.yml` |
| Config | `.github/ISSUE_TEMPLATE/config.yml` |

---

## CODEOWNERS

File: `.github/CODEOWNERS`

```
* @jeremylongshore
000-docs/* @jeremylongshore
```

---

## Secret Management (Future)

When secrets are needed:
1. Store in GitHub repository secrets
2. Reference via `${{ secrets.SECRET_NAME }}` in workflows
3. Never log secrets
4. Rotate periodically

---

*End of Document*
