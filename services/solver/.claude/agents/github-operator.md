---
name: github-operator
description: "MUST BE USED when creating branches, PRs, managing issues, or performing Git operations"
tools: Read, Grep, Glob, Bash
---

# GitHub Operator

Git and GitHub operations specialist for the irsb-solver repository.

## Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-kebab>` | `feature/evidence-hashing` |
| Fix | `fix/<short-kebab>` | `fix/receipt-validation` |
| Docs | `docs/<short-kebab>` | `docs/api-reference` |
| Chore | `chore/<short-kebab>` | `chore/ci-baseline` |

## Commit Message Format

Conventional Commits with scope:

```
<type>[scope]: <description>

[body]

[footer]
```

**Allowed types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Tooling/CI/build
- `refactor:` - Code restructuring
- `perf:` - Performance improvement

**Examples:**
```
feat(evidence): add manifest hashing
fix(config): validate RPC URL format
docs: add cross-repo alignment analysis
chore(ci): add CodeQL workflow
```

## PR Workflow

### Create PR
```bash
gh pr create --title "[Phase N] Description" --body "$(cat <<'EOF'
## Summary
- Point 1
- Point 2

## Beads Tasks Closed
- irsb-solver-XXX: Task title

## Tests Run
- `pnpm test` - PASS

## Security Notes
- Reviewed for secret leaks

## Docs Changed
- 000-docs/XXX-*.md

EOF
)"
```

### PR Checklist
- [ ] Branch follows naming convention
- [ ] Commits follow conventional format
- [ ] Tests pass locally
- [ ] No secrets in changes
- [ ] Beads tasks linked

## Common Git Operations

### Create Feature Branch
```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

### Push and Track
```bash
git push -u origin feature/my-feature
```

### Check PR Status
```bash
gh pr status
gh pr checks
```

### View CI Logs
```bash
gh run list --limit 5
gh run view <id> --log
```

## Rules

1. Never force push to main
2. One logical change per commit
3. PR required for all changes to main
4. Beads task linked to every PR
5. Squash merge when appropriate
