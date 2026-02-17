# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-16

### Added

- **Monorepo Migration**: Unified 6 repositories (protocol, solver, watchtower, agents, agent-passkey, docs) into single monorepo
- **Shared Packages**: Extract `@irsb/kms-signer` and `@irsb/types` for cross-project reuse
- **Unified CI/CD**: 4 path-filtered GitHub Actions workflows (ci-protocol, ci-typescript, ci-agents, codeql)
- **Root Configuration**: Unified ESLint (v9 flat config), Prettier, TypeScript base config
- **Beads Task Tracking**: Initialize beads for session context recovery

### Changed

- **Package Scope**: All packages now use `@irsb/*` naming convention
- **TypeScript**: All projects extend root `tsconfig.base.json` (ES2022, bundler resolution, strict mode)
- **Documentation**: Update all CLAUDE.md files for monorepo structure

### Fixed

- **TypeScript Strict Mode**: Resolve `exactOptionalPropertyTypes` and other strict flag issues across protocol SDK and x402-irsb
- **Test Runner**: Fix vitest configuration (passWithNoTests, watch mode, timeout issues)
- **esbuild Resolution**: Add `shamefully-hoist=true` to resolve platform binary corruption in pnpm workspace
- **Stale Lockfiles**: Remove npm/pnpm lockfiles imported via git subtree

### Removed

- **Stale .github/ Directories**: Remove redundant workflows, templates, CODEOWNERS from subtree imports
- **Gateway References**: Remove premature `services/gateway` workspace entry

### Security

- **Secrets Scan**: No secrets detected in codebase
- **License**: MIT license verified across all packages

---

## Pre-Monorepo Component Versions

The following versions were current at time of monorepo migration:

| Component | Version | Tests |
|-----------|---------|-------|
| protocol | v1.4.0 | 552 (Foundry) |
| solver | v0.3.0 | 139 (vitest) |
| watchtower | v0.5.0 | ~500 (vitest) |
| agents | v0.2.0 | 42 (pytest) |
| agent-passkey | v1.0.1 | deprecated |

Tags preserved from original repos: `protocol-v1.0.0` through `protocol-v1.4.0`, `solver-v0.1.0` through `solver-v0.3.0`, `agents-v0.1.0` through `agents-v0.2.0`, `passkey-v1.0.0` through `passkey-v1.0.1`.
