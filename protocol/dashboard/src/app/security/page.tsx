import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { PROTOCOL_PARAMS, SLASHING_STANDARD } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Security Model',
  description: 'IRSB security: solver bonds, slashing mechanics, dispute resolution, three-level identity assurance, and Cloud KMS + EIP-7702 delegation.',
  path: '/security',
})

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Security Model"
        subtitle="How IRSB enforces accountability through economic bonds, deterministic slashing, and Cloud KMS + EIP-7702 delegation."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          {/* Bond Mechanics */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Solver Bonds</h2>
            <p className="mt-3 text-zinc-300">
              Every solver must stake a minimum bond of {PROTOCOL_PARAMS.minimumBond} in the SolverRegistry before they can accept intents.
              The bond serves as collateral that can be slashed if the solver violates protocol rules.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-800/60 rounded-lg p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100">Deposit</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Solvers call <code className="text-zinc-300 bg-zinc-900 px-1 rounded">depositBond(solverId)</code> with ETH.
                  The bond can be topped up at any time.
                </p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100">Withdrawal</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {PROTOCOL_PARAMS.withdrawalCooldown} cooldown period after requesting withdrawal.
                  Prevents rage-quitting after a bad fill.
                </p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100">Slashing</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {SLASHING_STANDARD.user}% to user, {SLASHING_STANDARD.challenger}% to challenger, {SLASHING_STANDARD.treasury}% to treasury.
                  {PROTOCOL_PARAMS.maxJails} jailings = permanent ban.
                </p>
              </div>
            </div>
          </div>

          {/* Dispute Resolution */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Dispute Resolution</h2>
            <p className="mt-3 text-zinc-300">
              Two resolution paths handle different types of violations.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-3">Deterministic Resolution</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  For objectively verifiable violations: receipt timeout expired, wrong amount delivered, invalid signature.
                </p>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li>1. Challenger opens dispute during {PROTOCOL_PARAMS.challengeWindow} challenge window</li>
                  <li>2. On-chain data confirms the violation</li>
                  <li>3. <code className="text-zinc-300 bg-zinc-900 px-1 rounded">resolveDeterministic()</code> auto-slashes the solver</li>
                  <li>4. No human judgment needed</li>
                </ul>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-3">Optimistic Resolution (V2)</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  For complex or subjective disputes that require evidence review.
                </p>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li>1. Challenger opens dispute with evidence and bond</li>
                  <li>2. Solver has {PROTOCOL_PARAMS.counterBondWindow} to post counter-bond</li>
                  <li>3. No counter-bond = challenger wins by default</li>
                  <li>4. Counter-bond posted = escalate to arbitrator</li>
                  <li>5. Arbitrator has {PROTOCOL_PARAMS.arbitrationTimeout} to rule</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Identity Model */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Three-Level Identity Assurance</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Level</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">What It Proves</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  <tr>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-200">L1</td>
                    <td className="px-6 py-4 text-sm text-zinc-200">Transport Identity</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Verified caller (JWT / workload identity)</td>
                    <td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300">Live</span></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-200">L2</td>
                    <td className="px-6 py-4 text-sm text-zinc-200">Action Authorization</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Only allowed IRSB state transitions</td>
                    <td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded bg-green-900/50 text-green-300">Live</span></td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-200">L3</td>
                    <td className="px-6 py-4 text-sm text-zinc-200">Instance Attestation</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Agent runs in approved environment (TEE)</td>
                    <td className="px-6 py-4"><span className="text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-300">Planned</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Typed Actions */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Typed Actions (No Arbitrary Signing)</h2>
            <p className="mt-3 text-zinc-300">
              Cloud KMS + WalletDelegate restrict signing to these typed actions only. The AllowedMethodsEnforcer rejects any selector not on the allowlist:
            </p>
            <div className="mt-4 bg-zinc-800/60 rounded-lg p-4 border border-zinc-700 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`SUBMIT_RECEIPT      { intentId, receiptHash, evidenceHash }
OPEN_DISPUTE        { receiptId, evidenceHash, reasonCode }
SUBMIT_EVIDENCE     { disputeId, evidenceHash }
REDEEM_DELEGATION   { delegation, permissionContext, executionCalldata }
SET_DELEGATION      { delegations[] }`}</div>
            <p className="mt-4 text-sm text-zinc-400">
              There is no &quot;sign this arbitrary digest&quot; API. Cloud KMS keys never leave HSM hardware. On-chain, the WalletDelegate enforces caveats before any delegated call executes.
            </p>
          </div>

          {/* Key Management */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Key Management (Cloud KMS + EIP-7702)</h2>
            <p className="mt-3 text-zinc-300">
              Signing uses Google Cloud KMS with on-chain policy enforcement via EIP-7702 WalletDelegate. Private keys never leave HSM hardware. Five caveat enforcers restrict all delegated transactions.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-800/60 rounded-lg p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100">Cloud KMS</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  HSM-backed keys. Non-extractable. Sub-100ms signing latency. Solver and watchtower sign directly via KMS.
                </p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100">WalletDelegate</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  EIP-7702 on-chain policy via 5 caveat enforcers: SpendLimit, TimeWindow, AllowedTargets, AllowedMethods, Nonce. All enforced before execution.
                </p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100">Legacy (Deprecated)</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Agent-passkey (Lit Protocol PKP, 2/3 threshold) still running on Cloud Run. Not recommended for new integrations.
                </p>
              </div>
            </div>
          </div>

          {/* Audit Status */}
          <div className="bg-amber-900/20 rounded-xl p-6 border border-amber-700/50">
            <h2 className="text-xl font-bold text-amber-200">Audit Status</h2>
            <p className="mt-3 text-amber-100/80">
              IRSB is experimental software deployed on Sepolia testnet. It has 308 passing tests including fuzz tests (10,000 runs per fuzz test), but has not yet undergone a formal third-party security audit. A security audit is planned before mainnet deployment. Do not use with mainnet funds.
            </p>
          </div>

        </div>
      </section>
    </main>
  )
}
