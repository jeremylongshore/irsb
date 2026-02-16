'use client'

import { useState } from 'react'
import { FAQ_ITEMS, type FAQItem } from '@/lib/content'

const categories = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'technical', label: 'Technical' },
  { key: 'security', label: 'Security' },
  { key: 'integration', label: 'Integration' },
] as const

function AccordionItem({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <span className="font-medium text-zinc-100 pr-4">{item.question}</span>
        <svg
          className={`w-5 h-5 text-zinc-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-4">
          <p className="text-sm text-zinc-300 leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filtered = activeCategory === 'all'
    ? FAQ_ITEMS
    : FAQ_ITEMS.filter((item) => item.category === activeCategory)

  return (
    <main className="min-h-screen bg-zinc-900">
      <section className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-50">Frequently Asked Questions</h1>
          <p className="mt-4 text-lg text-zinc-300 max-w-3xl">
            Common questions about IRSB, intent receipts, solver bonds, and protocol integration.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category filter */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-zinc-700 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQ items */}
          <div className="space-y-3">
            {filtered.map((item) => (
              <AccordionItem key={item.question} item={item} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
