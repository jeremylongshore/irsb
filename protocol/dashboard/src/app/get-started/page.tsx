import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'
import PageHeader from '@/components/PageHeader'

export const metadata = pageMetadata({
  title: 'Get Started',
  description: 'Choose your path into the IRSB Protocol: investor/partner overview, technical exploration, or developer integration.',
  path: '/get-started',
})

const audiences = [
  {
    title: 'Investor or Partner',
    subtitle: 'Understand the protocol and opportunity',
    description: 'Learn what IRSB does, why intent execution needs accountability, and where the project is headed.',
    links: [
      { label: 'One-Pager (executive summary)', href: '/one-pager' },
      { label: 'Before vs After', href: '/before-after' },
      { label: 'Use Cases', href: '/use-cases' },
      { label: 'Roadmap', href: '/roadmap' },
    ],
    cta: { label: 'Read the One-Pager', href: '/one-pager' },
  },
  {
    title: 'Technical Explorer',
    subtitle: 'Dive into the architecture',
    description: 'Examine the contract architecture, security model, deployed contracts, and how the four repositories work together.',
    links: [
      { label: 'How It Works (5-step lifecycle)', href: '/how-it-works' },
      { label: 'Architecture & Parameters', href: '/technical' },
      { label: 'Security Model', href: '/security' },
      { label: 'Ecosystem Overview', href: '/ecosystem' },
      { label: 'Live Deployments', href: '/deployments' },
    ],
    cta: { label: 'View Architecture', href: '/technical' },
  },
  {
    title: 'Developer or Operator',
    subtitle: 'Build with IRSB',
    description: 'Install the SDK, post your first receipt, integrate x402 payments, or run a solver with IRSB accountability.',
    links: [
      { label: 'Quickstart (first receipt in 5 minutes)', href: '/developers/quickstart' },
      { label: 'SDK Reference', href: '/developers/sdk' },
      { label: 'x402 Integration Guide', href: '/developers/x402' },
      { label: 'Contract ABI Reference', href: '/developers/contracts' },
      { label: 'Live Dashboard', href: '/dashboard' },
    ],
    cta: { label: 'Start Building', href: '/developers/quickstart' },
  },
]

export default function GetStartedPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <PageHeader
        title="Get Started"
        subtitle="Choose your path into the IRSB Protocol."
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className="bg-zinc-800/60 rounded-xl p-6 border border-zinc-700 flex flex-col"
              >
                <div>
                  <h2 className="text-xl font-bold text-zinc-50">{audience.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{audience.subtitle}</p>
                  <p className="mt-4 text-sm text-zinc-300">{audience.description}</p>
                </div>

                <ul className="mt-6 space-y-2 flex-1">
                  {audience.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        &rarr; {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <Link
                    href={audience.cta.href}
                    className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium rounded-lg text-zinc-900 bg-zinc-200 hover:bg-zinc-50 transition-colors"
                  >
                    {audience.cta.label}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="mt-12 text-center">
            <p className="text-zinc-400">
              Questions? Email{' '}
              <a href="mailto:jeremy@intentsolutions.io" className="text-zinc-200 hover:text-zinc-50">
                jeremy@intentsolutions.io
              </a>
              {' '}or{' '}
              <Link href="/go/book" className="text-zinc-200 hover:text-zinc-50">
                book a call
              </Link>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
