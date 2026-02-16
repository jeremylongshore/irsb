import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import Link from 'next/link'
import {
  COMPETITORS,
  COMPARISON_FEATURES,
  IRSB_FEATURES,
  type FeatureSupport,
} from '@/lib/content'

export const metadata = pageMetadata({
  title: 'How IRSB Compares',
  description:
    'IRSB vs UniswapX, CoW Protocol, 1inch Fusion, Across, Ethos Network, and EigenLayer — the only cross-protocol accountability standard with receipts, bonds, disputes, and portable reputation.',
  path: '/comparison',
})

function FeatureIcon({ support }: { support: FeatureSupport }) {
  switch (support) {
    case 'yes':
      return <span className="text-green-400 font-bold" title="Yes">&#10003;</span>
    case 'partial':
      return <span className="text-yellow-400 font-bold" title="Partial / Internal">~</span>
    case 'no':
      return <span className="text-zinc-500" title="No">&#10005;</span>
  }
}

export default function ComparisonPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="How IRSB Compares"
        subtitle="IRSB vs existing approaches to intent accountability and on-chain reputation."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Positioning statement */}
          <div className="mb-12">
            <p className="text-zinc-300 text-lg leading-relaxed">
              Intent protocols have internal reputation. Restaking protocols have generic slashing.
              Social reputation protocols have peer reviews. <strong className="text-zinc-100">IRSB is the only
              cross-protocol accountability standard</strong> that combines execution receipts, solver bonds,
              dispute resolution, and portable reputation — purpose-built for intent-based transactions.
            </p>
          </div>

          {/* Legend */}
          <div className="mb-6 flex items-center gap-6 text-sm text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="text-green-400 font-bold">&#10003;</span> Yes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-yellow-400 font-bold">~</span> Partial / Internal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-500">&#10005;</span> No
            </span>
          </div>

          {/* Desktop comparison table */}
          <div className="hidden lg:block overflow-hidden rounded-xl border border-zinc-700 mb-16">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Feature
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-green-400 uppercase tracking-wider">
                      IRSB
                    </th>
                    {COMPETITORS.map((c) => (
                      <th
                        key={c.name}
                        className="px-4 py-4 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                  {COMPARISON_FEATURES.map((feature) => (
                    <tr key={feature}>
                      <td className="px-4 py-3.5 text-sm font-medium text-zinc-200">{feature}</td>
                      <td className="px-4 py-3.5 text-center">
                        <FeatureIcon support={IRSB_FEATURES[feature]} />
                      </td>
                      {COMPETITORS.map((c) => (
                        <td key={c.name} className="px-4 py-3.5 text-center">
                          <FeatureIcon support={(c.features[feature] ?? 'no') as FeatureSupport} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile comparison cards */}
          <div className="lg:hidden space-y-4 mb-16">
            {COMPETITORS.map((competitor) => (
              <div
                key={competitor.name}
                className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-zinc-100">{competitor.name}</h3>
                  <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
                    {competitor.category}
                  </span>
                </div>
                <div className="space-y-2">
                  {COMPARISON_FEATURES.map((feature) => (
                    <div key={feature} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">{feature}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-12 text-right">Them</span>
                        <FeatureIcon
                          support={(competitor.features[feature] ?? 'no') as FeatureSupport}
                        />
                        <span className="text-zinc-600">|</span>
                        <span className="text-xs text-zinc-500 w-8">IRSB</span>
                        <FeatureIcon support={IRSB_FEATURES[feature]} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Per-project detail cards */}
          <h2 className="text-2xl font-bold text-zinc-100 mb-6">How Each Compares</h2>
          <div className="grid gap-6 md:grid-cols-2 mb-16">
            {COMPETITORS.map((competitor) => (
              <div
                key={competitor.name}
                className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700"
              >
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-semibold text-zinc-100">{competitor.name}</h3>
                  <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
                    {competitor.category}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-3">{competitor.description}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1 font-semibold">
                  Their approach
                </p>
                <p className="text-sm text-zinc-400 mb-3">{competitor.approach}</p>
                <p className="text-xs text-green-400 uppercase tracking-wider mb-1 font-semibold">
                  How IRSB differs
                </p>
                <p className="text-sm text-zinc-300">{competitor.irsbDiff}</p>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-zinc-800/60 rounded-xl p-8 border border-zinc-700 text-center">
            <p className="text-lg text-zinc-300 leading-relaxed mb-4">
              IRSB doesn&apos;t replace these protocols. It gives them an{' '}
              <strong className="text-zinc-100">accountability layer they don&apos;t have</strong> —
              standardized receipts, slashable bonds, dispute resolution, and portable reputation
              that works across all of them.
            </p>
            <Link
              href="/developers/quickstart"
              className="inline-block mt-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
