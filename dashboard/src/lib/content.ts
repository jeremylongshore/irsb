/**
 * Centralized factual data for all website pages.
 * All values sourced from protocol CLAUDE.md, AI-CONTEXT.md, and contract code.
 */

// ─── Protocol Parameters ────────────────────────────────────────────────────

export const PROTOCOL_PARAMS = {
  minimumBond: '0.1 ETH',
  challengeWindow: '1 hour',
  withdrawalCooldown: '7 days',
  maxJails: 3,
  counterBondWindow: '24 hours',
  arbitrationTimeout: '7 days',
} as const

// ─── Slashing Distribution ──────────────────────────────────────────────────

export const SLASHING_STANDARD = {
  user: 80,
  challenger: 15,
  treasury: 5,
} as const

export const SLASHING_ARBITRATION = {
  user: 70,
  treasury: 20,
  arbitrator: 10,
} as const

// ─── Contract Addresses (Sepolia) ───────────────────────────────────────────

export const CONTRACTS = {
  solverRegistry: '0xB6ab964832808E49635fF82D1996D6a888ecB745',
  intentReceiptHub: '0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c',
  disputeModule: '0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D',
  erc8004Registry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  walletDelegate: '0x6e7262bA8eE3e722aD5f83Ad793f3c071A3769cB',
  x402Facilitator: '0x0CDf48B293cdee132918cFb3a976aA6da59f4E6F',
  spendLimitEnforcer: '0x8eBAF3db4785C3E8DFABa1A77Ee6373eD5D38F8D',
  timeWindowEnforcer: '0x51DF412e99E9066B1B3Cab81a1756239659207B4',
  allowedTargetsEnforcer: '0x80a18b93014E0a2A3Af025C7Fa2213E24e9E2A2b',
  allowedMethodsEnforcer: '0x633aC1d114e18d1F1fC1De30a6aF37fe1AE91ddf',
  nonceEnforcer: '0x02962c406A7a29adF26F40657b111B90c236DbF1',
} as const

export const OPERATIONAL_ACCOUNTS = {
  deployer: '0x83A5F432f02B1503765bB61a9B358942d87c9dc0',
  solverId: '0xdf816d7b86303c3452e53d84aaa02c01b0de6ae23c1e518bd2642870f9f7603b',
  safeOwner: '0xBcA0c8d0B5ce874a9E3D84d49f3614bb79189959',
  erc8004AgentId: 967,
} as const

export const EXPLORER_BASE = 'https://sepolia.etherscan.io'

// ─── Repositories ───────────────────────────────────────────────────────────

export interface RepoInfo {
  name: string
  slug: string
  github: string
  description: string
  techStack: string
  status: string
}

export const REPOS: RepoInfo[] = [
  {
    name: 'Protocol',
    slug: 'irsb-protocol',
    github: 'https://github.com/intent-solutions-io/irsb-protocol',
    description: 'On-chain contracts: receipts, bonds, disputes, escrow',
    techStack: 'Solidity 0.8.25, Foundry',
    status: 'Deployed (Sepolia)',
  },
  {
    name: 'Solver',
    slug: 'irsb-solver',
    github: 'https://github.com/intent-solutions-io/irsb-solver',
    description: 'Execute intents, produce evidence, submit receipts',
    techStack: 'TypeScript, Express',
    status: 'v0.1.0 — chain-connected',
  },
  {
    name: 'Watchtower',
    slug: 'irsb-watchtower',
    github: 'https://github.com/intent-solutions-io/irsb-watchtower',
    description: 'Monitor receipts, detect violations, file disputes',
    techStack: 'TypeScript, Fastify (pnpm monorepo)',
    status: 'v0.3.0 — chain-connected',
  },
  {
    name: 'Agent Passkey',
    slug: 'irsb-agent-passkey',
    github: 'https://github.com/intent-solutions-io/irsb-agent-passkey',
    description: 'Policy-gated signing via Lit Protocol PKP (deprecated — replaced by Cloud KMS + EIP-7702 delegation)',
    techStack: 'TypeScript, Fastify',
    status: 'Deprecated',
  },
]

// ─── System Status (single source of truth for badges) ──────────────────────

export type StatusLevel = 'live' | 'deployed' | 'infrastructure' | 'development' | 'planned'

