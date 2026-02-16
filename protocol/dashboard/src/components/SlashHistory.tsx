'use client'

export interface SlashEvent {
  id: string
  receiptId: string
  amount: string
  reason: string
  reasonCode: number
  timestamp: Date
  txHash: string
}

interface SlashHistoryProps {
  slashEvents: SlashEvent[]
}

const DISPUTE_REASONS: Record<number, { label: string; description: string }> = {
  1: { label: 'Timeout', description: 'Expiry passed without settlement' },
  2: { label: 'Min Output Violation', description: 'Output amount below minimum' },
  3: { label: 'Wrong Token', description: 'Incorrect token delivered' },
  4: { label: 'Wrong Chain', description: 'Settled on incorrect chain' },
  5: { label: 'Wrong Recipient', description: 'Delivered to incorrect address' },
  6: { label: 'Receipt Mismatch', description: 'Receipt hash verification failed' },
  7: { label: 'Invalid Signature', description: 'Solver signature invalid' },
  8: { label: 'Subjective', description: 'Required arbitration review' },
}

export default function SlashHistory({ slashEvents }: SlashHistoryProps) {
  const totalSlashed = slashEvents.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  return (
    <div className="bg-zinc-800 border border-zinc-700 shadow rounded-lg">
      <div className="px-6 py-4 border-b border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-50">
              Slash History
            </h3>
            <p className="text-sm text-zinc-400">
              {slashEvents.length} event{slashEvents.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          {slashEvents.length > 0 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-red-400">
                -{totalSlashed.toFixed(3)} ETH
              </p>
              <p className="text-xs text-zinc-500">Total Slashed</p>
            </div>
          )}
        </div>
      </div>

      {slashEvents.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-4xl mb-2">✓</div>
          <p className="text-zinc-400">
            No slash events - Clean record!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-700">
          {slashEvents.map(event => (
            <div
              key={event.id}
              className="px-6 py-4 hover:bg-zinc-700/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="font-medium text-zinc-50">
                      {DISPUTE_REASONS[event.reasonCode]?.label || event.reason}
                    </span>
                    <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded">
                      Code: {event.reasonCode}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400 ml-5">
                    {DISPUTE_REASONS[event.reasonCode]?.description || 'Unknown reason'}
                  </p>
                  <div className="mt-2 ml-5 flex items-center space-x-4 text-xs text-zinc-500">
                    <span>Receipt: {event.receiptId.slice(0, 10)}...</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-200 hover:text-zinc-50"
                    >
                      View TX ↗
                    </a>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-400">
                    -{event.amount} ETH
                  </p>
                  <p className="text-xs text-zinc-500">{formatTimeSince(event.timestamp)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Distribution Info */}
      {slashEvents.length > 0 && (
        <div className="px-6 py-4 border-t border-zinc-700 bg-zinc-700/50">
          <p className="text-xs text-zinc-400">
            Slash distribution: 80% to affected user, 15% to challenger, 5% to protocol treasury
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
