import Link from 'next/link'
import { config } from '@/lib/config'

export const metadata = {
  title: 'Terms of Service',
  description: 'IRSB Protocol terms of service - terms and conditions for using our protocol and services.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            &larr; Back to Home
          </Link>
        </div>

        <article className="prose prose-invert prose-zinc max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-2">Terms of Service</h1>
          <p className="text-zinc-400 text-sm mb-8">Last Updated: January 28, 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">1. Agreement to Terms</h2>
            <p className="text-zinc-300 leading-relaxed">
              By accessing or using IRSB Protocol (&quot;the Protocol&quot;), its dashboard, smart contracts, or any related
              services provided by Intent Solutions (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, do not use our services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">2. Description of Service</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              IRSB Protocol provides an accountability layer for intent-based transactions, including:
            </p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Intent receipt posting and verification</li>
              <li>Solver bond management and staking</li>
              <li>Dispute resolution mechanisms</li>
              <li>Reputation tracking and scoring</li>
              <li>Dashboard and analytics tools</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">3. Eligibility</h2>
            <p className="text-zinc-300 leading-relaxed">
              You must be at least 18 years old and have the legal capacity to enter into these terms.
              By using our services, you represent that you meet these requirements and have the authority
              to bind yourself or your organization to these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">4. Wallet and Account Responsibility</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">You are responsible for:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Maintaining the security of your wallet and private keys</li>
              <li>All activities conducted through your wallet address</li>
              <li>Any transactions you sign and submit to the blockchain</li>
              <li>Understanding the risks of blockchain transactions</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-4">
              We cannot recover lost private keys or reverse blockchain transactions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">5. Experimental Software Notice</h2>
            <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 mb-4">
              <p className="text-amber-200 font-medium">
                IRSB Protocol is experimental software. The smart contracts have not been audited.
                Do not use with mainnet funds until audits are complete and mainnet deployment is announced.
              </p>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              Current deployments on testnets (Sepolia) are for testing and demonstration purposes only.
              Use at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">6. Acceptable Use</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">You agree NOT to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Use the Protocol for any unlawful purpose</li>
              <li>Attempt to exploit, hack, or manipulate smart contracts</li>
              <li>Submit false or fraudulent information</li>
              <li>Interfere with or disrupt the Protocol or its infrastructure</li>
              <li>Attempt to circumvent security measures</li>
              <li>Engage in any form of market manipulation</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">7. Smart Contract Interactions</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">When interacting with IRSB smart contracts:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Transactions are irreversible once confirmed on the blockchain</li>
              <li>Gas fees are your responsibility and are non-refundable</li>
              <li>Slashing events are enforced automatically by smart contract logic</li>
              <li>Bond deposits and withdrawals are subject to protocol parameters</li>
              <li>Dispute resolutions are final as determined by the protocol</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">8. Intellectual Property</h2>
            <p className="text-zinc-300 leading-relaxed">
              The Protocol, including its smart contracts, documentation, and dashboard, is owned by
              Intent Solutions and protected by intellectual property laws. The smart contracts are
              open source under the MIT license. The IRSB name and branding are trademarks of Intent Solutions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">9. Privacy</h2>
            <p className="text-zinc-300 leading-relaxed">
              Your use of the Protocol is also governed by our{' '}
              <Link href="/privacy" className="text-zinc-200 underline hover:text-zinc-50">
                Privacy Policy
              </Link>
              , which is incorporated into these terms by reference.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-zinc-300 leading-relaxed uppercase text-sm">
              THE PROTOCOL IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
              PROTOCOL WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">11. Limitation of Liability</h2>
            <p className="text-zinc-300 leading-relaxed uppercase text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, INTENT SOLUTIONS SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
              LIMITED TO LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR
              USE OF OR INABILITY TO USE THE PROTOCOL, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY
              OF SUCH DAMAGES.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">12. Indemnification</h2>
            <p className="text-zinc-300 leading-relaxed">
              You agree to indemnify and hold harmless Intent Solutions, its officers, directors, employees,
              and agents from any claims, damages, losses, liabilities, and expenses arising out of your
              use of the Protocol or violation of these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">13. Termination</h2>
            <p className="text-zinc-300 leading-relaxed">
              We reserve the right to suspend or terminate access to our dashboard and services at any time,
              for any reason, without notice. However, we cannot prevent you from interacting directly with
              deployed smart contracts on public blockchains.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">14. Changes to Terms</h2>
            <p className="text-zinc-300 leading-relaxed">
              We may modify these terms at any time. Material changes will be posted on our website with
              an updated effective date. Continued use of the Protocol after changes constitutes acceptance
              of the modified terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">15. Governing Law</h2>
            <p className="text-zinc-300 leading-relaxed">
              These terms are governed by the laws of the United States and applicable state law,
              without regard to conflict of law principles.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">16. Severability</h2>
            <p className="text-zinc-300 leading-relaxed">
              If any provision of these terms is found to be unenforceable, the remaining provisions
              will continue in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">17. Contact</h2>
            <p className="text-zinc-300 leading-relaxed">
              For questions about these terms, contact us at:{' '}
              <a href="mailto:legal@intentsolutions.io" className="text-zinc-200 underline hover:text-zinc-50">
                legal@intentsolutions.io
              </a>
            </p>
            <p className="text-zinc-300 leading-relaxed mt-2">
              General inquiries:{' '}
              <a href={`mailto:${config.email}`} className="text-zinc-200 underline hover:text-zinc-50">
                {config.email}
              </a>
            </p>
          </section>
        </article>
      </div>
    </main>
  )
}