export interface SystemStatus {
  label: string
  level: StatusLevel
  badgeClass: string
}

export const SYSTEM_STATUS: Record<string, SystemStatus> = {
  protocol: {
    label: 'Live on Sepolia',
    level: 'live',
    badgeClass: 'bg-green-900/50 text-green-300',
  },
  solver: {
    label: 'v0.1.0 — chain-connected (Cloud KMS)',
    level: 'deployed',
    badgeClass: 'bg-blue-900/50 text-blue-300',
  },
  watchtower: {
    label: 'v0.3.0 — chain-connected (Cloud KMS)',
    level: 'deployed',
    badgeClass: 'bg-blue-900/50 text-blue-300',
  },
  agentPasskey: {
    label: 'Deprecated (Cloud KMS primary)',
    level: 'development',
    badgeClass: 'bg-amber-900/50 text-amber-300',
  },
  delegation: {
    label: 'EIP-7702 WalletDelegate',
    level: 'live',
    badgeClass: 'bg-green-900/50 text-green-300',
  },
  erc8004Registration: {
    label: 'Registered (Agent ID: 967)',
    level: 'live',
    badgeClass: 'bg-green-900/50 text-green-300',
  },
  erc8004Signals: {
    label: 'Not yet enabled',
    level: 'planned',
    badgeClass: 'bg-zinc-700 text-zinc-400',
  },
} as const

// ─── Ecosystem Banner ───────────────────────────────────────────────────────

export const ECOSYSTEM_SUMMARY = 'Four systems. On-chain guardrails for AI agents.'

export const ECOSYSTEM_COMPONENTS = [
  { key: 'protocol', name: 'Protocol', role: 'Contracts', statusKey: 'protocol' },
  { key: 'solver', name: 'Solver', role: 'Execution', statusKey: 'solver' },
  { key: 'watchtower', name: 'Watchtower', role: 'Monitoring', statusKey: 'watchtower' },
  { key: 'delegation', name: 'Delegation', role: 'Policy Enforcement', statusKey: 'delegation' },
] as const

// ─── Ecosystem Details (expandable cards on homepage) ───────────────────────

export const ECOSYSTEM_DETAILS = [
  {
    key: 'protocol',
    name: 'Protocol',
    problem: 'No Proof or Consequences',
    summary: 'On-chain contracts for receipts, bonds, disputes, and escrow. 3 verified contracts, 308 tests.',
    detail: 'The protocol layer defines how intents become accountable. Solvers register and stake bonds (minimum 0.1 ETH). Every execution produces a cryptographic receipt — V1 with single attestation, V2 with dual EIP-712 signatures and privacy levels. A 1-hour challenge window allows disputes. Deterministic violations (timeouts, wrong amounts) auto-slash. 80% of slashed bonds go to the affected user. Three jailings means permanent ban.',
    techStack: 'Solidity 0.8.25, Foundry',
    statusKey: 'protocol',
  },
  {
    key: 'solver',
    name: 'Solver',
    problem: 'No Execution Engine',
    summary: 'Execute intents, produce evidence, submit receipts. Pluggable job types with CLI and HTTP interfaces.',
    detail: 'The solver picks up intents, executes them, collects evidence of execution, and submits receipts to the protocol. Transactions are signed via Cloud KMS with on-chain policy enforcement through EIP-7702 WalletDelegate — never holds private keys directly. Currently supports the SAFE_REPORT job type with plans for additional execution strategies.',
    techStack: 'TypeScript, Express',
    statusKey: 'solver',
  },
  {
    key: 'watchtower',
    name: 'Watchtower',
    problem: 'No Independent Monitoring',
    summary: 'Monitor receipts, detect violations, file disputes. Rule engine with configurable violation detection.',
    detail: 'The watchtower independently scans on-chain receipts and evaluates them against a configurable rule engine. It detects stale receipts, missed deadlines, and suspicious patterns. When a violation is confirmed, it files a dispute on-chain with supporting evidence. Designed as a pnpm monorepo with separate packages for core logic, chain interaction, and evidence storage.',
    techStack: 'TypeScript, Fastify',
    statusKey: 'watchtower',
  },
  {
    key: 'delegation',
    name: 'Delegation (EIP-7702)',
    problem: 'No On-Chain Policy',
    summary: 'Cloud KMS signing with on-chain policy enforcement via EIP-7702 WalletDelegate and 5 caveat enforcers.',
    detail: 'Signing uses Google Cloud KMS — keys never leave HSM hardware (<100ms signing). On-chain policy enforcement uses EIP-7702 WalletDelegate with 5 caveat enforcers: SpendLimitEnforcer (daily + per-tx limits), TimeWindowEnforcer (session time bounds), AllowedTargetsEnforcer (approved contracts), AllowedMethodsEnforcer (approved selectors), and NonceEnforcer (replay prevention). Buyer-side payments flow through ERC-7715 permissions → EIP-7702 authorization → WalletDelegate → X402Facilitator. Legacy agent-passkey (Lit Protocol PKP) is deprecated but still running on Cloud Run.',
    techStack: 'Solidity, Cloud KMS',
    statusKey: 'delegation',
  },
] as const

