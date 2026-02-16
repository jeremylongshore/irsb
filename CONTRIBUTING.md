# Contributing to IRSB Protocol

Thank you for your interest in contributing to IRSB Protocol.

## Quick Start

```bash
# Clone and install
git clone https://github.com/intent-solutions-io/irsb-protocol.git
cd irsb-protocol
forge install

# Build
forge build

# Run tests
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test test_RegisterSolver
```

## Development Setup

**Requirements:**
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+ (for SDK/dashboard)
- Git

**Environment:**
```bash
cp .env.example .env
# Fill in RPC URLs and keys for deployment
```

## Code Standards

### Solidity
- Run `forge fmt` before committing
- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use NatSpec comments for public functions
- No compiler warnings

### Testing
- All new features require tests
- Maintain or improve coverage
- Fuzz tests for numeric edge cases
- Invariant tests for critical properties

```bash
# Format check
forge fmt --check

# Full test suite
forge test

# Security checks
./scripts/security.sh
```

## Branch & PR Workflow

1. **Branch from master**
   ```bash
   git checkout master
   git pull origin master
   git checkout -b feature/your-feature-name
   ```

2. **Make atomic commits**
   - Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
   - Keep commits focused and reviewable

3. **Open a PR**
   - Fill out the PR template completely
   - Ensure CI passes (tests + Slither)
   - Request review from CODEOWNERS

4. **Review process**
   - One approval required
   - Address feedback promptly
   - Squash merge to master

## What We Accept

- Bug fixes with regression tests
- New features with tests and documentation
- Documentation improvements
- Test coverage improvements
- Gas optimizations (with benchmarks)

## What Requires Discussion First

Open an issue before starting work on:
- New contract functionality
- Breaking changes to interfaces
- Architectural changes
- New dependencies

## Security Issues

**Do NOT open public issues for security vulnerabilities.**

See [SECURITY.md](./SECURITY.md) for responsible disclosure process.

## Questions?

- **General questions:** [GitHub Discussions](https://github.com/intent-solutions-io/irsb-protocol/discussions)
- **Bug reports:** [GitHub Issues](https://github.com/intent-solutions-io/irsb-protocol/issues/new?template=bug_report.yml)
- **Feature ideas:** [GitHub Issues](https://github.com/intent-solutions-io/irsb-protocol/issues/new?template=feature_request.yml)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
