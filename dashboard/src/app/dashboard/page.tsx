'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SolverTable from '@/components/SolverTable'
import StatsCards from '@/components/StatsCards'
import { Solver, fetchSolverData } from '@/lib/solverData'
import { config, getEtherscanUrl, shortenAddress } from '@/lib/config'

export default function DashboardPage() {
  const [solvers, setSolvers] = useState<Solver[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setError(null)
        const data = await fetchSolverData()
        setSolvers(data)
        setLastUpdated(new Date())
      } catch (err) {
        console.error('Failed to fetch solver data:', err)
        setError('Failed to load data from subgraph')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    window.location.reload()
  }

  return (
    <main className="min-h-screen bg-zinc-900">
      {/* Page Header */}
      <div className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-50">
                  Solver Dashboard
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700">
                  Testnet
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Real-time reputation and performance tracking on Sepolia
              </p>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Last updated</p>
                  <p className="text-sm font-medium text-zinc-300">
                    {lastUpdated.toLocaleTimeString()} · {lastUpdated.toLocaleDateString()}
                  </p>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-zinc-900 transition-colors"
              >
                <svg className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <StatsCards solvers={solvers} loading={loading} />

        {/* Solver Table */}
        <div className="mt-8">
          <div className="bg-zinc-800 border border-zinc-700 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-50">
                    Registered Solvers
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {loading ? 'Loading...' : `${solvers.length} solver${solvers.length !== 1 ? 's' : ''} · Sorted by IntentScore`}
                  </p>
                </div>
              </div>
            </div>

            {/* Empty State */}
            {!loading && solvers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="w-16 h-16 bg-zinc-700 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-zinc-50">
                  Waiting for subgraph to index
                </h3>
                <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
                  Solvers registered on-chain will appear here once The Graph indexes the data. This can take a few minutes after new registrations.
                </p>
                <div className="mt-6">
                  <a
                    href={getEtherscanUrl(config.contracts.solverRegistry)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-zinc-200 hover:text-zinc-50 font-medium"
                  >
                    View SolverRegistry on Etherscan
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : (
              <SolverTable solvers={solvers} loading={loading} />
            )}
          </div>
        </div>

        {/* Contract Info */}
        <div className="mt-8 bg-zinc-800 border border-zinc-700 shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-zinc-50 mb-4">
            Protocol Contracts
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Deployed on Sepolia testnet
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ContractCard
              name="SolverRegistry"
              description="Solver registration and bonds"
              address={config.contracts.solverRegistry}
            />
            <ContractCard
              name="IntentReceiptHub"
              description="Receipt posting and disputes"
              address={config.contracts.intentReceiptHub}
            />
            <ContractCard
              name="DisputeModule"
              description="Escalation and arbitration"
              address={config.contracts.disputeModule}
            />
          </div>
        </div>

        {/* Back to Overview */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-zinc-400 hover:text-zinc-200"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Overview
          </Link>
        </div>
      </div>
    </main>
  )
}

function ContractCard({ name, description, address }: { name: string; description: string; address: string }) {
  return (
    <a
      href={getEtherscanUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-zinc-700/50 border border-zinc-600 rounded-lg p-4 hover:bg-zinc-700 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-50">{name}</p>
        <svg className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
      <p className="text-xs text-zinc-400 mt-1">{description}</p>
      <p className="text-xs text-zinc-200 font-mono mt-2">
        {shortenAddress(address)}
      </p>
    </a>
  )
}