// ─── IntentScore Algorithm ──────────────────────────────────────────────────

export const INTENT_SCORE_WEIGHTS = {
  successRate: { weight: 40, label: 'Success Rate', calc: 'successfulTasks / totalTasks' },
  disputeWinRate: { weight: 25, label: 'Dispute Win Rate', calc: '(wins*100 + partials*50) / totalDisputes' },
  stakeFactor: { weight: 20, label: 'Stake Factor', calc: 'min(currentBond, 10 ETH) / 10 ETH' },
  longevity: { weight: 15, label: 'Longevity', calc: 'min(age, 365d) / 365d, halved if inactive 90+ days' },
  slashPenalty: { weight: -5, label: 'Slash Penalty', calc: 'slashCount * 500 bps (max 30%)' },
} as const

// ─── Roadmap Phases ─────────────────────────────────────────────────────────

export interface RoadmapPhase {
  phase: number
  title: string
  status: 'completed' | 'in-progress' | 'planned'
  items: string[]
}

export const ROADMAP: RoadmapPhase[] = [
  {
    phase: 1,
    title: 'Foundation',
    status: 'completed',
    items: [
      'Core contracts deployed to Sepolia (SolverRegistry, IntentReceiptHub, DisputeModule)',
      'V1 receipts with single attestation',
      'Bond staking and deterministic slashing',
      'ERC-8004 agent registration (Agent ID: 967)',
      'TypeScript SDK and CLI tools',
      'Solver dashboard with live data',
    ],
  },
  {
    phase: 2,
    title: 'Advanced Accountability',
    status: 'in-progress',
    items: [
      'V2 receipts with dual attestation (EIP-712)',
      'Optimistic dispute resolution with counter-bonds',
      'EscrowVault for ETH + ERC20',
      'Privacy levels (public, semi-public, private)',
      'x402 HTTP payment integration package',
      'EIP-7702 delegation (WalletDelegate + 5 caveat enforcers)',
    ],
  },
  {
    phase: 3,
    title: 'Hardening',
    status: 'planned',
    items: [
      'Enable ERC-8004 signal publishing in production',
      'Reputation-weighted bonds',
      'Cross-chain identity resolution',
      'Watchtower v1.0 with automated dispute filing',
      'Security audit',
      'Mainnet deployment',
    ],
  },
  {
    phase: 4,
    title: 'Ecosystem Growth',
    status: 'planned',
    items: [
      'First major integration (Across, CoW, or UniswapX)',
      'Submit as ERC/EIP proposal',
      'Multi-chain deployment (Arbitrum, Base, Polygon)',
      'Decentralized arbitrator network',
      'Cross-protocol IntentScore portability',
    ],
  },
]

// ─── Standards Integration ──────────────────────────────────────────────────

export const STANDARDS = [
  {
    name: 'ERC-7683',
    role: 'Intent Format',
    description: 'Defines cross-chain intent format',
    connection: 'IRSB receipts reference intentHash from ERC-7683 orders',
  },
  {
    name: 'ERC-8004',
    role: 'Agent Registry',
    description: 'Agent identity & reputation registry',
    connection: 'IRSB is a Validation Provider — generates signals that feed the registry',
  },
  {
    name: 'x402',
    role: 'HTTP Payments',
    description: 'HTTP 402 payment protocol',
    connection: 'IRSB adds accountability to paid APIs — receipts prove service delivery',
  },
  {
    name: 'EIP-7702',
    role: 'Account Delegation',
    description: 'Allows EOAs to delegate to smart contract code',
    connection: 'IRSB uses EIP-7702 to delegate EOA signing to WalletDelegate, enabling on-chain caveat enforcement for solver and buyer transactions',
  },
  {
    name: 'ERC-7710',
    role: 'Delegation Redemption',
    description: 'Standard for redeeming delegated permissions',
    connection: 'WalletDelegate implements ERC-7710 so delegatees (solvers, facilitators) can redeem delegations with caveat enforcement',
  },
] as const

