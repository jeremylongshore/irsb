'use client'

import { Solver } from '@/lib/solverData'

interface StatsCardsProps {
  solvers: Solver[]
  loading: boolean
}

export default function StatsCards({ solvers, loading }: StatsCardsProps) {
  const activeSolvers = solvers.filter(s => s.status === 'active').length
  const totalIntents = solvers.reduce((sum, s) => sum + s.totalIntents, 0)
  const totalBond = solvers.reduce((sum, s) => sum + parseFloat(s.bondAmount), 0)
  const avgScore = solvers.length > 0
    ? Math.round(solvers.reduce((sum, s) => sum + s.intentScore, 0) / solvers.length)
    : 0
  const totalSlashing = solvers.reduce((sum, s) => sum + s.slashingEvents, 0)

  const stats = [
    {
      name: 'Active Solvers',
      value: loading ? '-' : activeSolvers.toString(),
      subtext: `of ${solvers.length} registered`,
      color: 'text-green-400',
      bgColor: 'bg-green-900/30',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: 'Total Intents',
      value: loading ? '-' : totalIntents.toLocaleString(),
      subtext: 'processed',
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/30',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: 'Total Bond',
      value: loading ? '-' : `${totalBond.toFixed(1)} ETH`,
      subtext: 'staked',
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/30',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Avg IntentScore',
      value: loading ? '-' : avgScore.toString(),
      subtext: 'across all solvers',
      color: 'text-zinc-200',
      bgColor: 'bg-zinc-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
    },
    {
      name: 'Slashing Events',
      value: loading ? '-' : totalSlashing.toString(),
      subtext: 'total',
      color: totalSlashing > 0 ? 'text-red-400' : 'text-green-400',
      bgColor: totalSlashing > 0 ? 'bg-red-900/30' : 'bg-green-900/30',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="bg-zinc-800 border border-zinc-700 overflow-hidden shadow rounded-lg"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className={`flex-shrink-0 ${stat.bgColor} rounded-md p-3`}>
                <div className={stat.color}>{stat.icon}</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-zinc-400 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className={`text-2xl font-semibold ${stat.color}`}>
                      {stat.value}
                    </div>
                  </dd>
                  <dd className="text-xs text-zinc-500">
                    {stat.subtext}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
