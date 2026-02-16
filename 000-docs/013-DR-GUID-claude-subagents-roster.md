# Claude Code Subagents Roster

**Document ID:** 013-DR-GUID-claude-subagents-roster
**Status:** Active
**Created:** 2026-02-05
**Timezone:** America/Chicago

---

## Overview

This document catalogs the project-local Claude Code subagents available in `.claude/agents/`. These agents are specialized for specific tasks within the irsb-solver codebase.

## Subagent Roster

| Agent | Purpose | Tools | When to Use |
|-------|---------|-------|-------------|
| `repo-librarian` | Fast codebase scanning | Read, Grep, Glob, Bash | Finding files, understanding structure |
| `security-auditor` | Vulnerability analysis | Read, Grep, Glob, Bash | Security reviews, secret leak checks |
| `protocol-researcher` | Cross-repo spec correlation | Read, Grep, Glob, Bash | Protocol alignment, schema verification |
| `ts-architect` | TypeScript architecture | Read, Grep, Glob, Bash, Edit, Write | Module design, structural decisions |
| `test-engineer` | Test writing and debugging | Read, Grep, Glob, Bash, Edit, Write | Test creation, fixture setup |
| `ci-engineer` | CI/CD management | Read, Grep, Glob, Bash, Edit, Write | Workflow updates, CI debugging |
| `github-operator` | Git/GitHub operations | Read, Grep, Glob, Bash | Branch/PR management, commits |
| `determinism-guardian` | Non-determinism audit | Read, Grep, Glob, Bash | Hash logic review, reproducibility |

## Detailed Agent Profiles

### repo-librarian

**Location:** `.claude/agents/repo-librarian.md`

Fast codebase navigator. Use for:
- Locating files by name or pattern
- Finding function/class definitions
- Tracing imports and exports
- Understanding project structure

**Example prompt:** "Find all files that import from the evidence module"

### security-auditor

**Location:** `.claude/agents/security-auditor.md`

Security specialist. Use for:
- Reviewing code for vulnerabilities
- Checking for hardcoded secrets
- Auditing input validation
- Dependency risk assessment

**Example prompt:** "Audit src/config.ts for secret handling issues"

### protocol-researcher

**Location:** `.claude/agents/protocol-researcher.md`

Cross-repo correlation expert. Use for:
- Comparing schemas across irsb-protocol, irsb-watchtower, irsb-solver
- Verifying ID computation matches
- Researching ERC-7683/ERC-8004/x402 specs
- Finding naming convention mismatches

**Example prompt:** "Verify our IntentReceipt struct matches irsb-protocol's Types.sol"

### ts-architect

**Location:** `.claude/agents/ts-architect.md`

Architecture designer. Use for:
- Designing new modules
- Creating interfaces
- Making structural decisions
- Code organization

**Example prompt:** "Design the evidence storage interface for local and remote stores"

### test-engineer

**Location:** `.claude/agents/test-engineer.md`

Testing specialist. Use for:
- Writing vitest tests
- Setting up test fixtures
- Debugging test failures
- Coverage analysis

**Example prompt:** "Write tests for the evidence manifest hashing function"

### ci-engineer

**Location:** `.claude/agents/ci-engineer.md`

CI/CD manager. Use for:
- Modifying GitHub Actions workflows
- Debugging CI failures
- Adding new CI checks
- Optimizing pipeline performance

**Example prompt:** "Add a new workflow step for type coverage reporting"

### github-operator

**Location:** `.claude/agents/github-operator.md`

Git operations handler. Use for:
- Creating branches following conventions
- Writing conventional commits
- Creating PRs with proper format
- Managing issues

**Example prompt:** "Create a PR for the current changes following our template"

### determinism-guardian

**Location:** `.claude/agents/determinism-guardian.md`

Reproducibility auditor. Use for:
- Finding random value usage
- Auditing hashing logic
- Checking for wall-clock dependencies
- Ensuring canonical encoding

**Example prompt:** "Audit src/evidence/ for non-deterministic behavior"

## Usage Guidelines

### Automatic Invocation

Agents are designed to be invoked automatically when their trigger patterns match:
- Security questions → `security-auditor`
- Protocol comparison → `protocol-researcher`
- Test writing → `test-engineer`
- CI issues → `ci-engineer`

### Manual Invocation

Use the Task tool with the agent name:
```
Use the repo-librarian agent to find all TypeScript files in src/
```

### Model Inheritance

All agents inherit the model from the parent context. No explicit model is specified.

---

## Revision History

| Date | Change |
|------|--------|
| 2026-02-05 | Initial roster with 8 agents |

---

*End of Document*
