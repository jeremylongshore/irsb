'use client'

import { useEffect } from 'react'
import { config } from '@/lib/config'

export default function BookCallRedirect() {
  useEffect(() => {
    window.location.replace(config.bookCallUrl)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-200 mx-auto" />
        <p className="mt-4 text-zinc-400">
          Redirecting to calendar...
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          <a href={config.bookCallUrl} className="text-zinc-200 hover:text-zinc-50">
            Click here if not redirected
          </a>
        </p>
      </div>
    </div>
  )
}
