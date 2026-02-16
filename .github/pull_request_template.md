## Summary

<!-- What changed and why? 1-3 sentences -->

## Type of Change

- [ ] `feat`: New feature (non-breaking change adding functionality)
- [ ] `fix`: Bug fix (non-breaking change fixing an issue)
- [ ] `docs`: Documentation only
- [ ] `test`: Adding/updating tests
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `chore`: Build process, dependency updates, tooling
- [ ] `BREAKING CHANGE`: Incompatible API change (requires version bump)

## Risk Assessment

<!-- What could break? Low/Medium/High -->

**Risk Level:** [ Low | Medium | High ]

**Potential Impact:**
<!-- List what could be affected -->

## How Tested

<!-- Exact commands and results -->

```bash
# Commands run:
forge test
forge test --match-path test/NewFeature.t.sol -vvv
```

**Test Results:**
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Fuzz tests pass at required run count (if applicable)

## Migration/Compatibility Notes

<!-- Required for any contract changes -->

- [ ] No breaking changes to existing public functions
- [ ] Existing events preserved
- [ ] New events are additive only
- [ ] Subgraph changes are backward compatible
- [ ] SDK types updated (if applicable)

## Checklist

### Code Quality
- [ ] Branch name matches convention: `feature/phX-slug`
- [ ] Commits are atomic with proper format (`feat:`, `fix:`, etc.)
- [ ] `forge fmt --check` passes
- [ ] No compiler warnings (or documented exceptions)

### Testing
- [ ] All 127+ existing tests pass: `forge test`
- [ ] New tests added for new functionality
- [ ] Coverage maintained or improved

### Security
- [ ] Slither shows no new high/critical findings
- [ ] No private data in events
- [ ] Access control reviewed
- [ ] Reentrancy safe (CEI pattern followed)

## Security Fixes (if applicable)

<!-- For PRs addressing security findings -->

**Findings Addressed:**
<!-- List IRSB-SEC-XXX IDs -->
- [ ] IRSB-SEC-XXX: [Description]

**Regression Tests Added:**
<!-- List test names proving the fix -->
- `test_XXX_reverts()`

**Verification:**
```bash
# Commands to verify fix
./scripts/security.sh
forge test --match-test "test_XXX"
```

### Documentation
- [ ] Code comments added where needed
- [ ] README/docs updated if behavior changed
- [ ] ADR updated if architectural decision made

### Gas & Performance
- [ ] Gas report attached (if contract changes)
- [ ] No unnecessary storage operations

## Gas Report (if applicable)

<!-- Paste relevant gas report output -->

```
| Contract | Function | Gas |
|----------|----------|-----|
| ... | ... | ... |
```

## Screenshots (if applicable)

<!-- Dashboard or UI changes -->

## Related Issues

<!-- Link to GitHub issues -->

Closes #
