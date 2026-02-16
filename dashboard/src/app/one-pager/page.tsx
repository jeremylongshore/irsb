import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { PROTOCOL_PARAMS, SLASHING_STANDARD, CONTRACTS, EXPLORER_BASE, REPOS } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'One-Pager',
  description: 'IRSB Protocol executive summary: receipts, bonds, and disputes for intent-based transactions. Deployed on Sepolia, open source.',
  path: '/one-pager',
})

export default function OnePagerPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="IRSB Protocol — Executive Summary"
        subtitle="One page. Everything you need to know."
      />

      <section className="py-12 lg:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Problem */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">The Problem</h2>
            <p className="mt-3 text-zinc-300">
              ERC-7683 standardizes cross-chain intent formats, but doesn&apos;t address what happens after a solver accepts an intent. There is no standardized proof of execution, no economic consequence for bad fills, and no portable reputation for solvers. Users delegate execution and hope for the best.
            </p>
          </div>

          {/* Solution */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">What IRSB Does</h2>
            <p className="mt-3 text-zinc-300">
              IRSB (Intent Receipts & Solver Bonds) adds four primitives to intent execution:
            </p>
            <ul className="mt-3 space-y-2 text-zinc-300">
              <li className="flex gap-2">
                <span className="text-zinc-500 shrink-0">1.</span>
                <span><span className="font-medium text-zinc-100">Receipts</span> — On-chain cryptographic proof that a solver executed an intent. V1 (single signature) and V2 (dual attestation with EIP-712).</span>
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-500 shrink-0">2.</span>
                <span><span className="font-medium text-zinc-100">Bonds</span> — Solvers stake collateral (min {PROTOCOL_PARAMS.minimumBond}). Slashable for violations.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-500 shrink-0">3.</span>
                <span><span className="font-medium text-zinc-100">Disputes</span> — {PROTOCOL_PARAMS.challengeWindow} challenge window. Deterministic auto-slash for timeouts. Optimistic resolution with counter-bonds for complex cases.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-zinc-500 shrink-0">4.</span>
                <span><span className="font-medium text-zinc-100">Reputation</span> — IntentScore: on-chain composite metric derived from execution history. Portable via ERC-8004.</span>
              </li>
            </ul>
          </div>

          {/* Key Numbers */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Key Parameters</h2>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(PROTOCOL_PARAMS).map(([key, value]) => (
                <div key={key} className="bg-zinc-800/60 rounded-lg p-3 border border-zinc-700">
                  <p className="text-xs text-zinc-500 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-100">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Slashing */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Slashing Distribution</h2>
            <p className="mt-3 text-zinc-300">
              When a solver&apos;s bond is slashed: {SLASHING_STANDARD.user}% to the affected user, {SLASHING_STANDARD.challenger}% to the challenger, {SLASHING_STANDARD.treasury}% to the protocol treasury.
              After {PROTOCOL_PARAMS.maxJails} jailings, the solver is permanently banned.
            </p>
          </div>

          {/* Standards */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Standards Compatibility</h2>
            <ul className="mt-3 space-y-1 text-zinc-300 text-sm">
              <li><span className="font-medium text-zinc-100">ERC-7683</span> — Receipts reference intentHash from cross-chain orders</li>
              <li><span className="font-medium text-zinc-100">ERC-8004</span> — IRSB is a Validation Provider, publishing signals to the agent reputation registry</li>
              <li><span className="font-medium text-zinc-100">x402</span> — irsb-x402 package bridges HTTP 402 payments to on-chain receipts</li>
            </ul>
          </div>

          {/* Current State */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Current State</h2>
            <ul className="mt-3 space-y-1 text-zinc-300 text-sm">
              <li>Deployed on Sepolia testnet — 3 core contracts verified on Etherscan</li>
              <li>308 passing tests including fuzz tests</li>
              <li>4 open-source repositories (MIT license)</li>
              <li>TypeScript SDK + CLI tools (npm: irsb, irsb-x402)</li>
              <li>Cloud KMS + EIP-7702 delegation live — WalletDelegate with 5 caveat enforcers. Agent-passkey deprecated.</li>
              <li>ERC-8004 agent registered (ID: 967) — signal publishing not yet enabled</li>
              <li>Solver v0.1.0 (chain-connected, Cloud KMS signing, receipt submission). Watchtower v0.3.0 (chain-connected, real on-chain data, dispute filing)</li>
            </ul>
          </div>

          {/* Contracts */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Deployed Contracts (Sepolia)</h2>
            <div className="mt-3 space-y-2">
              {[
                { name: 'SolverRegistry', address: CONTRACTS.solverRegistry },
                { name: 'IntentReceiptHub', address: CONTRACTS.intentReceiptHub },
                { name: 'DisputeModule', address: CONTRACTS.disputeModule },
              ].map((c) => (
                <div key={c.name} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-4 py-2 border border-zinc-700">
                  <span className="text-sm font-medium text-zinc-200">{c.name}</span>
                  <a
                    href={`${EXPLORER_BASE}/address/${c.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    {c.address.slice(0, 6)}...{c.address.slice(-4)} &#8599;
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Outlook */}
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Outlook</h2>
            <p className="mt-3 text-zinc-300">
              Next steps: security audit, mainnet deployment, and first protocol integration. The goal is to establish IRSB as an open standard — an ERC/EIP proposal for intent accountability that any protocol can adopt. Multi-chain deployment (Arbitrum, Base, Polygon) follows mainnet.
            </p>
          </div>

          {/* CTA */}
          <div className="pt-6 border-t border-zinc-700 flex flex-col sm:flex-row gap-4">
            <Link
              href="/get-started"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg text-zinc-900 bg-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/technical"
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-lg text-zinc-300 border border-zinc-600 hover:bg-zinc-800 transition-colors"
            >
              Technical Details
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