// ─── FAQ Items ──────────────────────────────────────────────────────────────

export interface FAQItem {
  question: string
  answer: string
  category: 'general' | 'technical' | 'security' | 'integration'
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'What is IRSB?',
    answer: 'IRSB (Intent Receipts & Solver Bonds) provides on-chain guardrails for AI agents and intent-based transactions. It uses EIP-7702 delegation with five caveat enforcers to restrict agent actions, produces cryptographic receipts for every on-chain action, and provides automated dispute resolution through a watchtower monitoring system.',
    category: 'general',
  },
  {
    question: 'How does IRSB relate to ERC-7683?',
    answer: 'ERC-7683 standardizes the cross-chain intent format. IRSB builds on top of it by adding accountability — receipts reference the intentHash from ERC-7683 orders, and solvers must post cryptographic proof of execution.',
    category: 'general',
  },
  {
    question: 'What is a Solver Bond?',
    answer: 'A solver bond is staked ETH collateral (minimum 0.1 ETH) that can be slashed if the solver violates protocol rules. This creates economic "skin in the game" — solvers have a financial incentive to execute intents correctly.',
    category: 'technical',
  },
  {
    question: 'How does the dispute process work?',
    answer: 'After a receipt is posted, there is a 1-hour challenge window. Anyone can open a dispute by providing evidence and a bond. Deterministic violations (timeout, wrong amount) are resolved automatically. Complex disputes use an optimistic resolution with counter-bonds and optional arbitrator escalation.',
    category: 'technical',
  },
  {
    question: 'What happens when a solver is slashed?',
    answer: 'In standard slashing, the solver\'s bond is distributed: 80% to the affected user, 15% to the challenger who filed the dispute, and 5% to the protocol treasury. After 3 jailings, the solver is permanently banned.',
    category: 'security',
  },
  {
    question: 'What is IntentScore?',
    answer: 'IntentScore is an on-chain reputation metric computed from a solver\'s execution history. It combines success rate (40%), dispute win rate (25%), stake factor (20%), and longevity (15%), minus slash penalties. Protocols can query this score to filter solvers before routing intents.',
    category: 'technical',
  },
  {
    question: 'What is ERC-8004?',
    answer: 'ERC-8004 is an Ethereum standard for trustless agent identity and reputation. IRSB acts as a Validation Provider — it publishes signals (receipt finalized, dispute outcome, slashing events) that feed into an agent\'s on-chain reputation.',
    category: 'integration',
  },
  {
    question: 'How does signing work?',
    answer: 'Signing uses Google Cloud KMS — private keys never leave HSM hardware. On-chain policy enforcement uses EIP-7702 WalletDelegate with 5 caveat enforcers: SpendLimitEnforcer, TimeWindowEnforcer, AllowedTargetsEnforcer, AllowedMethodsEnforcer, and NonceEnforcer. Buyer-side payments flow through ERC-7715 permissions to the X402Facilitator. The legacy agent-passkey service (Lit Protocol PKP) is deprecated but still available on Cloud Run.',
    category: 'security',
  },
  {
    question: 'What is x402 integration?',
    answer: 'x402 is an HTTP 402 payment protocol. The irsb-x402 package bridges HTTP payments to IRSB accountability — when a paid API fulfills a request, a receipt is posted proving service delivery. This extends IRSB beyond DeFi to any HTTP-based service.',
    category: 'integration',
  },
  {
    question: 'Is IRSB audited?',
    answer: 'IRSB is currently experimental software deployed on Sepolia testnet. It has 308 passing tests including fuzz tests, but has not yet undergone a formal security audit. A security audit is planned before mainnet deployment.',
    category: 'security',
  },
  {
    question: 'Can I try IRSB today?',
    answer: 'Yes. IRSB contracts are live on Sepolia testnet. You can view live solver data on the Dashboard, install the SDK (npm install irsb), or explore the contracts on Etherscan. All code is open source under MIT license.',
    category: 'general',
  },
  {
    question: 'What chains does IRSB support?',
    answer: 'Currently Sepolia testnet only. The roadmap includes mainnet deployment followed by multi-chain expansion to Arbitrum, Base, and Polygon.',
    category: 'general',
  },
]

