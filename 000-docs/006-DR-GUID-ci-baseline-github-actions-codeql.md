# CI Baseline: GitHub Actions + CodeQL

**Document ID:** 006-DR-GUID-ci-baseline-github-actions-codeql
**Created:** 2026-02-04
**Timezone:** America/Chicago

---

## Overview

This document describes the CI/CD baseline for the irsb-solver repository.

---

## Workflows

### 1. CI Gate (`.github/workflows/ci.yml`)

**Triggers:** Push to `main`, Pull requests to `main`

**Steps:**
1. Checkout code
2. Setup Node.js 20
3. Setup pnpm 9 with cache
4. Install dependencies (`pnpm install --frozen-lockfile`)
5. Lint (`pnpm lint`)
6. Test (`pnpm test`)
7. Build (`pnpm build`)
8. Security audit (`pnpm audit --audit-level=high`)

### 2. CodeQL Analysis (`.github/workflows/codeql.yml`)

**Triggers:** Push to `main`, Pull requests to `main`, Weekly schedule (Monday 6am UTC)

**Languages:** JavaScript/TypeScript

**Steps:**
1. Checkout code
2. Initialize CodeQL
3. Setup Node.js 20 + pnpm
4. Install dependencies
5. Build project
6. Perform CodeQL analysis

---

## Local Development Commands

```bash
# Install dependencies
pnpm install

# Run linter
pnpm lint

# Run tests
pnpm test

# Build project
pnpm build

# Check for vulnerabilities (informational)
pnpm audit
```

---

## Security Policy

### Dependabot: Intentionally Disabled

Dependabot is **not enabled** for this repository to avoid notification spam. Security is handled via:
- CodeQL analysis (weekly + on PRs)
- Manual `pnpm audit` checks in CI
- Periodic manual dependency review

### Vulnerability Response

1. CodeQL alerts appear in GitHub Security tab
2. High/critical vulnerabilities should be addressed promptly
3. Run `pnpm audit` locally to check current status

---

## Workflow Files

- [CI Gate](./../.github/workflows/ci.yml)
- [CodeQL Analysis](./../.github/workflows/codeql.yml)

---

*End of Document*
