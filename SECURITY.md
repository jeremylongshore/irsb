# Security Policy

## Scope

### In Scope
- Off-chain solver code in this repository
- Evidence generation and hashing logic
- Receipt generation logic
- Configuration and secret handling
- Dependencies with known vulnerabilities

### Out of Scope
- On-chain contracts (see `irsb-protocol` repo)
- Third-party services and APIs
- Social engineering attacks
- Denial of service without security impact

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability:

1. **Email:** Send details to the maintainers directly (see CODEOWNERS or repo settings)
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

| Action | Target |
|--------|--------|
| Initial response | 48 hours |
| Severity assessment | 72 hours |
| Fix timeline provided | 7 days |
| Public disclosure | After fix is released |

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x (current) | Yes |

## Bug Bounty

**No bug bounty program is currently active.**

This is a reference implementation in early development. We appreciate responsible disclosure and will credit reporters in release notes (with permission).

## Security Practices

This project follows these security practices:

- **No secrets in code** — all credentials via environment variables
- **Dependency scanning** — CodeQL analysis on every PR
- **Evidence integrity** — SHA-256 hashes for all artifacts
- **Fail-fast validation** — strict config validation on startup
- **Audit logging** — structured logs with correlation IDs

## Coordinated Disclosure

We follow coordinated disclosure:
1. Reporter contacts maintainers privately
2. We assess and develop a fix
3. Fix is released
4. Public disclosure with credit (if desired)

Thank you for helping keep IRSB Solver secure.
