import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { REPOS, STANDARDS, SYSTEM_STATUS } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Ecosystem',
  description: 'The IRSB ecosystem: 4 repositories (protocol, solver, watchtower, delegation) and standards integration with ERC-7683, ERC-8004, EIP-7702, and x402.',
  path: '/ecosystem',
})

export default function EcosystemPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Ecosystem"
        subtitle="Four repositories that work together to provide intent accountability."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          {/* Architecture Overview */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Architecture</h2>
            <div className="mt-6 bg-zinc-800/60 rounded-xl p-6 border border-zinc-700 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`ERC-8004 (Registry Layer)
  Agent identity & reputation
  |
  | read identity / publish signals
  v
IRSB Protocol (protocol/)
  Intent receipts, solver bonds, disputes, escrow
  WalletDelegate (EIP-7702) + 5 caveat enforcers
  X402Facilitator (direct + delegated settlement)
  |                              |
  v                              v
Solver (solver/)            Watchtower (watchtower/)
  Execute intents             Monitor receipts
  Submit receipts             File disputes
  Cloud KMS signing           Cloud KMS signing
  |                              |
  +-- on-chain policy via -------+
  |   WalletDelegate (EIP-7702)
  |
  [Legacy: agent-passkey on Cloud Run — deprecated]`}</div>
          </div>

          {/* Dependency Order */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Update Order</h2>
            <p className="mt-3 text-zinc-300">
              When contract interfaces change, update in this order:
            </p>
            <div className="mt-4 bg-zinc-800/60 rounded-lg p-4 border border-zinc-700 font-mono text-sm text-zinc-300">
              protocol (ABI/types + delegation contracts) → solver, watchtower (Cloud KMS direct)
            </div>
          </div>

          {/* Repository Details */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Repositories</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {REPOS.map((repo) => (
                <div key={repo.slug} className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-zinc-100">{repo.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      repo.status.includes('Deprecated')
                        ? SYSTEM_STATUS.agentPasskey.badgeClass
                        : repo.status.includes('infrastructure')
                          ? SYSTEM_STATUS.watchtower.badgeClass
                          : repo.status.includes('Deployed') || repo.status.includes('Live')
                            ? SYSTEM_STATUS.protocol.badgeClass
                            : 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {repo.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">{repo.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-500">{repo.techStack}</span>
                    <a
                      href={repo.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      GitHub &#8599;
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Standards Integration */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Standards Integration</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Standard</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">How IRSB Connects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  {STANDARDS.map((s) => (
                    <tr key={s.name}>
                      <td className="px-6 py-4 text-sm font-semibold text-zinc-200">{s.name}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{s.role}</td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{s.connection}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ERC-8004 Signal Table */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">ERC-8004 Signal Publishing</h2>
            <p className="mt-3 text-zinc-300">
              IRSB acts as a Validation Provider for ERC-8004. These events are designed to generate reputation signals:
            </p>
            <div className="mt-3 bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-600">
              <p className="text-sm text-zinc-400">
                <span className={`text-xs px-2 py-0.5 rounded ${SYSTEM_STATUS.erc8004Signals.badgeClass} mr-2`}>{SYSTEM_STATUS.erc8004Signals.label}</span>
                Agent registered (ID: 967). Signal publishing is not yet enabled in production.
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">IRSB Event</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">ERC-8004 Signal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  {[
                    { event: 'Receipt finalized (no dispute)', signal: 'validationResponse', value: '100' },
                    { event: 'Dispute opened against solver', signal: 'giveFeedback', value: '-10' },
                    { event: 'Dispute won by solver', signal: 'validationResponse', value: '90' },
                    { event: 'Dispute lost, minor slash', signal: 'validationResponse', value: '30' },
                    { event: 'Dispute lost, full slash', signal: 'validationResponse', value: '0' },
                    { event: 'Solver jailed', signal: 'giveFeedback', value: '-50' },
                  ].map((row) => (
                    <tr key={row.event}>
                      <td className="px-6 py-3 text-sm text-zinc-200">{row.event}</td>
                      <td className="px-6 py-3 text-sm font-mono text-zinc-400">{row.signal}</td>
                      <td className="px-6 py-3 text-sm font-mono text-zinc-300">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Common Patterns */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Shared Patterns Across Repos</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Pattern</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Implementation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  {[
                    { pattern: 'Config validation', impl: 'Zod schemas, fail-fast on startup' },
                    { pattern: 'Logging', impl: 'pino with structured JSON, correlation IDs (intentId, runId, receiptId)' },
                    { pattern: 'Signing', impl: 'Cloud KMS direct signing + EIP-7702 WalletDelegate on-chain policy. Agent-passkey deprecated.' },
                    { pattern: 'Determinism', impl: 'Canonical JSON serialization for hashing (sorted keys, no whitespace)' },
                    { pattern: 'CI/CD', impl: 'GitHub Actions + Workload Identity Federation (keyless GCP auth)' },
                    { pattern: 'Testing', impl: 'vitest for TypeScript, Foundry for Solidity' },
                  ].map((row) => (
                    <tr key={row.pattern}>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-200">{row.pattern}</td>
                      <td className="px-6 py-3 text-sm text-zinc-400">{row.impl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>
    </main>
  )
}
