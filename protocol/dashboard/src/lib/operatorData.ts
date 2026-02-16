import { ReceiptEntry } from '@/components/ReceiptHistory'
import { SlashEvent } from '@/components/SlashHistory'
import { graphqlClient, SOLVER_DETAIL_QUERY } from './graphql'

export interface OperatorData {
  // Identity
  solverId: string
  name: string
  operatorAddress: string
  metadataURI: string
  status: 'Active' | 'Jailed' | 'Inactive' | 'Banned'

  // Bond
  bondBalance: string
  availableBond: string
  lockedBond: string
  isAboveMinimum: boolean
  recentBondEvents: Array<{
    type: 'Deposit' | 'Withdrawal'
    amount: string
    timestamp: Date
  }>

  // Score
  intentScore: number
  fillRate: number
  speedScore: number
  volumeScore: number
  disputeScore: number

  // SLA Metrics
  timeoutRate: number
  disputeRate: number
  avgSettlementTime: number // seconds
  totalFills: number

  // Activity
  lastActive: Date
  registeredAt: Date

  // History
  recentReceipts: ReceiptEntry[]
  slashEvents: SlashEvent[]
}

interface SubgraphSolverDetail {
  id: string
  operator: string
  metadataURI: string
  bondBalance: string
  lockedBalance: string
  status: number
  intentScore: number
  riskScore: number
  fillRate: number
  disputeRate: number
  avgSettlementTime: number
  totalFills: number
  successfulFills: number
  lastActiveTime: string
  registrationTime: string
  receipts: Array<{
    id: string
    intentHash: string
    status: number
    postedAt: string
    finalizedAt: string | null
    settlementTime: number | null
  }>
  slashEvents: Array<{
    id: string
    receiptId: string
    amount: string
    reason: number
    timestamp: string
    txHash: string
  }>
  bondEvents: Array<{
    id: string
    eventType: string
    amount: string
    timestamp: string
  }>
}

interface SubgraphDetailResponse {
  solver: SubgraphSolverDetail | null
}

// Map status number to string
function mapStatus(status: number): 'Active' | 'Jailed' | 'Inactive' | 'Banned' {
  switch (status) {
    case 1: return 'Active'
    case 2: return 'Jailed'
    case 3: return 'Banned'
    default: return 'Inactive'
  }
}

// Map receipt status number to string
function mapReceiptStatus(status: number): 'Pending' | 'Disputed' | 'Finalized' | 'Slashed' {
  switch (status) {
    case 0: return 'Pending'
    case 1: return 'Disputed'
    case 2: return 'Finalized'
    case 3: return 'Slashed'
    default: return 'Pending'
  }
}

// Dispute reason codes
const REASON_LABELS: Record<number, string> = {
  1: 'Timeout',
  2: 'Min Output Violation',
  3: 'Wrong Token',
  4: 'Wrong Chain',
  5: 'Wrong Recipient',
  6: 'Receipt Mismatch',
  7: 'Invalid Signature',
  8: 'Subjective',
}

// Allowed IPFS gateways for metadata fetching
const ALLOWED_IPFS_GATEWAYS = [
  'https://ipfs.io',
  'https://gateway.pinata.cloud',
  'https://cloudflare-ipfs.com',
  'https://dweb.link',
]

// Validate URL to prevent SSRF attacks
function isValidMetadataUrl(uri: string): boolean {
  // Only allow IPFS URIs (we convert them to safe gateways)
  if (uri.startsWith('ipfs://')) return true

  try {
    const url = new URL(uri)

    // Only allow HTTPS
    if (url.protocol !== 'https:') return false

    // Block private/internal IP ranges
    const hostname = url.hostname.toLowerCase()

    // Block localhost and common internal hostnames
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return false
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false

    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') return false

    // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number)
      if (a === 10) return false
      if (a === 172 && b >= 16 && b <= 31) return false
      if (a === 192 && b === 168) return false
      if (a === 127) return false
      if (a === 169 && b === 254) return false
    }

    return true
  } catch {
    return false
  }
}

// Fetch solver name from metadata
async function fetchSolverName(metadataURI: string, fallback: string): Promise<string> {
  if (!metadataURI) return fallback

  // Validate URL before fetching (SSRF prevention)
  if (!isValidMetadataUrl(metadataURI)) return fallback

  try {
    const url = metadataURI.startsWith('ipfs://')
      ? `${ALLOWED_IPFS_GATEWAYS[0]}/ipfs/${metadataURI.slice(7)}`
      : metadataURI
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    return data.name || fallback
  } catch {
    return fallback
  }
}

