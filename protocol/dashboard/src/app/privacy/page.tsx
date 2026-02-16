import Link from 'next/link'
import { config } from '@/lib/config'

export const metadata = {
  title: 'Privacy Policy',
  description: 'IRSB Protocol privacy policy - how we collect, use, and protect your information.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="mb-8">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            &larr; Back to Home
          </Link>
        </div>

        <article className="prose prose-invert prose-zinc max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-2">Privacy Policy</h1>
          <p className="text-zinc-400 text-sm mb-8">Last Updated: January 28, 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">1. Introduction</h2>
            <p className="text-zinc-300 leading-relaxed">
              Intent Solutions (&quot;IRSB Protocol,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our
              protocol, dashboard, and related services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-zinc-200 mb-2">Information You Provide</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2 mb-4">
              <li>Contact information (email address) when requesting documentation</li>
              <li>Wallet addresses when interacting with smart contracts</li>
              <li>Communication records when you contact us</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-200 mb-2">Information Collected Automatically</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Device and browser information</li>
              <li>IP address and geographic location</li>
              <li>Usage analytics and interaction data</li>
              <li>Blockchain transaction data (publicly available)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">We use collected information to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Provide and maintain our services</li>
              <li>Respond to your inquiries and requests</li>
              <li>Send documentation and updates you&apos;ve requested</li>
              <li>Improve our protocol and user experience</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">4. Information Sharing</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              <strong className="text-zinc-100">We do NOT sell or rent your personal information.</strong>
            </p>
            <p className="text-zinc-300 leading-relaxed mb-4">We may share information only when:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>You explicitly authorize the sharing</li>
              <li>Required by law or legal process</li>
              <li>Necessary to protect our rights or safety</li>
              <li>With service providers who assist our operations (under strict confidentiality)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">5. Blockchain Data</h2>
            <p className="text-zinc-300 leading-relaxed">
              IRSB Protocol operates on public blockchain networks. Transactions, wallet addresses, receipts,
              and other on-chain data are publicly visible and immutable. We cannot delete or modify blockchain data.
              Please be aware of this when interacting with our smart contracts.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">6. Data Security</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">We implement security measures including:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security assessments</li>
              <li>Access controls and authentication</li>
              <li>Secure cloud infrastructure (Google Cloud Platform)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">7. Your Rights</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">You have the right to:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information (where applicable)</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-4">
              To exercise these rights, contact us at{' '}
              <a href={`mailto:privacy@intentsolutions.io`} className="text-zinc-200 underline hover:text-zinc-50">
                privacy@intentsolutions.io
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">8. Cookies and Tracking</h2>
            <p className="text-zinc-300 leading-relaxed">
              We use essential cookies for session management and site functionality. We may use analytics
              tools to understand usage patterns. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">9. Third-Party Services</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">Our services integrate with:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-2">
              <li>Google Cloud Platform (hosting and infrastructure)</li>
              <li>Firebase (hosting and analytics)</li>
              <li>The Graph (blockchain indexing)</li>
              <li>Ethereum and EVM-compatible networks</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-4">
              These services have their own privacy policies governing their data practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">10. Data Retention</h2>
            <p className="text-zinc-300 leading-relaxed">
              We retain personal information only as long as necessary for the purposes described in this policy,
              or as required by law. Blockchain data is retained indefinitely as part of the public ledger.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">11. International Transfers</h2>
            <p className="text-zinc-300 leading-relaxed">
              Your information may be processed in countries other than your own. By using our services,
              you consent to the transfer of information to countries that may have different data protection rules.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">12. Changes to This Policy</h2>
            <p className="text-zinc-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by posting the new policy on this page with an updated revision date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">13. Contact Us</h2>
            <p className="text-zinc-300 leading-relaxed">
              For privacy-related inquiries, contact us at:{' '}
              <a href="mailto:privacy@intentsolutions.io" className="text-zinc-200 underline hover:text-zinc-50">
                privacy@intentsolutions.io
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
