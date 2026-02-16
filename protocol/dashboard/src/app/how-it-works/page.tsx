import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'

export const metadata = pageMetadata({
  title: 'How It Works',
  description: 'The intent lifecycle in 5 steps: from user intent to on-chain accountability with receipts, bonds, and disputes.',
  path: '/how-it-works',
})

const steps = [
  {
    number: 1,
    title: 'User Submits Intent',
    description: 'A user expresses what they want (e.g., swap 1 ETH for USDC at best price). The intent is formatted as an ERC-7683 cross-chain order with an intentHash.',
    detail: 'The intent specifies constraints (minimum output, deadline) but not the execution path. The solver decides how to fulfill it.',
  },
  {
    number: 2,
    title: 'Solver Executes',
    description: 'A registered solver picks up the intent and executes it on-chain. The solver must have an active bond (minimum 0.1 ETH staked in the SolverRegistry).',
    detail: 'Solvers choose execution strategies: direct swaps, multi-hop routing, cross-chain bridges, or aggregation. The method is up to the solver; the outcome must meet the intent constraints.',
  },
  {
    number: 3,
    title: 'Receipt Posted On-Chain',
    description: 'After execution, the solver posts a cryptographic receipt to the IntentReceiptHub. The receipt includes the intentHash, constraintsHash, evidenceHash, and solver signature.',
    detail: 'V2 receipts add dual attestation: both solver and client sign via EIP-712. Privacy levels (public, semi-public, private) control what data is visible on-chain vs. stored off-chain.',
  },
  {
    number: 4,
    title: 'Challenge Window Opens',
    description: 'A 1-hour challenge window begins. During this period, anyone can dispute the receipt by providing evidence and posting a dispute bond.',
    detail: 'Deterministic violations (timeout expired, wrong amount) are resolved automatically. Complex disputes use optimistic resolution: the solver has 24 hours to post a counter-bond, or the challenger wins by default.',
  },
  {
    number: 5,
    title: 'Finalization & Reputation Update',
    description: 'If no dispute is filed during the challenge window, the receipt finalizes. The solver\'s IntentScore is updated based on the outcome.',
    detail: 'If a dispute was filed and resolved against the solver, the bond is slashed: 80% to the user, 15% to the challenger, 5% to the treasury. After 3 jailings, the solver is permanently banned.',
  },
]

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="How It Works"
        subtitle="The intent lifecycle from submission to accountability, in 5 steps."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {steps.map((step) => (
              <div key={step.number} className="relative flex gap-6">
                {/* Step number */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center">
                    <span className="text-lg font-bold text-zinc-200">{step.number}</span>
                  </div>
                  {step.number < steps.length && (
                    <div className="absolute left-6 top-14 bottom-0 w-px bg-zinc-700" style={{ transform: 'translateX(-0.5px)' }} />
                  )}
                </div>

                {/* Step content */}
                <div className="pb-8">
                  <h3 className="text-xl font-semibold text-zinc-50">{step.title}</h3>
                  <p className="mt-2 text-zinc-300">{step.description}</p>
                  <div className="mt-4 bg-zinc-800/60 rounded-lg p-4 border border-zinc-700">
                    <p className="text-sm text-zinc-400">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status callout */}
          <div className="mt-16 bg-blue-900/20 rounded-xl p-6 border border-blue-700/50">
            <h3 className="text-lg font-semibold text-blue-200">Implementation Status</h3>
            <p className="mt-2 text-blue-100/80 text-sm">
              Protocol contracts and EIP-7702 delegation contracts are live on Sepolia testnet. Solver and watchtower are chain-connected with Cloud KMS signing and real on-chain data queries. Receipt posting, dispute resolution, and automated monitoring work end-to-end.
            </p>
          </div>

          {/* Dispute flow detail */}
          <div className="mt-8 bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
            <h3 className="text-lg font-semibold text-zinc-50">Dispute Resolution Paths</h3>
            <div className="mt-4 font-mono text-sm text-zinc-300 whitespace-pre overflow-x-auto">{`Receipt Posted
    |
    +-- [1 hour CHALLENGE_WINDOW]
    |
    +-- No dispute -> finalize() -> Reputation updated
    |
    +-- Dispute opened (with bond)
        |
        +-- Deterministic (timeout, wrong amount)
        |   +-- resolveDeterministic() -> Auto-slash
        |
        +-- Optimistic (V2)
            |
            +-- [24h COUNTER_BOND_WINDOW]
            |
            +-- No counter-bond -> Challenger wins
            |
            +-- Counter-bond posted -> Escalate to Arbitrator
                |
                +-- [7d max] -> Arbitrator rules -> Slash or release`}</div>
          </div>
        </div>
      </section>
    </main>
  )
}
