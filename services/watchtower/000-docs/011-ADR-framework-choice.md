# ADR-001: Framework and Technology Choices

## Status

Accepted

## Context

The IRSB Watchtower needs to:
1. Monitor Ethereum chain state efficiently
2. Execute deterministic rules
3. Serve an HTTP API
4. Run in multiple environments (local, Cloud Run, Vertex Agent Engine)
5. Sign and submit transactions

We need to choose a tech stack that supports these requirements while remaining maintainable and portable.

## Decision

### Runtime: Node.js 20+

**Chosen**: Node.js 20 LTS

**Rationale**:
- Native async/await for I/O-heavy blockchain operations
- Excellent library ecosystem for Ethereum development
- First-class TypeScript support
- Compatible with all target deployment environments
- Team familiarity

**Alternatives considered**:
- Deno: Less mature ecosystem, fewer Ethereum libraries
- Bun: Not yet production-ready for enterprise
- Go: Would require separate tooling from main IRSB SDK

### Language: TypeScript (strict mode)

**Chosen**: TypeScript 5.4+ with strict mode

**Rationale**:
- Type safety reduces runtime errors
- Better tooling and IDE support
- Self-documenting code
- Matches IRSB SDK language

**Configuration**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

### Package Manager: pnpm

**Chosen**: pnpm with workspaces

**Rationale**:
- Faster than npm/yarn
- Strict dependency resolution
- Excellent monorepo support
- Disk space efficient

### HTTP Framework: Fastify

**Chosen**: Fastify 4.x

**Rationale**:
- High performance (benchmark leader)
- Built-in schema validation
- First-class TypeScript support
- Plugin architecture for extensibility
- Production-proven at scale

**Alternatives considered**:
- Express: Slower, less modern TypeScript support
- Hono: Newer, less battle-tested
- tRPC: Overkill for simple API

### Logging: pino

**Chosen**: pino with pino-pretty

**Rationale**:
- Fastest Node.js logger
- Structured JSON logging
- Integrates natively with Fastify
- Cloud Logging compatible

### Configuration Validation: Zod

**Chosen**: Zod 3.x

**Rationale**:
- TypeScript-first schema validation
- Runtime validation with type inference
- Clear error messages
- No code generation needed

**Alternatives considered**:
- io-ts: More complex API
- Yup: Less TypeScript-native
- Joi: Heavier, older design

### Ethereum Client: viem

**Chosen**: viem 2.x

**Rationale**:
- Modern TypeScript-first design
- Excellent type inference
- Modular and tree-shakeable
- Active development and community
- Better DX than ethers.js

**Alternatives considered**:
- ethers.js v6: More verbose, weaker TypeScript types
- web3.js: Dated, large bundle size

### Testing: Vitest

**Chosen**: Vitest 1.x

**Rationale**:
- Jest-compatible API
- Native ESM support
- Fast execution
- Built-in TypeScript support
- Watch mode with HMR

### Monorepo Structure: pnpm Workspaces

**Chosen**: pnpm workspaces with internal packages

**Structure**:
```
packages/
  core/       # Portable rule engine
  chain/      # Chain provider abstraction
  config/     # Configuration schemas
  signers/    # Signing implementations
  irsb-adapter/ # IRSB contract interactions
apps/
  api/        # HTTP API server
  worker/     # Background scanner
```

**Rationale**:
- Clear separation of concerns
- Each package is independently testable
- Enables future extraction if needed
- Explicit dependencies between packages

## Consequences

### Positive
- Consistent, type-safe codebase
- Fast development iteration
- Portable across deployment targets
- Strong ecosystem support
- Easy onboarding for TypeScript developers

### Negative
- Runtime performance slightly lower than Go/Rust
- More dependencies than minimal alternatives
- TypeScript compilation step required

### Neutral
- Team must maintain TypeScript expertise
- Version upgrades needed periodically
- Bundle size management for deployments

## Compliance

This decision aligns with:
- IRSB SDK language choice (TypeScript)
- Google Cloud runtime support (Node.js)
- Lit Protocol SDK language (TypeScript)
- Team skillset

## Review

This ADR should be reviewed:
- When Node.js LTS version changes
- When major framework versions release
- If performance requirements change significantly
- If deployment targets change
