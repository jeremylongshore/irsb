import Link from 'next/link'
import { config, getEtherscanUrl, shortenAddress } from '@/lib/config'
import { EcosystemCards } from '@/components/EcosystemCard'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-50 tracking-tight">
              IRSB
            </h1>
            <p className="mt-2 text-xl sm:text-2xl font-medium text-zinc-200">
              On-chain guardrails for AI agents
            </p>
            <p className="mt-6 max-w-2xl mx-auto text-base text-zinc-400">
              EIP-7702 delegation with five caveat enforcers — spend limits, time windows, contract and method whitelists, replay prevention — so every agent action is policy-enforced, receipted, and monitored. The same infrastructure secures intent-based DeFi solvers.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/get-started"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg text-zinc-900 bg-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg text-zinc-300 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 transition-colors"
              >
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Ecosystem: 4 expandable cards */}
      <section className="py-16 lg:py-24 bg-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-zinc-50">
              The Ecosystem
            </h2>
            <p className="mt-4 text-lg text-zinc-300 max-w-2xl mx-auto">
              Four systems. On-chain guardrails for AI agents.
            </p>
          </div>

          <div className="mt-12">
            <EcosystemCards />
          </div>
        </div>
      </section>

      {/* How It Works: 5 steps */}
      <section className="py-16 lg:py-24 bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-zinc-300">
              The intent lifecycle from submission to accountability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {[
              { step: '1', title: 'Submit Intent', desc: 'User expresses what they want (ERC-7683 format)' },
              { step: '2', title: 'Solver Executes', desc: 'Bonded solver picks up and fills the intent' },
              { step: '3', title: 'Receipt Posted', desc: 'Cryptographic proof of execution goes on-chain' },
              { step: '4', title: 'Challenge Window', desc: '1 hour for anyone to dispute with evidence' },
              { step: '5', title: 'Finalize', desc: 'No dispute = receipt finalizes, reputation updates' },
            ].map((item) => (
              <div key={item.step} className="bg-zinc-800/60 rounded-lg p-4 border border-zinc-700 text-center">
                <div className="w-8 h-8 rounded-full bg-zinc-700 border border-zinc-500 flex items-center justify-center mx-auto">
                  <span className="text-sm font-bold text-zinc-200">{item.step}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-1 text-xs text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-zinc-300 hover:text-zinc-100"
            >
              See full lifecycle with dispute paths &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Deployed & Verifiable */}
      <section className="py-16 lg:py-24 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-zinc-50">
              Deployed on Sepolia
            </h2>
            <p className="mt-4 text-lg text-zinc-300">
              3 contracts verified on Etherscan. 308 passing tests. Open source.
            </p>
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 text-base font-medium rounded-lg text-zinc-900 bg-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              Open Dashboard
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <a
              href={getEtherscanUrl(config.contracts.solverRegistry)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 hover:bg-zinc-700/60 transition-colors group text-center"
            >
              <p className="text-sm font-medium text-zinc-50">SolverRegistry</p>
              <p className="mt-1 font-mono text-xs text-zinc-400 group-hover:text-zinc-200">
                {shortenAddress(config.contracts.solverRegistry)} &#8599;
              </p>
            </a>
            <a
              href={getEtherscanUrl(config.contracts.intentReceiptHub)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 hover:bg-zinc-700/60 transition-colors group text-center"
            >
              <p className="text-sm font-medium text-zinc-50">IntentReceiptHub</p>
              <p className="mt-1 font-mono text-xs text-zinc-400 group-hover:text-zinc-200">
                {shortenAddress(config.contracts.intentReceiptHub)} &#8599;
              </p>
            </a>
            <a
              href={getEtherscanUrl(config.contracts.disputeModule)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 hover:bg-zinc-700/60 transition-colors group text-center"
            >
              <p className="text-sm font-medium text-zinc-50">DisputeModule</p>
              <p className="mt-1 font-mono text-xs text-zinc-400 group-hover:text-zinc-200">
                {shortenAddress(config.contracts.disputeModule)} &#8599;
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* Where to Start */}
      <section className="py-16 lg:py-24 bg-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-zinc-50">
              Where to Start
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-zinc-700 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">
                Understand the Protocol
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Read the one-pager, see what changes before vs after, review the roadmap.
              </p>
              <Link
                href="/one-pager"
                className="mt-4 inline-block text-sm font-medium text-zinc-200 hover:text-zinc-50"
              >
                One-Pager &rarr;
              </Link>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-zinc-700 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">
                Explore the Architecture
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Contracts, parameters, security model, deployed addresses, all 4 repos.
              </p>
              <Link
                href="/technical"
                className="mt-4 inline-block text-sm font-medium text-zinc-200 hover:text-zinc-50"
              >
                Architecture &rarr;
              </Link>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-zinc-700 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">
                Build with IRSB
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Install the SDK, post your first receipt, integrate x402 payments.
              </p>
              <Link
                href="/developers/quickstart"
                className="mt-4 inline-block text-sm font-medium text-zinc-200 hover:text-zinc-50"
              >
                Quickstart &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-16 lg:py-20 bg-zinc-900 border-y border-zinc-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50">
            Building an AI agent with wallet access?
          </h2>
          <p className="mt-4 text-lg text-zinc-300">
            We are working with agent frameworks and DeFi protocols to integrate on-chain guardrails.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/go/request-docs"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg text-zinc-900 bg-zinc-200 hover:bg-zinc-50 transition-colors"
            >
              Request Docs
            </Link>
            <Link
              href="/go/book"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg text-zinc-200 border-2 border-zinc-400 hover:bg-zinc-700 transition-colors"
            >
              Book a Call
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
