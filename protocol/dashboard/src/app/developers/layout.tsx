'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sidebarItems = [
  { name: 'Quickstart', href: '/developers/quickstart' },
  { name: 'SDK Reference', href: '/developers/sdk' },
  { name: 'x402 Guide', href: '/developers/x402' },
  { name: 'Contract Reference', href: '/developers/contracts' },
]

export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
          {/* Sidebar */}
          <nav className="hidden lg:block">
            <div className="sticky top-24">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Developers
              </h3>
              <ul className="space-y-1">
                {sidebarItems.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-zinc-800 text-zinc-50 border-l-2 border-zinc-400'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        }`}
                      >
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>

          {/* Mobile nav */}
          <div className="lg:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-50'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/30'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </div>

          {/* Content */}
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
