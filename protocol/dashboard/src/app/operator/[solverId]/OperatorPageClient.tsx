'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import BondStatusWidget from '@/components/BondStatusWidget'
import ReceiptHistory from '@/components/ReceiptHistory'
import SlashHistory from '@/components/SlashHistory'
import { fetchOperatorData, OperatorData } from '@/lib/operatorData'

// Validate and sanitize metadata URI for safe rendering
function getSafeMetadataUrl(uri: string): string | null {
  if (!uri) return null

  // IPFS URIs are safe - convert to gateway
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`
  }

  try {
    const url = new URL(uri)
    // Only allow HTTPS
    if (url.protocol !== 'https:') return null
    // Block dangerous protocols that made it through
    if (uri.toLowerCase().startsWith('javascript:')) return null
    if (uri.toLowerCase().startsWith('data:')) return null
    return uri
  } catch {
    return null
  }
}

interface OperatorPageClientProps {
  solverId: string
}

export default function OperatorPageClient({ solverId }: OperatorPageClientProps) {
  const [data, setData] = useState<OperatorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const operatorData = await fetchOperatorData(solverId)
        setData(operatorData)
      } catch (err) {
        setError('Failed to load operator data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (solverId) {
      loadData()
    }
  }, [solverId])

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-200 mx-auto"></div>
          <p className="mt-4 text-zinc-400">Loading operator data...</p>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">{error || 'Operator not found'}</p>
          <Link href="/" className="mt-4 text-zinc-200 hover:text-zinc-50">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-900">
      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/"
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  ← Back
                </Link>
                <span className="text-zinc-600">|</span>
                <h1 className="text-2xl font-bold text-zinc-50">
                  {data.name || 'Relayer Operator'}
                </h1>
              </div>
              <p className="mt-1 text-sm text-zinc-400 font-mono">
                {solverId.slice(0, 10)}...{solverId.slice(-8)}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <StatusBadge status={data.status} />
              <ScoreBadge score={data.intentScore} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Row: Bond + SLA Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bond Status */}
          <BondStatusWidget
            totalBond={data.bondBalance}
            availableBond={data.availableBond}
            lockedBond={data.lockedBond}
            isAboveMinimum={data.isAboveMinimum}
            bondEvents={data.recentBondEvents}
          />

          {/* SLA Metrics */}
          <div className="bg-zinc-800 border border-zinc-700 shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-zinc-50 mb-4">
              SLA Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="Fill Rate"
                value={`${data.fillRate.toFixed(1)}%`}
                trend={data.fillRate >= 95 ? 'good' : data.fillRate >= 80 ? 'warning' : 'bad'}
              />
              <MetricCard
                label="Timeout Rate"
                value={`${data.timeoutRate.toFixed(2)}%`}
                trend={data.timeoutRate < 1 ? 'good' : data.timeoutRate < 5 ? 'warning' : 'bad'}
              />
              <MetricCard
                label="Dispute Rate"
                value={`${data.disputeRate.toFixed(2)}%`}
                trend={data.disputeRate < 1 ? 'good' : data.disputeRate < 3 ? 'warning' : 'bad'}
              />
              <MetricCard
                label="Avg Settlement"
                value={formatTime(data.avgSettlementTime)}
                trend={data.avgSettlementTime < 60 ? 'good' : data.avgSettlementTime < 300 ? 'warning' : 'bad'}
              />
            </div>
          </div>
        </div>

        {/* Intent Score Visualization */}
        <div className="mt-6 bg-zinc-800 border border-zinc-700 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-50">
              IntentScore Breakdown
            </h3>
            <span className="text-3xl font-bold text-zinc-200">{data.intentScore}</span>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Success Rate" value={data.fillRate} weight={40} />
            <ScoreBar label="Speed" value={data.speedScore} weight={20} />
            <ScoreBar label="Volume" value={data.volumeScore} weight={20} />
            <ScoreBar label="Dispute Score" value={data.disputeScore} weight={20} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Score decays by 50% every 30 days of inactivity. Last active: {formatTimeSince(data.lastActive)}
          </p>
        </div>

        {/* Recent Receipts */}
        <div className="mt-6">
          <ReceiptHistory receipts={data.recentReceipts} />
        </div>

        {/* Slash History */}
        <div className="mt-6">
          <SlashHistory slashEvents={data.slashEvents} />
        </div>

        {/* Contract Links */}
        <div className="mt-8 bg-zinc-800 border border-zinc-700 shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-50 mb-4">
            Verification
          </h3>
          <div className="flex flex-wrap gap-4">
            <a
              href={`https://sepolia.etherscan.io/address/${data.operatorAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-zinc-700/50 border border-zinc-600 hover:bg-zinc-700 rounded-lg text-sm text-zinc-200"
            >
              View on Etherscan ↗
            </a>
            {getSafeMetadataUrl(data.metadataURI) && (
              <a
                href={getSafeMetadataUrl(data.metadataURI)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-zinc-700/50 border border-zinc-600 hover:bg-zinc-700 rounded-lg text-sm text-zinc-200"
              >
                View Metadata ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-green-900/50 text-green-300 border border-green-700',
    Jailed: 'bg-red-900/50 text-red-300 border border-red-700',
    Inactive: 'bg-zinc-700 text-zinc-400 border border-zinc-600',
    Banned: 'bg-red-900/70 text-red-300 border border-red-600',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status] || colors.Inactive}`}>
      {status}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass = 'bg-green-900/50 text-green-300 border border-green-700'
  if (score < 50) colorClass = 'bg-red-900/50 text-red-300 border border-red-700'
  else if (score < 75) colorClass = 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold ${colorClass}`}>
      Score: {score}
    </span>
  )
}

function MetricCard({
  label,
  value,
  trend,
}: {
  label: string
  value: string
  trend: 'good' | 'warning' | 'bad'
}) {
  const trendColors = {
    good: 'text-green-400',
    warning: 'text-yellow-400',
    bad: 'text-red-400',
  }

  return (
    <div className="bg-zinc-700/50 border border-zinc-600 rounded-lg p-4">
      <p className="text-xs text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${trendColors[trend]}`}>{value}</p>
    </div>
  )
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const contribution = (value / 100) * weight
  const percentage = Math.min(100, value)

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-50 font-medium">
          +{contribution.toFixed(1)} ({weight}% weight)
        </span>
      </div>
      <div className="h-2 bg-zinc-700 rounded-full">
        <div
          className="h-2 bg-zinc-200 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
