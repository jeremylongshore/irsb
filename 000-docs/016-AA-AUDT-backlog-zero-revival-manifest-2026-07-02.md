# Backlog Zero — IRSB revival manifest (2026-07-02)

**Campaign:** Backlog Zero, Wave 0 (dormant-repo settle)
**Repo:** `jeremylongshore/irsb` (local `~/000-projects/irsb-monorepo`), dormant since 2026-03-06
**Beads DB:** prefix `irsb`, 18 open beads at start (9 top-level epics + 9 child tasks, all created 2026-02-16 in one planning burst for the Intentions Gateway program, `protocol/000-docs/040-AT-ARCH-intentions-gateway-architecture.md`)

**End-state:** open = 1 revival epic (`irsb-1ar`) + 4 `needs-human` beads. 14 beads deferred until **2026-10-01**. **0 closed** — every one of the scout's five "done-but-open drift" verdicts was refuted against disk/git (see § Refuted verdicts).

---

## 1. Revival epic

| Bead | Title | State |
|---|---|---|
| `irsb-1ar` | Revive or archive the IRSB protocol monorepo: settle the dormant backlog and decide the project's future | **open** (epic, P2, labels `backlog-zero,revival`) |

All nine former top-level epics were re-parented under `irsb-1ar` so the whole dormant cluster hangs off one decision point. Context signals captured in the epic: gateway program stopped after design phase; README pivoted to AI-agent-guardrails framing; dashboard rewritten for a founder/VC audience (`0a2180f`); CI crons disabled to stop burning Actions minutes (`721d069`).

## 2. Settled beads — full table

| Bead | Title | Disposition | Evidence / reason |
|---|---|---|---|
| `irsb-upx` | Epic: Canonical Intent Envelope + Gateway Scaffold (Phase 1) | deferred → 2026-10-01 | Children upx.2/3/4/6 all unstarted; only the spec (upx.1, already closed) exists. Scout close verdict refuted. |
| `irsb-upx.2` | Scaffold intentions-gateway repo | deferred → 2026-10-01 | `services/gateway/` does not exist; root `CLAUDE.md` says "Phase 1 (not yet created)". Scout close verdict refuted. |
| `irsb-upx.3` | Implement envelope canonicalization + hashing | deferred → 2026-10-01 | No `CanonicalIntentEnvelope`/`CIE_TYPEHASH` hits in any `*.ts`/`*.sol`; no property/fuzz tests. |
| `irsb-upx.4` | Implement envelope signing (KMS + EIP-712) | deferred → 2026-10-01 | `packages/kms-signer` has generic `signTypedData` only; zero intentId/decision binding; no roundtrip test. Scout close verdict refuted. |
| `irsb-upx.5` | Write ADR for Canonical Intent Envelope | deferred → 2026-10-01 | No ADR exists; `041-AT-SPEC` is closed bead upx.1's deliverable. Scout close verdict refuted. |
| `irsb-upx.6` | Phase 1 AAR | deferred → 2026-10-01 | Defined as after upx.2-4 (all unstarted); no AAR doc exists. |
| `irsb-1lw` | Epic: Cedar Policy Engine + Policy Admin (Phase 2) | deferred → 2026-10-01 | Zero Cedar code in the repo — no dependency, no PDP, no policy-admin service. |
| `irsb-1lw.1` | Design policy model (Cedar schema) | deferred → 2026-10-01 | No Cedar schema/policy-model files exist. |
| `irsb-1lw.2` | Implement Cedar PDP in gateway | deferred → 2026-10-01 | No gateway service exists to host a PDP. |
| `irsb-1lw.3` | Scaffold policy-admin service | deferred → 2026-10-01 | No `policy-admin` in `services/`. |
| `irsb-1lw.4` | On-chain enforcer sync | **open + `needs-human`** | Governance/security design decision (timelock + multisig topology). See § 4. |
| `irsb-hh9` | Epic: Web2 Execution Path (MCP + mTLS) (Phase 3) | deferred → 2026-10-01 | No MCP execution / DecisionRecord / ExecutionReceipt code in the tree. |
| `irsb-7kz` | Epic: Web3 Execution Path (Delegation Bridge) (Phase 4) | deferred → 2026-10-01 | Bridges the gateway envelope — no gateway or envelope code exists. Protocol-level EIP-7702 WalletDelegate predates and does not implement this scope. Scout close verdict refuted. |
| `irsb-3o1` | Epic: Audit Vault (Hash-Chain + Merkle Anchoring) (Phase 5) | deferred → 2026-10-01 | No audit-vault service, hash-chain store, or Merkle-anchoring code exists. |
| `irsb-m7k` | Epic: Security Hardening (Phase 8) | deferred → 2026-10-01 | Standard hardening, still valid on revival; inputs already exist (`044-AA-AUDT` security audit, `039-AA-AUDT` pre-mortem). |
| `irsb-bj9` | Epic: Observability + SLOs (Phase 7) | **open + `needs-human`** | Scoped for a never-built Cloud Run fleet; CI crons disabled. See § 4. |
| `irsb-dau` | Epic: Multi-Tenancy + Isolation (Phase 6) | **open + `needs-human`** | Presumes multi-tenant SaaS; pivot makes the target ambiguous. See § 4. |
| `irsb-rer` | Epic: Production + Insurance (Phase 9) | **open + `needs-human`** | Business commitment (mainnet, insurance outreach, EU AI Act), not an engineering task. See § 4. |

Every deferred bead carries the comment: *"Deferred 2026-07-02 under the IRSB revival program — still valid, project dormant; revisit on revival."* plus bead-specific evidence.

