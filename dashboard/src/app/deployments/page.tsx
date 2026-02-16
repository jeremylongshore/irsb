import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import CodeBlock from '@/components/CodeBlock'
import { CONTRACTS, OPERATIONAL_ACCOUNTS, EXPLORER_BASE, SYSTEM_STATUS } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Deployments',
  description: 'IRSB live contract addresses on Sepolia testnet, operational accounts, and verification steps.',
  path: '/deployments',
})

function ExplorerLink({ address, label }: { address: string; label?: string }) {
  return (
    <a
      href={`${EXPLORER_BASE}/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-sm text-zinc-300 hover:text-zinc-100 break-all"
    >
      {label || address} <span className="text-zinc-500">&#8599;</span>
    </a>
  )
}

export default function DeploymentsPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Live Deployments"
        subtitle="All IRSB contracts are deployed on Sepolia testnet and verified on Etherscan."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          {/* Core Contracts */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Core Contracts (Sepolia)</h2>
            <p className="mt-3 text-zinc-300">
              Chain ID: 11155111. All contracts are verified source on Etherscan.
            </p>
            <div className="mt-6 space-y-4">
              {[
                { name: 'SolverRegistry', address: CONTRACTS.solverRegistry, purpose: 'Solver lifecycle, bonding, slashing, reputation' },
                { name: 'IntentReceiptHub', address: CONTRACTS.intentReceiptHub, purpose: 'Receipt posting, disputes, finalization' },
                { name: 'DisputeModule', address: CONTRACTS.disputeModule, purpose: 'Arbitration for complex disputes' },
                { name: 'ERC-8004 IdentityRegistry', address: CONTRACTS.erc8004Registry, purpose: 'Agent identity registration (IRSB Agent ID: 967)' },
              ].map((c) => (
                <div key={c.name} className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-zinc-100">{c.name}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{c.purpose}</p>
                    </div>
                    <ExplorerLink address={c.address} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Accounts */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Operational Accounts</h2>
            <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400 uppercase">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">Deployer / Operator</td>
                    <td className="px-6 py-4"><ExplorerLink address={OPERATIONAL_ACCOUNTS.deployer} /></td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Signs receipts, pays gas</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">Solver ID</td>
                    <td className="px-6 py-4 font-mono text-sm text-zinc-300 break-all">{OPERATIONAL_ACCOUNTS.solverId}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Registered solver identifier</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">Safe (Contract Owner)</td>
                    <td className="px-6 py-4"><ExplorerLink address={OPERATIONAL_ACCOUNTS.safeOwner} /></td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Owns all contracts (2/3 multisig)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">ERC-8004 Agent ID</td>
                    <td className="px-6 py-4 font-mono text-sm text-zinc-300">{OPERATIONAL_ACCOUNTS.erc8004AgentId}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">Agent identity NFT on IdentityRegistry</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Services */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Services</h2>
            <div className="mt-6 space-y-4">
              <div className="bg-zinc-800/60 rounded-xl p-5 border border-green-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-zinc-100">Cloud KMS + EIP-7702 Delegation</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Primary signing — HSM-backed keys + on-chain WalletDelegate policy</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${SYSTEM_STATUS.delegation.badgeClass} w-fit`}>{SYSTEM_STATUS.delegation.label}</span>
                </div>
                <p className="mt-3 font-mono text-sm text-zinc-400 break-all">
                  Cloud KMS signing (&lt;100ms). WalletDelegate with 5 caveat enforcers: SpendLimit, TimeWindow, AllowedTargets, AllowedMethods, Nonce.
                </p>
              </div>

              <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700 opacity-75">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-zinc-100">Agent Passkey <span className="text-xs text-amber-400">(Deprecated)</span></h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Legacy signing via Lit Protocol PKP — replaced by Cloud KMS + EIP-7702</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${SYSTEM_STATUS.agentPasskey.badgeClass} w-fit`}>{SYSTEM_STATUS.agentPasskey.label}</span>
                </div>
                <p className="mt-3 font-mono text-sm text-zinc-400 break-all">
                  Still running on Cloud Run. Health: /health returns {`{"status":"ok"}`}. Not recommended for new integrations.
                </p>
              </div>

              <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-zinc-100">Solver</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Execute intents, produce evidence, submit receipts</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${SYSTEM_STATUS.solver.badgeClass} w-fit`}>{SYSTEM_STATUS.solver.label}</span>
                </div>
                <p className="mt-3 font-mono text-sm text-zinc-400 break-all">
                  Chain-connected with Cloud KMS signing. Submits receipts to IntentReceiptHub on Sepolia. 1 job type (SAFE_REPORT). Evidence bundles work.
                </p>
              </div>

              <div className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-zinc-100">Watchtower</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Monitor receipts, detect violations, file disputes</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${SYSTEM_STATUS.watchtower.badgeClass} w-fit`}>{SYSTEM_STATUS.watchtower.label}</span>
                </div>
                <p className="mt-3 font-mono text-sm text-zinc-400 break-all">
                  Chain-connected with Cloud KMS signing. Worker queries real on-chain events. Rule engine detects stale receipts. API can file disputes on-chain.
                </p>
              </div>
            </div>
          </div>

          {/* Verification Steps */}
          <div>
            <h2 className="text-2xl font-bold text-zinc-50">Verification</h2>
            <p className="mt-3 text-zinc-300">
              To verify the deployed contracts independently:
            </p>
            <div className="mt-4">
              <CodeBlock
                language="bash"
                code={`# Check solver registry minimum bond
cast call ${CONTRACTS.solverRegistry} \\
  "minimumBond()" --rpc-url https://rpc.sepolia.org

# Check receipt hub owner
cast call ${CONTRACTS.intentReceiptHub} \\
  "owner()" --rpc-url https://rpc.sepolia.org

# View on Etherscan (source verified)
# ${EXPLORER_BASE}/address/${CONTRACTS.solverRegistry}#code`}
              />
            </div>
          </div>

        </div>
      </section>
    </main>
  )
}
