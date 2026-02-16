import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'
import { USE_CASES } from '@/lib/content'

export const metadata = pageMetadata({
  title: 'Use Cases',
  description: 'IRSB use cases: DeFi intent execution, AI agent accountability, x402 HTTP payment verification, and portable solver reputation.',
  path: '/use-cases',
})

export default function UseCasesPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Use Cases"
        subtitle="Where IRSB applies: from DeFi solver accountability to AI agent auditing and HTTP payment verification."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 bg-zinc-800/60 rounded-lg px-4 py-3 border border-zinc-600">
            <p className="text-sm text-zinc-400">
              Protocol contracts are live on Sepolia. These use cases describe how the system works end-to-end once off-chain components (solver, watchtower, Cloud KMS signing + EIP-7702 delegation) are fully integrated.
            </p>
          </div>
          <div className="space-y-8">
            {USE_CASES.map((useCase) => (
              <div key={useCase.title} className="bg-zinc-800/60 rounded-xl p-6 lg:p-8 border border-zinc-700">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase tracking-wider">
                    {useCase.category}
                  </span>
                  <h2 className="text-xl font-bold text-zinc-50">{useCase.title}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">Problem</h3>
                    <p className="text-sm text-zinc-300">{useCase.problem}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">With IRSB</h3>
                    <p className="text-sm text-zinc-300">{useCase.solution}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">Example</h3>
                    <p className="text-sm text-zinc-400">{useCase.example}</p>
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