## 3. Refuted scout verdicts (5/5 of the proposed closes)

The 2026-07-02 scout classified 5 beads as "done-but-open drift." All five were refuted on skeptic pass:

1. **`irsb-upx.2` (gateway scaffold)** — the scout's key evidence, commit `f6e3f47` `fix(gateway): remove duplicate logger config causing container crash`, touches `src/server/gateway.ts` **in the imported `archive/agent-passkey` history** (the deprecated Lit Protocol service's Fastify server file happens to be named `gateway.ts`). No Intentions Gateway was ever scaffolded: `services/gateway/` is absent and root `CLAUDE.md` documents it as "planned / not yet created."
2. **`irsb-upx.4` (envelope signing)** — the scout's own condition ("verify intentId binding then close") fails: `packages/kms-signer/src/{signer,gcpKmsSigner,localPrivateKeySigner}.ts` implement generic EIP-712 `signTypedData`, with zero references to `intentId` or decision binding, and no envelope roundtrip test (the `040-AT-ARCH` acceptance).
3. **`irsb-upx.5` (envelope ADR)** — `041-AT-SPEC-canonical-intent-envelope.md` exists but is the SPEC deliverable of **already-closed** `irsb-upx.1` (its header credits that bead; upx.1's close reason cites it). The only ADR in `protocol/000-docs/` is `009-AA-ADR-irsb-vnext-scope.md` (unrelated). Closing upx.5 on the same artifact would double-count evidence for two separately-planned deliverables.
4. **`irsb-7kz` (Web3 delegation bridge)** — Phase 4 bridges the *gateway envelope* to `IntentReceipt`; with no gateway and no envelope code, the bridge cannot exist. On-chain EIP-7702 delegation (`WalletDelegate`, caveat enforcers) predates this plan and is out of this bead's scope.
5. **`irsb-upx` (Phase 1 epic)** — falls with its children: 4 of 5 remaining child tasks unstarted.

## 4. Needs-human digest (decision by **2026-07-16**)

| Bead | Question | Recommended default |
|---|---|---|
| `irsb-1lw.4` On-chain enforcer sync | Timelock/multisig topology for policy→WalletDelegate caveat propagation is a trust-assumption decision — does it survive the AI-agent-guardrails pivot, and who designs it? | Keep the `040-AT-ARCH` design; fold into revival Phase 2; don't implement before the Cedar PDP exists. |
| `irsb-bj9` Observability + SLOs | Epic was scoped for a Cloud Run gateway fleet that was never built, and CI crons were deliberately disabled — is a standing epic still the right shape? | Fold into the revival epic's planning pass; re-scope when the gateway is actually scaffolded. |
| `irsb-dau` Multi-Tenancy + Isolation | Does the founder/VC pivot keep multi-tenant SaaS as the target, or is single-tenant/protocol-first the play? | Park until the revival decision; multi-tenancy is premature before a single-tenant gateway exists. |
| `irsb-rer` Production + Insurance | Mainnet deployment + insurance-partnership outreach + EU AI Act mapping only make sense if IRSB is revived as a funded product — is that the plan? | Hold open under the revival epic as the final gate; no action until Phases 1–5 exist. |

If no decision lands by 2026-07-16, the default for all four is: defer until 2026-10-01 alongside the rest of the cluster.

## 5. In-flight residue (observed, deliberately left untouched)

- **Local `main` is behind `origin/main`** — remote has `abee31e` (`chore(test): install audit-harness v0.1.0 (P6 batch) (#2)`) which the local checkout never pulled.
- **Pre-staged index changes in the local checkout** (left alone per campaign instructions): `.beads/.gitignore`, `.beads/daemon-error`, `.beads/daemon.lock`, `.beads/daemon.log`, `.beads/dolt-monitor.pid.lock`, `.beads/issues.jsonl`, `.beads/metadata.json`, `.gitignore`, `AGENTS.md`.
- **Unstaged modified files** — in-flight protocol work: `protocol/.env.example`, `protocol/src/IntentReceiptHub.sol`, `protocol/src/interfaces/IIntentReceiptHub.sol`.
- **Untracked files** — `protocol/src/AgenticCommerce.sol` + `protocol/script/DeployACP.s.sol` (uncommitted ACP contract work), `000-docs/014-RL-RSRC-on-chain-work-coordination-landscape.md`, `000-docs/015-RL-RSRC-wasteland-federation-analysis.md`, `000-docs/6767-REF-ARCH-ecosystem-deep-dive.md`, `000-docs/6767-VIS-STRAT-on-chain-accountability-moat.md` (legacy `6767-*` names predate this manifest; none created by this campaign), `.beads/.beads-credential-key`, `.beads/export-state.json`.
- **Numbering collision:** untracked local `000-docs/014-RL-RSRC-...` collides with remote-tracked `000-docs/014-OD-SOPS-audit-harness-baseline-2026-05-01.md`. Resolve on revival (renumber the untracked doc before committing it).
- **Branches:** local `beads-sync`, local+remote `feat/install-audit-harness-baseline` (its PR #2 merged into `origin/main`; branch is stale), remote `security-audit-044`. **Open PRs at settle time: none.**

## 6. Method

Snapshot-first (`/tmp/claude-runner-irsb-snapshot.jsonl`), all reads via `jq` from the snapshot, `bd` used only for writes + verification, one write per command with `bd export -o .beads/issues.jsonl` flushed between writes (bd ≤1.0.4 rapid-write race), final states verified via both `bd list` and the exported JSONL. No bead was closed on dormancy grounds; no bead was retitled.
