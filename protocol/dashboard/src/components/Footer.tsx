import Link from 'next/link'
import { COMPANY, NAV_GROUPS } from '@/lib/content'

export default function Footer() {
  return (
    <footer className="bg-zinc-900 border-t border-zinc-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-zinc-200 rounded-lg flex items-center justify-center">
                <span className="text-zinc-900 font-bold text-sm">IR</span>
              </div>
              <span className="text-lg font-bold text-zinc-50">IRSB</span>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              The accountability layer for intent-based transactions.
            </p>
          </div>

          {/* Nav Groups */}
          {NAV_GROUPS.map((group) => (
            <div key={group.name}>
              <h3 className="text-sm font-semibold text-zinc-50 uppercase tracking-wider">
                {group.name}
              </h3>
              <ul className="mt-4 space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Resources + Legal */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-50 uppercase tracking-wider">
              Resources
            </h3>
            <ul className="mt-4 space-y-1">
              <li>
                <Link href="/dashboard" className="block py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                  Dashboard
                </Link>
              </li>
              <li>
                <a href={COMPANY.github} target="_blank" rel="noopener noreferrer" className="block py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                  GitHub
                </a>
              </li>
              <li>
                <Link href="/privacy" className="block py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="block py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                  Terms
                </Link>
              </li>
              <li>
                <a href={`mailto:${COMPANY.email}`} className="block py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                  {COMPANY.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-zinc-700">
          <p className="text-xs text-zinc-500 text-center">
            Experimental software on Sepolia testnet. Not audited. Do not use with mainnet funds.
          </p>
          <p className="mt-2 text-xs text-zinc-600 text-center">
            &copy; 2026 {COMPANY.name}
          </p>
        </div>
      </div>
    </footer>
  )
}