// ─── Use Cases ──────────────────────────────────────────────────────────────

export interface UseCase {
  title: string
  category: string
  problem: string
  solution: string
  example: string
}

export const USE_CASES: UseCase[] = [
  {
    title: 'AI Agent Guardrails',
    category: 'AI Agents',
    problem: 'AI agents execute on-chain transactions with wallet access but no spend limits, no audit trail, and no recourse when they act outside their mandate.',
    solution: 'EIP-7702 WalletDelegate with five caveat enforcers restricts agent actions on-chain. Spend limits, time windows, contract and method whitelists are enforced at the EVM level. Every action produces a cryptographic receipt.',
    example: 'An AI trading agent delegates its wallet to WalletDelegate with a 0.01 ETH per-transaction limit and a whitelist of approved DEX contracts. The watchtower monitors receipts and files disputes automatically if violations occur.',
  },
  {
    title: 'DeFi Intent Execution',
    category: 'DeFi',
    problem: 'Users submit swap intents but have no proof solvers executed them correctly. Bad fills go unpunished.',
    solution: 'Solvers post receipts proving execution. Bonds ensure economic accountability. Disputes catch violations automatically.',
    example: 'A user submits a cross-chain swap intent. The solver executes it, posts a V2 receipt with dual attestation, and the receipt finalizes after the 1-hour challenge window.',
  },
  {
    title: 'x402 HTTP Payment Verification',
    category: 'x402',
    problem: 'Paid API services have no on-chain proof of delivery. Users pay but can\'t verify they got what they paid for.',
    solution: 'The irsb-x402 package bridges HTTP 402 payments to IRSB receipts. After a paid API request is fulfilled, a receipt proves service delivery on-chain.',
    example: 'A developer pays for an AI inference API call via x402. The irsb-x402 middleware automatically posts a receipt linking the payment to the response hash.',
  },
  {
    title: 'Portable Agent Reputation',
    category: 'Reputation',
    problem: 'Agent reputation is siloed within individual frameworks. An agent with thousands of successful executions starts at zero on a new platform.',
    solution: 'IRSB publishes validation signals to ERC-8004, creating portable reputation. Any protocol can query an agent\'s IntentScore before granting access.',
    example: 'An agent registers on ERC-8004 (Agent ID: 967), executes actions through IRSB, and builds a queryable on-chain track record visible across all integrated protocols.',
  },
]

// ─── Before vs After Comparison ─────────────────────────────────────────────

export interface ComparisonRow {
  aspect: string
  before: string
  after: string
}

export const COMPARISONS: ComparisonRow[] = [
  {
    aspect: 'Execution Proof',
    before: 'No standardized proof. Solvers claim execution without verifiable evidence.',
    after: 'Cryptographic receipts with intentHash, evidenceHash, and solver signatures on-chain.',
  },
  {
    aspect: 'Solver Accountability',
    before: 'No consequences for bad fills, missed deadlines, or front-running.',
    after: 'Staked bonds (min 0.1 ETH) slashable for violations. 3 strikes = permanent ban.',
  },
  {
    aspect: 'Dispute Resolution',
    before: 'Manual, off-chain complaints. No formal process. Users are on their own.',
    after: '1-hour challenge window. Deterministic auto-slash for timeouts. Optimistic resolution with counter-bonds for complex cases.',
  },
  {
    aspect: 'Solver Reputation',
    before: 'Siloed per protocol. Opaque. Based on informal trust, not data.',
    after: 'On-chain IntentScore. Portable via ERC-8004. Weighted composite of success rate, dispute history, and stake.',
  },
  {
    aspect: 'User Compensation',
    before: 'None. Users absorb losses from bad solver behavior.',
    after: '80% of slashed bond goes to affected user. Challenger gets 15%.',
  },
  {
    aspect: 'Intent Verification',
    before: 'Users trust the solver blindly. No way to audit execution path.',
    after: 'V2 dual attestation (solver + client EIP-712 signatures). Privacy levels for sensitive data.',
  },
  {
    aspect: 'Cross-Protocol Identity',
    before: 'Solvers start from zero reputation on every new protocol.',
    after: 'ERC-8004 agent registration. IRSB publishes validation signals readable by any protocol.',
  },
  {
    aspect: 'Payment Accountability',
    before: 'HTTP payments (x402) have no proof of delivery on-chain.',
    after: 'irsb-x402 package links HTTP 402 payments to on-chain receipts proving service delivery.',
  },
  {
    aspect: 'Key Security',
    before: 'Hot wallets with private keys. Single point of compromise.',
    after: 'Cloud KMS + EIP-7702 WalletDelegate: keys never leave HSM hardware, on-chain caveat enforcers (spend limits, time windows, allowed targets, allowed methods, nonce).',
  },
  {
    aspect: 'Signing Policy',
    before: 'Sign anything requested. No typed action constraints.',
    after: 'EIP-7702 WalletDelegate with 5 caveat enforcers restricts all delegated transactions. SpendLimitEnforcer, TimeWindowEnforcer, AllowedTargetsEnforcer, AllowedMethodsEnforcer, NonceEnforcer.',
  },
]

