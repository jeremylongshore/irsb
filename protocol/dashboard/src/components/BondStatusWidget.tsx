'use client'

interface BondEvent {
  type: 'Deposit' | 'Withdrawal'
  amount: string
  timestamp: Date
}

interface BondStatusWidgetProps {
  totalBond: string
  availableBond: string
  lockedBond: string
  isAboveMinimum: boolean
  bondEvents: BondEvent[]
}

export default function BondStatusWidget({
  totalBond,
  availableBond,
  lockedBond,
  isAboveMinimum,
  bondEvents,
}: BondStatusWidgetProps) {
  const total = parseFloat(totalBond)
  const available = parseFloat(availableBond)
  const locked = parseFloat(lockedBond)
  const availablePercent = total > 0 ? (available / total) * 100 : 0

  return (
    <div className="bg-zinc-800 border border-zinc-700 shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-50">
          Bond Status
        </h3>
        {!isAboveMinimum && (
          <span className="px-2 py-1 bg-red-900/50 text-red-300 border border-red-700 text-xs rounded-full">
            Below Minimum
          </span>
        )}
      </div>

      {/* Bond Bar Visualization */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-400">Available</span>
          <span className="text-zinc-50 font-medium">{availableBond} ETH</span>
        </div>
        <div className="h-4 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-4 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${availablePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-zinc-500">
            Locked: {lockedBond} ETH
          </span>
          <span className="text-zinc-500">
            Total: {totalBond} ETH
          </span>
        </div>
      </div>

      {/* Bond Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-green-400">{totalBond}</p>
          <p className="text-xs text-zinc-500">Total Bond</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-400">{availableBond}</p>
          <p className="text-xs text-zinc-500">Available</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-400">{lockedBond}</p>
          <p className="text-xs text-zinc-500">Locked</p>
        </div>
      </div>

      {/* Recent Bond Activity */}
      <div>
        <h4 className="text-sm font-medium text-zinc-50 mb-3">
          Recent Activity
        </h4>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {bondEvents.length === 0 ? (
            <p className="text-sm text-zinc-500">No recent activity</p>
          ) : (
            bondEvents.map((event, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0"
              >
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      event.type === 'Deposit' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm text-zinc-50">{event.type}</span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-medium ${
                      event.type === 'Deposit'
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {event.type === 'Deposit' ? '+' : '-'}{event.amount} ETH
                  </span>
                  <p className="text-xs text-zinc-500">{formatTimeSince(event.timestamp)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Minimum Bond Warning */}
      {!isAboveMinimum && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-sm text-red-300">
            Bond is below minimum threshold (0.1 ETH). Solver cannot accept new intents.
          </p>
        </div>
      )}
    </div>
  )
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
