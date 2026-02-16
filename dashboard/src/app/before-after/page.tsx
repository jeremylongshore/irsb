import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { COMPARISONS } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Before vs After IRSB',
  description: 'Side-by-side comparison of intent execution before and after IRSB: execution proof, accountability, disputes, reputation, and security.',
  path: '/before-after',
})

export default function BeforeAfterPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Before vs After IRSB"
        subtitle="What changes when you add receipts, bonds, and disputes to intent execution."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Design framing */}
          <div className="mb-8 bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-600">
            <p className="text-sm text-zinc-400">
              This compares the current intent ecosystem with the IRSB design. Protocol contracts are live on Sepolia. Off-chain integration (solver, watchtower, Cloud KMS signing + EIP-7702 delegation) is in progress.
            </p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-zinc-700">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider w-1/5">Aspect</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-red-400 uppercase tracking-wider w-2/5">Without IRSB</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-green-400 uppercase tracking-wider w-2/5">With IRSB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700 bg-zinc-800/40">
                {COMPARISONS.map((row) => (
                  <tr key={row.aspect}>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200 align-top">{row.aspect}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400 align-top">{row.before}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300 align-top">{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {COMPARISONS.map((row) => (
              <div key={row.aspect} className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700">
                <h3 className="font-semibold text-zinc-100 mb-3">{row.aspect}</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-red-400 uppercase tracking-wider mb-1">Without IRSB</p>
                    <p className="text-sm text-zinc-400">{row.before}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-green-400 uppercase tracking-wider mb-1">With IRSB</p>
                    <p className="text-sm text-zinc-300">{row.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