// ─── Competitor Comparison ──────────────────────────────────────────────────

export type FeatureSupport = 'yes' | 'partial' | 'no'

export interface Competitor {
  name: string
  category: string
  description: string
  approach: string
  irsbDiff: string
  features: Record<string, FeatureSupport>
}

/**
 * Feature keys used as comparison dimensions.
 * Order here determines column order in the comparison table.
 */
export const COMPARISON_FEATURES = [
  'Execution Proof',
  'Bonds / Staking',
  'Dispute Resolution',
  'Reputation Portability',
  'Cross-Protocol',
  'Intent-Specific',
] as const

export type ComparisonFeature = (typeof COMPARISON_FEATURES)[number]

export const IRSB_FEATURES: Record<ComparisonFeature, FeatureSupport> = {
  'Execution Proof': 'yes',
  'Bonds / Staking': 'yes',
  'Dispute Resolution': 'yes',
  'Reputation Portability': 'yes',
  'Cross-Protocol': 'yes',
  'Intent-Specific': 'yes',
}

export const COMPETITORS: Competitor[] = [
  {
    name: 'UniswapX',
    category: 'Intent DEX',
    description:
      "Uniswap's intent-based evolution. Dutch auction orders with massive liquidity. Top 3 solvers handle 90% of volume.",
    approach: 'Internal filler reputation based on fill rate and speed within the UniswapX system.',
    irsbDiff:
      'Internal filler reputation only — siloed within UniswapX. No standardized receipts, no dispute process, no portable score.',
    features: {
      'Execution Proof': 'partial',
      'Bonds / Staking': 'no',
      'Dispute Resolution': 'no',
      'Reputation Portability': 'no',
      'Cross-Protocol': 'no',
      'Intent-Specific': 'yes',
    },
  },
  {
    name: 'CoW Protocol',
    category: 'Intent DEX',
    description:
      'Pioneered batch auctions and MEV protection. Strong solver network with competitive order flow.',
    approach: 'Internal solver scoring based on surplus delivered. Solvers compete in batch auctions.',
    irsbDiff:
      'Internal solver scoring only. No on-chain receipts. No formal dispute mechanism. Reputation stays within CoW.',
    features: {
      'Execution Proof': 'no',
      'Bonds / Staking': 'no',
      'Dispute Resolution': 'no',
      'Reputation Portability': 'no',
      'Cross-Protocol': 'no',
      'Intent-Specific': 'yes',
    },
  },
  {
    name: '1inch Fusion',
    category: 'Intent Aggregator',
    description:
      'Broadest cross-chain support (13+ networks). Gasless swaps since 2022. Top 4 solvers handle ~90% of volume.',
    approach: 'Internal resolver scoring with delegation and staking within the Fusion system.',
    irsbDiff:
      'Internal resolver scoring. No receipts. No dispute resolution. No cross-protocol reputation portability.',
    features: {
      'Execution Proof': 'no',
      'Bonds / Staking': 'no',
      'Dispute Resolution': 'no',
      'Reputation Portability': 'no',
      'Cross-Protocol': 'no',
      'Intent-Specific': 'yes',
    },
  },
  {
    name: 'Across Protocol',
    category: 'Intent Bridge',
    description:
      '$20B+ transferred, 14M+ transactions. Leading intent-based cross-chain bridge with optimistic verification.',
    approach: 'Relayer reputation tracked internally. UMA optimistic oracle for dispute resolution.',
    irsbDiff:
      'Relayer reputation is siloed. No standardized receipt format. Disputes use UMA oracle, not a general-purpose intent dispute system.',
    features: {
      'Execution Proof': 'partial',
      'Bonds / Staking': 'no',
      'Dispute Resolution': 'no',
      'Reputation Portability': 'no',
      'Cross-Protocol': 'no',
      'Intent-Specific': 'yes',
    },
  },
  {
    name: 'Ethos Network',
    category: 'On-chain Reputation',
    description:
      'First major on-chain credibility protocol. Live on Base. Vouching, reviews, slashing, and reputation markets.',
    approach: 'Social/peer-based reputation from reviews, vouches, and attestations. Not tied to execution proof.',
    irsbDiff:
      'Reputation is social and peer-based — earned from reviews, not from provable on-chain execution. IRSB reputation comes from receipts, bonds, and dispute outcomes.',
    features: {
      'Execution Proof': 'no',
      'Bonds / Staking': 'yes',
      'Dispute Resolution': 'partial',
      'Reputation Portability': 'yes',
      'Cross-Protocol': 'yes',
      'Intent-Specific': 'no',
    },
  },
  {
    name: 'EigenLayer',
    category: 'Restaking / Slashing',
    description:
      '$18-20B TVL. Generic slashing infrastructure via restaked ETH for Actively Validated Services (AVSs).',
    approach: 'General-purpose restaking and slashing. AVSs define their own validation conditions.',
    irsbDiff:
      'General-purpose slashing, not intent-specific. No receipt format, no intent dispute resolution, no solver reputation scoring.',
    features: {
      'Execution Proof': 'no',
      'Bonds / Staking': 'yes',
      'Dispute Resolution': 'no',
      'Reputation Portability': 'no',
      'Cross-Protocol': 'yes',
      'Intent-Specific': 'no',
    },
  },
]

