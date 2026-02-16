# Governance

## Current Model

IRSB Protocol is currently **maintainer-led** (single maintainer model).

**Maintainer:** @jeremy

## Decision Making

### Day-to-Day Decisions
- Maintainer makes routine decisions (merging PRs, triaging issues)
- No formal process required

### Significant Changes
For breaking changes, new features, or architectural decisions:
1. Open a GitHub Issue for discussion
2. Allow community input (minimum 1 week for major changes)
3. Maintainer makes final decision
4. Document rationale in ADR if applicable

### What Requires Discussion
- Breaking changes to contract interfaces
- New contract deployments
- Security-sensitive changes
- Tokenomics or economic parameter changes

## Release Authority

- Only the maintainer can create releases
- All releases require passing CI (tests + security checks)
- Contract deployments require manual verification

## Contributions

All contributions welcome via PR. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Maintainer commits to:
- Reviewing PRs within 1 week
- Providing constructive feedback
- Crediting contributors

## Future Governance

As the project matures, governance may evolve to include:
- Multiple maintainers / working groups
- Community voting on major decisions
- DAO-based governance (if tokenized)

Changes to governance will be proposed via GitHub Issues and documented here.

## Contact

- GitHub: [@jeremy](https://github.com/jeremy)
- Email: jeremy@intentsolutions.io
