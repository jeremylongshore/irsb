# IRSB Protocol - Security Audit Package

Documentation prepared for security auditors.

## Contents

| Document | Description |
|----------|-------------|
| [SCOPE.md](./SCOPE.md) | Audit scope, contracts, architecture |
| [THREAT-MODEL.md](./THREAT-MODEL.md) | Attack vectors, mitigations, trust assumptions |
| [INVARIANTS.md](./INVARIANTS.md) | Formal invariants that must hold |

## Quick Start for Auditors

```bash
# Clone repository
git clone https://github.com/intent-solutions-io/irsb-protocol
cd irsb-protocol

# Install Foundry (if needed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Build
forge build

# Run all tests
forge test

# Run with verbose output
forge test -vvv

# Gas report
forge test --gas-report
```

## Contracts in Scope

| Contract | SLOC | File |
|----------|------|------|
| SolverRegistry | ~350 | `src/SolverRegistry.sol` |
| IntentReceiptHub | ~300 | `src/IntentReceiptHub.sol` |
| DisputeModule | ~250 | `src/DisputeModule.sol` |

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| SolverRegistry | `0xB6ab964832808E49635fF82D1996D6a888ecB745` |
| IntentReceiptHub | `0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c` |
| DisputeModule | `0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D` |

## Test Results

```
╭----------------------+--------+--------+---------╮
| Test Suite           | Passed | Failed | Skipped |
+==================================================+
| DisputeModuleTest    | 21     | 0      | 0       |
| IntentReceiptHubTest | 38     | 0      | 0       |
| SolverRegistryTest   | 36     | 0      | 0       |
╰----------------------+--------+--------+---------╯

Total: 95 tests passing
```

## Key Areas of Focus

1. **Reentrancy** - ETH transfers in withdrawal/slashing
2. **Access Control** - Authorization for privileged functions
3. **Signature Verification** - Receipt signature validation
4. **Integer Overflow** - Bond calculations
5. **State Machine** - Receipt/dispute status transitions

## Contact

- **Protocol Lead**: jeremy@intentsolutions.io
- **GitHub Issues**: github.com/intent-solutions-io/irsb-protocol/issues

## Timeline

Audit requested for Q1 2026 mainnet deployment.