// Transform subgraph data to OperatorData
async function transformOperatorData(s: SubgraphSolverDetail): Promise<OperatorData> {
  const bondBalance = parseFloat(s.bondBalance || '0') / 1e18
  const lockedBalance = parseFloat(s.lockedBalance || '0') / 1e18
  const availableBond = bondBalance - lockedBalance
  const name = await fetchSolverName(s.metadataURI, `Solver ${s.id.slice(0, 8)}`)

  // Calculate score components (simplified)
  const fillRate = s.fillRate || 0
  const speedScore = Math.max(0, Math.min(100, ((60 - (s.avgSettlementTime || 30)) / 48) * 100))
  const volumeScore = Math.min(100, Math.log10((s.totalFills || 1) + 1) * 25)
  const disputeScore = Math.max(0, 100 - (s.disputeRate || 0) * 10)

  return {
    solverId: s.id,
    name,
    operatorAddress: s.operator,
    metadataURI: s.metadataURI,
    status: mapStatus(s.status),

    bondBalance: bondBalance.toFixed(2),
    availableBond: availableBond.toFixed(2),
    lockedBond: lockedBalance.toFixed(2),
    isAboveMinimum: bondBalance >= 0.1,
    recentBondEvents: (s.bondEvents || []).map(e => ({
      type: e.eventType === 'deposit' ? 'Deposit' as const : 'Withdrawal' as const,
      amount: (parseFloat(e.amount) / 1e18).toFixed(2),
      timestamp: new Date(parseInt(e.timestamp) * 1000),
    })),

    intentScore: s.intentScore || 0,
    fillRate,
    speedScore,
    volumeScore,
    disputeScore,

    timeoutRate: s.disputeRate || 0, // Simplified - in reality would be separate
    disputeRate: s.disputeRate || 0,
    avgSettlementTime: s.avgSettlementTime || 0,
    totalFills: s.totalFills || 0,

    lastActive: new Date(parseInt(s.lastActiveTime || '0') * 1000),
    registeredAt: new Date(parseInt(s.registrationTime || '0') * 1000),

    recentReceipts: (s.receipts || []).map(r => ({
      id: r.id,
      intentHash: r.intentHash,
      status: mapReceiptStatus(r.status),
      postedAt: new Date(parseInt(r.postedAt) * 1000),
      finalizedAt: r.finalizedAt ? new Date(parseInt(r.finalizedAt) * 1000) : null,
      settlementTime: r.settlementTime,
    })),

    slashEvents: (s.slashEvents || []).map(e => ({
      id: e.id,
      receiptId: e.receiptId,
      amount: (parseFloat(e.amount) / 1e18).toFixed(3),
      reason: REASON_LABELS[e.reason] || 'Unknown',
      reasonCode: e.reason,
      timestamp: new Date(parseInt(e.timestamp) * 1000),
      txHash: e.txHash,
    })),
  }
}

// No demo data - show real subgraph data only

// Default for unknown solvers
const DEFAULT_OPERATOR: OperatorData = {
  solverId: '0x0000000000000000000000000000000000000000',
  name: 'Unknown Operator',
  operatorAddress: '0x0000000000000000000000000000000000000000',
  metadataURI: '',
  status: 'Inactive',
  bondBalance: '0.0',
  availableBond: '0.0',
  lockedBond: '0.0',
  isAboveMinimum: false,
  recentBondEvents: [],
  intentScore: 0,
  fillRate: 0,
  speedScore: 0,
  volumeScore: 0,
  disputeScore: 0,
  timeoutRate: 0,
  disputeRate: 0,
  avgSettlementTime: 0,
  totalFills: 0,
  lastActive: new Date(0),
  registeredAt: new Date(0),
  recentReceipts: [],
  slashEvents: [],
}

// Validate bytes32 hex string (solver IDs are bytes32)
function isValidSolverId(id: string): boolean {
  // Must be 0x followed by 64 hex characters (32 bytes)
  return /^0x[a-fA-F0-9]{64}$/.test(id)
}

export async function fetchOperatorData(solverId: string): Promise<OperatorData> {
  // Validate solverId format before querying (injection prevention)
  if (!isValidSolverId(solverId)) {
    return {
      ...DEFAULT_OPERATOR,
      solverId: solverId,
      operatorAddress: solverId,
    }
  }

  try {
    const data = await graphqlClient.request<SubgraphDetailResponse>(SOLVER_DETAIL_QUERY, {
      id: solverId.toLowerCase(),
    })

    if (data.solver) {
      return await transformOperatorData(data.solver)
    }
  } catch (error) {
    console.warn('Subgraph unavailable, using demo data:', error)
  }

  // No demo data - return default for unknown solvers
  return {
    ...DEFAULT_OPERATOR,
    solverId: solverId,
    operatorAddress: solverId,
  }
}
