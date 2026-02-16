import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { PROTOCOL_PARAMS, SLASHING_STANDARD, SLASHING_ARBITRATION, INTENT_SCORE_WEIGHTS, CONTRACTS, EXPLORER_BASE } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Architecture',
  description: 'IRSB contract architecture, protocol parameters, receipt structures, IntentScore algorithm, and slashing distribution.',
  path: '/technical',
})

export default function TechnicalPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Contract Architecture"
        subtitle="Three core contracts, two extensions, and the parameters that govern them."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          {/* Architecture Diagram */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">System Architecture</h2>
            <div className="mt-6 bg-zinc-800/60 rounded-xl p-6 border border-zinc-700 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`SolverRegistry <----> IntentReceiptHub <----> DisputeModule
|                    |                       |
| - Registration     | - Post receipts       | - Evidence
| - Bond staking     | - V2 extension        | - Escalation
| - Slashing         | - Disputes            | - Arbitration
| - Reputation       | - Finalization        |
|                    |                       |
+--------------------+
                     |
              EscrowVault             OptimisticDisputeModule
              | - ETH + ERC20        | - Counter-bond window
              | - Release/Refund     | - Timeout resolution
              | - Receipt-linked     | - Escalation to arb

              ReceiptV2Extension
              | - Dual attestation (EIP-712)
              | - Privacy commitments
              | - Escrow link`}</div>
          </div>

          {/* Contracts */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Deployed Contracts (Sepolia)</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Contract</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">SolverRegistry</td>
                    <td className="px-6 py-4">
                      <a href={`${EXPLORER_BASE}/address/${CONTRACTS.solverRegistry}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-zinc-400 hover:text-zinc-200">
                        {CONTRACTS.solverRegistry} &#8599;
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Solver lifecycle, bonding, slashing, reputation</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">IntentReceiptHub</td>
                    <td className="px-6 py-4">
                      <a href={`${EXPLORER_BASE}/address/${CONTRACTS.intentReceiptHub}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-zinc-400 hover:text-zinc-200">
                        {CONTRACTS.intentReceiptHub} &#8599;
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Receipt posting, disputes, finalization</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">DisputeModule</td>
                    <td className="px-6 py-4">
                      <a href={`${EXPLORER_BASE}/address/${CONTRACTS.disputeModule}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-zinc-400 hover:text-zinc-200">
                        {CONTRACTS.disputeModule} &#8599;
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Arbitration for complex disputes</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Protocol Parameters */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Protocol Parameters</h2>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(PROTOCOL_PARAMS).map(([key, value]) => (
                <div key={key} className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-zinc-100">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Receipt Structures */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Receipt Structures</h2>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-4">V1 Receipt (Single Attestation)</h3>
                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`struct IntentReceipt {
  bytes32 intentHash;
  bytes32 constraintsHash;
  bytes32 routeHash;
  bytes32 outcomeHash;
  bytes32 evidenceHash;
  uint64  createdAt;
  uint64  expiry;
  bytes32 solverId;
  bytes   solverSig;
}`}</div>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-4">V2 Receipt (Dual Attestation + Privacy)</h3>
                <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`struct IntentReceiptV2 {
  // ... V1 fields ...
  bytes32      metadataCommitment;
  string       ciphertextPointer;
  PrivacyLevel privacyLevel;
  bytes32      escrowId;
  bytes        clientSig;  // EIP-712
}

enum PrivacyLevel {
  PUBLIC,
  SEMI_PUBLIC,
  PRIVATE
}`}</div>
              </div>
            </div>
          </div>

          {/* Slashing Distribution */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Slashing Distribution</h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-4">Standard Slashing</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">User (affected party)</span>
                    <span className="text-lg font-bold text-zinc-100">{SLASHING_STANDARD.user}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div className="bg-zinc-300 h-2 rounded-full" style={{ width: `${SLASHING_STANDARD.user}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Challenger</span>
                    <span className="text-lg font-bold text-zinc-100">{SLASHING_STANDARD.challenger}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Treasury</span>
                    <span className="text-lg font-bold text-zinc-100">{SLASHING_STANDARD.treasury}%</span>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-4">Arbitration Slashing</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">User (affected party)</span>
                    <span className="text-lg font-bold text-zinc-100">{SLASHING_ARBITRATION.user}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div className="bg-zinc-300 h-2 rounded-full" style={{ width: `${SLASHING_ARBITRATION.user}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Treasury</span>
                    <span className="text-lg font-bold text-zinc-100">{SLASHING_ARBITRATION.treasury}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Arbitrator</span>
                    <span className="text-lg font-bold text-zinc-100">{SLASHING_ARBITRATION.arbitrator}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* IntentScore */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">IntentScore Algorithm</h2>
            <p className="mt-3 text-zinc-300">
              On-chain composite score (0&ndash;10,000 basis points) computed from execution history.
              Minimum 10 tasks for a reliable score; new solvers start at 5,000 (50%).
            </p>
            <div className="mt-4 bg-zinc-800/60 rounded-lg p-4 border border-zinc-700 font-mono text-sm text-zinc-300">
              Score = (40% x SuccessRate) + (25% x DisputeWinRate) + (20% x StakeFactor) + (15% x Longevity) - SlashPenalty
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Component</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Weight</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Calculation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  {Object.values(INTENT_SCORE_WEIGHTS).map((component) => (
                    <tr key={component.label}>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-200">{component.label}</td>
                      <td className="px-6 py-3 text-sm text-zinc-300">{component.weight > 0 ? `${component.weight}%` : `${component.weight}% each`}</td>
                      <td className="px-6 py-3 text-sm text-zinc-400 font-mono">{component.calc}</td>
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
