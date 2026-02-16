import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { ROADMAP } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Roadmap',
  description: 'IRSB Protocol roadmap: from Sepolia testnet deployment through mainnet, protocol integration, and multi-chain expansion.',
  path: '/roadmap',
})

const statusColors = {
  completed: 'bg-green-900/50 text-green-300 border-green-700/50',
  'in-progress': 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  planned: 'bg-zinc-700 text-zinc-400 border-zinc-600',
} as const

const statusLabels = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  planned: 'Planned',
} as const

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Roadmap"
        subtitle="Four phases from testnet deployment to ecosystem standard."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {ROADMAP.map((phase, index) => (
              <div key={phase.phase} className="relative flex gap-6">
                {/* Phase indicator */}
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                    phase.status === 'completed'
                      ? 'border-green-500 bg-green-900/30'
                      : phase.status === 'in-progress'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-zinc-600 bg-zinc-800'
                  }`}>
                    <span className="text-lg font-bold text-zinc-200">{phase.phase}</span>
                  </div>
                  {index < ROADMAP.length - 1 && (
                    <div className="absolute left-6 top-14 bottom-0 w-px bg-zinc-700" style={{ transform: 'translateX(-0.5px)' }} />
                  )}
                </div>

                {/* Phase content */}
                <div className="pb-8 flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xl font-bold text-zinc-50">Phase {phase.phase}: {phase.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[phase.status]}`}>
                      {statusLabels[phase.status]}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                          phase.status === 'completed'
                            ? 'bg-green-400'
                            : phase.status === 'in-progress'
                              ? 'bg-blue-400'
                              : 'bg-zinc-500'
                        }`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Outlook */}
          <div className="mt-12 bg-zinc-800/60 rounded-xl p-6 border border-zinc-700">
            <h2 className="text-xl font-bold text-zinc-50">Outlook</h2>
            <p className="mt-3 text-zinc-300">
              The goal is to establish IRSB as an open standard for intent accountability.
              The path: security audit, mainnet deployment, first protocol integration (targeting Across, CoW, or UniswapX),
              then submit as an ERC/EIP proposal. Multi-chain deployment follows mainnet.
              Standards succeed by being adopted everywhere, not by owning infrastructure.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
