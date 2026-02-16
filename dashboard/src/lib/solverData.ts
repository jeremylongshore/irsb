import { graphqlClient, SOLVERS_QUERY, PROTOCOL_STATS_QUERY } from './graphql'

export interface Solver {
  address: string
  name: string
  intentScore: number
  fillRate: number
  avgSpeed: number // seconds
  totalIntents: number
  slashingEvents: number
  bondAmount: string
  status: 'active' | 'jailed' | 'inactive'
  lastActive: Date
}

interface SubgraphSolver {
  id: string
  operator: string
  metadataURI: string
  bondBalance: string
  status: string
  intentScore: number
  fillRate: string // Subgraph returns BigDecimal as string
  avgSettlementTime: string // Subgraph returns BigInt as string
  totalFills: string // Subgraph returns BigInt as string
  lastActiveTime: string
  slashEvents: Array<{ id: string }>
}

interface SubgraphResponse {
  solvers: SubgraphSolver[]
}

// Map subgraph status string to our status
function mapStatus(status: string): 'active' | 'jailed' | 'inactive' {
  switch (status?.toLowerCase()) {
    case 'active': return 'active'
    case 'jailed': return 'jailed'
    case 'banned': return 'inactive'
    default: return 'inactive'
  }
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

// Try to fetch solver name from metadata URI (IPFS/HTTP)
async function fetchSolverName(metadataURI: string, fallback: string): Promise<string> {
  if (!metadataURI) return fallback

  // Validate URL before fetching (SSRF prevention)
  if (!isValidMetadataUrl(metadataURI)) return fallback

  try {
    // Convert IPFS URI to safe HTTP gateway
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

// Transform subgraph data to our Solver interface
async function transformSolver(s: SubgraphSolver): Promise<Solver> {
  const name = await fetchSolverName(s.metadataURI, `Solver ${s.id.slice(0, 8)}`)
  return {
    address: s.id,
    name,
    intentScore: s.intentScore || 0,
    fillRate: parseFloat(s.fillRate || '0'),
    avgSpeed: parseInt(s.avgSettlementTime || '0', 10),
    totalIntents: parseInt(s.totalFills || '0', 10),
    slashingEvents: s.slashEvents?.length || 0,
    bondAmount: (parseFloat(s.bondBalance || '0') / 1e18).toFixed(2),
    status: mapStatus(s.status),
    lastActive: new Date(parseInt(s.lastActiveTime || '0') * 1000),
  }
}

// No demo data - show empty state when subgraph unavailable
// This keeps the site honest rather than showing fake solvers

export async function fetchSolverData(): Promise<Solver[]> {
  try {
    const data = await graphqlClient.request<SubgraphResponse>(SOLVERS_QUERY, {
      first: 100,
    })

    if (data.solvers && data.solvers.length > 0) {
      const solvers = await Promise.all(data.solvers.map(transformSolver))
      return solvers.sort((a, b) => b.intentScore - a.intentScore)
    }
  } catch (error) {
    console.warn('Subgraph unavailable, using demo data:', error)
  }

  // No fake data - return empty array, dashboard shows empty state
  return []
}

export function getScoreClass(score: number): string {
  if (score >= 90) return 'score-excellent'
  if (score >= 75) return 'score-good'
  if (score >= 50) return 'score-warning'
  return 'score-danger'
}

export function getStatusColor(status: Solver['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-900/50 text-green-300 border border-green-700'
    case 'jailed':
      return 'bg-red-900/50 text-red-300 border border-red-700'
    case 'inactive':
      return 'bg-zinc-700 text-zinc-400 border border-zinc-600'
  }
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
