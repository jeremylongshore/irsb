'use client'

import { useState } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
        {language && (
          <span className="text-xs font-mono text-zinc-500 uppercase">{language}</span>
        )}
        <button
          onClick={handleCopy}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors ml-auto"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}
