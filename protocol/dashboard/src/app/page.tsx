import Link from 'next/link'
import { config, getEtherscanUrl, shortenAddress } from '@/lib/config'
import { EcosystemCards } from '@/components/EcosystemCard'
import { CONTRACTS } from '@/lib/content'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      {/* Hero Section — Clear value prop above fold */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center">
            <p className="text-sm font-medium tracking-wider text-zinc-400 uppercase">
              The accountability layer for AI agents
            </p>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold text-zinc-50 tracking-tight">
              Every agent action.{' '}
              <span className="text-zinc-300">Receipted. Bonded. Monitored.</span>
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-lg text-zinc-300 leading-relaxed">
              AI agents are getting wallet access. IRSB ensures they can&apos;t overspend, can&apos;t
              call unauthorized contracts, and can&apos;t act without cryptographic proof.
              On-chain policy enforcement with automated dispute resolution and portable reputation.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/one-pager"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 text-base font-medium rounded-lg text-zinc-900 bg-zinc-200 hover:bg-zinc-50 transition-colors"
              >
                Read the One-Pager
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

      {/* The Problem — Business case for non-crypto founders */}
      <section className="py-16 lg:py-20 bg-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              The Problem
            </h2>
            <p className="mt-4 text-lg text-zinc-300 max-w-2xl mx-auto">
              AI agents are executing transactions with real money and no guardrails.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                problem: 'No Spend Limits',
                desc: 'An agent with wallet access can drain funds. There are no on-chain controls limiting what it can spend, which contracts it can call, or when it can act.',
                stat: '$0',
                statLabel: 'recovery if your agent overspends',
              },
              {
                problem: 'No Proof of Work',
                desc: 'Solvers and agents claim they executed correctly. There is no standardized receipt, no cryptographic proof, and no way to verify after the fact.',
                stat: '0',
                statLabel: 'on-chain receipts in existing systems',
              },
              {
                problem: 'No Consequences',
                desc: 'Bad actors walk away. No bonds at risk, no automated dispute process, no reputation impact. Honor systems do not scale.',
                stat: '0%',
                statLabel: 'of solver reputation is portable today',
              },
            ].map((item) => (
              <div key={item.problem} className="bg-zinc-900/60 rounded-xl border border-zinc-700 p-6">
                <p className="text-sm font-medium text-red-400 uppercase tracking-wider">{item.problem}</p>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <p className="text-2xl font-bold text-zinc-200">{item.stat}</p>
                  <p className="text-xs text-zinc-500">{item.statLabel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What IRSB Does — Plain English, no jargon */}
      <section className="py-16 lg:py-24 bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              What IRSB Does
            </h2>
            <p className="mt-4 text-lg text-zinc-300 max-w-2xl mx-auto">
              Three layers of protection, enforced at the blockchain level.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
                <svg className="w-8 h-8 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-zinc-50">Policy Enforcement</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Agents delegate their wallet to smart contract code that enforces spend limits, time
                windows, approved contracts, and approved functions. Violations are impossible
                — they revert at the EVM level.
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                Powered by EIP-7702 + 5 caveat enforcers
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
                <svg className="w-8 h-8 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-zinc-50">Cryptographic Receipts</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Every execution produces an on-chain receipt with signed evidence.
                V2 receipts include dual attestation — both the solver and client sign,
                creating non-repudiable proof of what happened.
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                EIP-712 signed, on-chain, immutable
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
                <svg className="w-8 h-8 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-zinc-50">Economic Accountability</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Solvers stake bonds (min 0.1 ETH) that get slashed for violations.
                80% goes to the affected user. A watchtower monitors receipts and files
                disputes automatically. Three strikes means permanent ban.
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                Bonded, slashable, automated monitoring
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works: 5 steps */}
      <section className="py-16 lg:py-24 bg-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              The Intent Lifecycle
            </h2>
            <p className="mt-4 text-lg text-zinc-300">
              From intent to accountability in five steps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {[
              { step: '1', title: 'Submit Intent', desc: 'User expresses what they want done' },
              { step: '2', title: 'Solver Executes', desc: 'A bonded solver picks up and fills the intent' },
              { step: '3', title: 'Receipt Posted', desc: 'Cryptographic proof of execution posted on-chain' },
              { step: '4', title: 'Challenge Window', desc: '1 hour for anyone to dispute with evidence' },
              { step: '5', title: 'Finalize', desc: 'No dispute = receipt finalizes, reputation updates' },
            ].map((item) => (
              <div key={item.step} className="bg-zinc-900/60 rounded-lg p-4 border border-zinc-700 text-center">
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

      {/* Use Cases — Prominent, not buried */}
      <section className="py-16 lg:py-24 bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              Who Uses This
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'AI Agent Frameworks',
                who: 'AgentKit, ElizaOS, Olas, Virtuals',
                desc: 'Agents with wallet access need spend limits, contract whitelists, and audit trails. IRSB enforces these at the EVM level — not in application code.',
              },
              {
                title: 'DeFi Intent Protocols',
                who: 'Across, CoW, UniswapX, 1inch',
                desc: 'Users submit swap intents but have no proof solvers executed correctly. IRSB provides standardized receipts, bonded accountability, and portable solver reputation.',
              },
              {
                title: 'Work Coordination Platforms',
                who: 'Bounty platforms, agent marketplaces',
                desc: 'When agents complete work for pay, cryptographic receipts replace trust. Escrow locks on claim, releases on verified completion, slashes on violation.',
              },
              {
                title: 'API Payment Verification',
                who: 'Paid APIs, compute marketplaces',
                desc: 'x402 HTTP payment integration. When a paid API fulfills a request, a receipt proves service delivery on-chain. No more "did I get what I paid for?" ambiguity.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-zinc-800/60 rounded-xl border border-zinc-700 p-6">
                <h3 className="text-lg font-semibold text-zinc-50">{item.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{item.who}</p>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/use-cases"
              className="text-sm font-medium text-zinc-300 hover:text-zinc-100"
            >
              See detailed use cases &rarr;
            </Link>
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
              Four systems working together. Each solves a specific accountability gap.
            </p>
          </div>

          <div className="mt-12">
            <EcosystemCards />
          </div>
        </div>
      </section>

      {/* Traction — Numbers that matter */}
      <section className="py-16 lg:py-24 bg-zinc-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              Built, Tested, Deployed
            </h2>
            <p className="mt-4 text-lg text-zinc-300">
              Not a whitepaper. Working infrastructure on Ethereum Sepolia.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '11', label: 'Verified Contracts', sub: 'on Sepolia' },
              { value: '1,000+', label: 'Passing Tests', sub: '552 Foundry + 457 TS' },
              { value: '6', label: 'EIP Standards', sub: 'integrated' },
              { value: '5', label: 'CI Workflows', sub: 'automated' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-3xl font-bold text-zinc-50">{item.value}</p>
                <p className="mt-1 text-sm font-medium text-zinc-300">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
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

          <div className="mt-8 flex justify-center">
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
        </div>
      </section>

      {/* Standards — Explain ERC numbers in plain English */}
      <section className="py-16 lg:py-24 bg-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-50">
              Standards-Based Architecture
            </h2>
            <p className="mt-4 text-lg text-zinc-300 max-w-2xl mx-auto">
              Built on emerging Ethereum standards. Each one solves a specific problem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                standard: 'ERC-7683',
                what: 'Intent Format',
                plain: 'A standard way to express "what I want done" across chains. IRSB receipts reference these intents.',
              },
              {
                standard: 'EIP-7702',
                what: 'Account Delegation',
                plain: 'Lets an agent\'s wallet delegate to smart contract code that enforces rules. The key innovation for agent guardrails.',
              },
              {
                standard: 'ERC-7710',
                what: 'Delegation Redemption',
                plain: 'Allows batching multiple delegated transactions atomically. Solvers and facilitators use this for efficient execution.',
              },
              {
                standard: 'ERC-7715',
                what: 'Permission Requests',
                plain: 'A standard way for apps to request execution permissions from wallets. The user-facing side of delegation.',
              },
              {
                standard: 'ERC-8004',
                what: 'Agent Identity',
                plain: 'On-chain identity and reputation for agents. IRSB publishes validation signals that feed into an agent\'s permanent record.',
              },
              {
                standard: 'x402',
                what: 'HTTP Payments',
                plain: 'Pay-per-request for APIs. IRSB adds accountability — when you pay for an API call, a receipt proves you got what you paid for.',
              },
            ].map((item) => (
              <div key={item.standard} className="bg-zinc-900/60 rounded-lg border border-zinc-700 p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-700 px-2 py-0.5 rounded">
                    {item.standard}
                  </span>
                  <span className="text-xs text-zinc-500">{item.what}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{item.plain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where to Start */}
      <section className="py-16 lg:py-24 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-zinc-50">
              Where to Start
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
                <svg className="w-7 h-7 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">
                Understand the Protocol
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Read the one-pager, see before vs after, review the roadmap.
              </p>
              <Link
                href="/one-pager"
                className="mt-4 inline-block text-sm font-medium text-zinc-200 hover:text-zinc-50"
              >
                One-Pager &rarr;
              </Link>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
                <svg className="w-7 h-7 text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-50">
                Explore the Architecture
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Contracts, parameters, security model, deployed addresses.
              </p>
              <Link
                href="/technical"
                className="mt-4 inline-block text-sm font-medium text-zinc-200 hover:text-zinc-50"
              >
                Architecture &rarr;
              </Link>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto border border-zinc-700">
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
      <section className="py-16 lg:py-20 bg-zinc-800 border-y border-zinc-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50">
            Building an AI agent with wallet access?
          </h2>
          <p className="mt-4 text-lg text-zinc-300">
            We are working with agent frameworks and DeFi protocols to integrate
            on-chain guardrails. Currently deployed on Sepolia testnet.
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

      {/* Experimental Software Notice — Visible, honest */}
      <section className="py-8 bg-zinc-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-zinc-500 leading-relaxed">
            IRSB is experimental software deployed on Ethereum Sepolia testnet.
            It has 1,000+ passing tests including fuzz tests but has not yet undergone a formal security audit.
            Not for production use with real funds.
            Licensed under BUSL-1.1 (converts to MIT on 2029-02-17).
          </p>
        </div>
      </section>
    </main>
  )
}
