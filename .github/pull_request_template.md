## Summary

<!-- What changed and why? 1-3 sentences -->

## Type of Change

- [ ] `feat`: New feature (non-breaking change adding functionality)
- [ ] `fix`: Bug fix (non-breaking change fixing an issue)
- [ ] `docs`: Documentation only
- [ ] `test`: Adding/updating tests
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `chore`: Build process, dependency updates, tooling
- [ ] `BREAKING CHANGE`: Incompatible API change

## Projects Affected

<!-- Check all that apply -->

- [ ] `protocol/` (Solidity contracts)
- [ ] `protocol/sdk/` or `protocol/packages/`
- [ ] `services/solver/`
- [ ] `services/watchtower/`
- [ ] `services/agents/`
- [ ] `packages/` (shared packages)
- [ ] CI/CD / tooling

## Risk Assessment

**Risk Level:** [ Low | Medium | High ]

**Potential Impact:**
<!-- List what could be affected -->

## How Tested

```bash
# Commands run:
pnpm -r build
pnpm -r test
```

**Test Results:**
- [ ] All existing tests pass
- [ ] New tests added for new functionality

## Beads Tasks

<!-- List beads task IDs closed by this PR -->
- [ ] `irsb-xxx` - Task title

## Security Notes

<!-- What security considerations were checked? -->

## Checklist

- [ ] Commits follow conventional format (`feat:`, `fix:`, etc.)
- [ ] CI passes (build + test + lint)
- [ ] Documentation updated if behavior changed
- [ ] No secrets committed

## Related Issues

Closes #
