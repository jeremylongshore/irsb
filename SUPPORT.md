# Getting Help

## Where to Ask

| Type | Where |
|------|-------|
| Questions | [GitHub Discussions](https://github.com/intent-solutions-io/irsb-protocol/discussions) |
| Bug reports | [GitHub Issues](https://github.com/intent-solutions-io/irsb-protocol/issues/new?template=bug_report.yml) |
| Feature requests | [GitHub Issues](https://github.com/intent-solutions-io/irsb-protocol/issues/new?template=feature_request.yml) |
| Security issues | [SECURITY.md](./SECURITY.md) (private disclosure) |

## Documentation

- **Architecture:** [000-docs/](./000-docs/)
- **API/Contracts:** NatSpec in source files
- **SDK:** [sdk/README.md](./sdk/README.md)
- **Subgraph:** [subgraph/README.md](./subgraph/README.md)
- **Dashboard:** [dashboard/README.md](./dashboard/README.md)

## Running Locally

```bash
# Contracts
forge build
forge test

# SDK
cd sdk && pnpm install && pnpm test

# Dashboard
cd dashboard && pnpm install && pnpm dev

# Subgraph (local Graph node required)
cd subgraph && graph codegen && graph build
```

## Deployments

| Network | Status |
|---------|--------|
| Sepolia | Live ([addresses](./deployments/sepolia.json)) |
| Mainnet | Not yet deployed |

## Response Times

- **Discussions:** Best effort, typically within a few days
- **Bug reports:** Triaged within 1 week
- **Security issues:** Acknowledged within 48 hours

## Code of Conduct

All interactions are governed by our [Code of Conduct](./CODE_OF_CONDUCT.md).