// ─── Company Info ───────────────────────────────────────────────────────────

export const COMPANY = {
  name: 'Intent Solutions',
  url: 'https://intentsolutions.io',
  email: 'jeremy@intentsolutions.io',
  github: 'https://github.com/intent-solutions-io',
} as const

// ─── Navigation Structure ───────────────────────────────────────────────────

export interface NavItem {
  name: string
  href: string
  description?: string
}

export interface NavGroup {
  name: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    name: 'Learn',
    items: [
      { name: 'How It Works', href: '/how-it-works', description: 'Visual intent lifecycle in 5 steps' },
      { name: 'Use Cases', href: '/use-cases', description: 'DeFi, AI agents, x402, reputation' },
      { name: 'Before vs After', href: '/before-after', description: 'Side-by-side comparison' },
      { name: 'Comparison', href: '/comparison', description: 'IRSB vs alternatives' },
      { name: 'FAQ', href: '/faq', description: 'Common questions answered' },
      { name: 'One-Pager', href: '/one-pager', description: 'Executive summary' },
    ],
  },
  {
    name: 'Technical',
    items: [
      { name: 'Architecture', href: '/technical', description: 'Contracts, parameters, receipt structs' },
      { name: 'Security', href: '/security', description: 'Bonds, slashing, disputes, identity' },
      { name: 'Ecosystem', href: '/ecosystem', description: 'All 4 repos explained' },
      { name: 'Deployments', href: '/deployments', description: 'Live contracts on Etherscan' },
      { name: 'Roadmap', href: '/roadmap', description: '4-phase timeline' },
    ],
  },
  {
    name: 'Developers',
    items: [
      { name: 'Quickstart', href: '/developers/quickstart', description: '5-minute first receipt' },
      { name: 'SDK Reference', href: '/developers/sdk', description: 'TypeScript SDK API' },
      { name: 'x402 Guide', href: '/developers/x402', description: 'HTTP payment integration' },
      { name: 'Contract Reference', href: '/developers/contracts', description: 'ABI & event reference' },
    ],
  },
]
