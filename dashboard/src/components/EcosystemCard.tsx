'use client'

import { useState } from 'react'
import { ECOSYSTEM_DETAILS, SYSTEM_STATUS } from '@/lib/content'

function EcosystemCard({ item }: { item: (typeof ECOSYSTEM_DETAILS)[number] }) {
  const [isOpen, setIsOpen] = useState(false)
  const status = SYSTEM_STATUS[item.statusKey]

  return (
    <div className="bg-zinc-800/60 rounded-xl border border-zinc-700">
      <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs px-2 py-0.5 rounded ${status.badgeClass}`}>
            {status.label}
          </span>
        </div>
        <p className="text-sm font-medium text-red-400 uppercase tracking-wider mb-2">
          {item.problem}
        </p>
        <h3 className="text-lg font-semibold text-zinc-50">{item.name}</h3>
        <p className="mt-2 text-sm text-zinc-400">{item.summary}</p>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
        >
          <span>{isOpen ? 'Less' : 'More'}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-zinc-700 pt-4">
          <p className="text-sm text-zinc-300 leading-relaxed">{item.detail}</p>
          <p className="mt-3 text-xs font-mono text-zinc-500">{item.techStack}</p>
        </div>
      )}
    </div>
  )
}

export function EcosystemCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {ECOSYSTEM_DETAILS.map((item) => (
        <EcosystemCard key={item.key} item={item} />
      ))}
    </div>
  )
}
