/**
 * IRSB Wallet-Grade API
 *
 * Three endpoints for wallet integration enabling risk-aware solver selection:
 * - riskScore: Risk scoring for relayer selection
 * - recentReceipts: Proof of recent execution
 * - activeBond: Bond adequacy check
 */

import { GraphQLClient, gql } from 'graphql-request';

// ============ Types ============

export interface RiskScore {
  /** Risk score 0-100 (higher = safer) */
  score: number;
  /** Bond level classification */
  bondLevel: 'low' | 'medium' | 'high';
  /** Number of disputes in last 30 days */
  recentDisputes: number;
  /** Number of slashes in last 30 days */
  recentSlashes: number;
  /** Solver status */
  status: 'Active' | 'Jailed' | 'Banned' | 'Inactive';
  /** Dispute rate (disputesLost / totalFills) */
  disputeRate: number;
  /** Total fills */
  totalFills: number;
}

export interface Receipt {
  /** Receipt ID */
  id: string;
  /** Intent hash */
  intentHash: string;
  /** Receipt status */
  status: 'Pending' | 'Disputed' | 'Finalized' | 'Slashed';
  /** Posted timestamp */
  postedAt: bigint;
  /** Finalized timestamp (if finalized) */
  finalizedAt: bigint | null;
  /** Settlement time in seconds */
  settlementTime: bigint | null;
}

export interface RecentReceiptsResponse {
  /** Array of recent receipts */
  receipts: Receipt[];
  /** Success rate (finalized / total) */
  successRate: number;
  /** Average settlement time in seconds */
  avgSettlementTime: number;
}

export interface BondStatus {
  /** Total bond in wei */
  totalBond: bigint;
  /** Available (unlocked) bond in wei */
  availableBond: bigint;
  /** Locked bond in wei (during disputes) */
  lockedBond: bigint;
  /** Whether bond meets minimum threshold */
  isAboveMinimum: boolean;
  /** Coverage ratio (bond / 30-day volume) */
  coverageRatio: number;
  /** Recent bond events */
  recentEvents: Array<{
    type: 'Deposit' | 'Withdrawal';
    amount: bigint;
    timestamp: bigint;
  }>;
}

// ============ GraphQL Queries ============

const RISK_SCORE_QUERY = gql`
  query RiskScore($executor: Bytes!) {
    solver(id: $executor) {
      id
      bondBalance
      lockedBalance
      status
      riskScore
      disputeRate
      totalFills
      disputesOpened
      disputesLost
      totalSlashed
      lastActiveTime
      slashEvents(
        first: 10
        orderBy: timestamp
        orderDirection: desc
        where: { timestamp_gt: $thirtyDaysAgo }
      ) {
        id
        amount
        timestamp
      }
    }
  }
`;

const RECENT_RECEIPTS_QUERY = gql`
  query RecentReceipts($executor: Bytes!, $limit: Int!) {
    receipts(
      where: { solverId: $executor }
      orderBy: postedAt
      orderDirection: desc
      first: $limit
    ) {
      id
      intentHash
      status
      postedAt
      finalizedAt
      settlementTime
    }
    solver(id: $executor) {
      successfulFills
      totalFills
      avgSettlementTime
    }
  }
`;

const BOND_STATUS_QUERY = gql`
  query BondStatus($executor: Bytes!) {
    solver(id: $executor) {
      bondBalance
      lockedBalance
      isAboveMinimum
      coverageRatio
      bondEvents(
        first: 10
        orderBy: timestamp
        orderDirection: desc
      ) {
        eventType
        amount
        timestamp
      }
    }
  }
`;

// ============ Constants ============

const MINIMUM_BOND = BigInt('100000000000000000'); // 0.1 ETH
const BOND_THRESHOLD_MEDIUM = BigInt('500000000000000000'); // 0.5 ETH
const BOND_THRESHOLD_HIGH = BigInt('1000000000000000000'); // 1.0 ETH

// ============ Wallet API Class ============

export class WalletApi {
  private client: GraphQLClient;

  constructor(subgraphUrl: string) {
    this.client = new GraphQLClient(subgraphUrl);
  }

  /**
   * Get risk score for a solver/relayer
   *
   * @param executor - Solver address or ID
   * @returns Risk scoring data for relayer selection
   *
   * @example
   * ```ts
   * const api = new WalletApi('https://api.thegraph.com/subgraphs/name/...');
   * const risk = await api.getRiskScore('0x...');
   * if (risk.score < 50) {
   *   console.log('Warning: Low trust solver');
   * }
   * ```
   */
  async getRiskScore(executor: string): Promise<RiskScore> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    try {
      const data = await this.client.request<any>(RISK_SCORE_QUERY, {
        executor: executor.toLowerCase(),
        thirtyDaysAgo: thirtyDaysAgo.toString(),
      });

      if (!data.solver) {
        return {
          score: 0,
          bondLevel: 'low',
          recentDisputes: 0,
          recentSlashes: 0,
          status: 'Inactive',
          disputeRate: 0,
          totalFills: 0,
        };
      }

      const solver = data.solver;
      const bondBalance = BigInt(solver.bondBalance);

      // Determine bond level
      let bondLevel: 'low' | 'medium' | 'high';
      if (bondBalance >= BOND_THRESHOLD_HIGH) {
        bondLevel = 'high';
      } else if (bondBalance >= BOND_THRESHOLD_MEDIUM) {
        bondLevel = 'medium';
      } else {
        bondLevel = 'low';
      }

      // Count recent slashes
      const recentSlashes = solver.slashEvents?.length || 0;

      return {
        score: solver.riskScore || 0,
        bondLevel,
        recentDisputes: Number(solver.disputesOpened) || 0,
        recentSlashes,
        status: solver.status || 'Inactive',
        disputeRate: parseFloat(solver.disputeRate) || 0,
        totalFills: Number(solver.totalFills) || 0,
      };
    } catch (error) {
      console.error('Failed to fetch risk score:', error);
      throw error;
    }
  }

  /**
   * Get recent receipts for a solver
   *
   * @param executor - Solver address or ID
   * @param limit - Maximum number of receipts to return (default: 10)
   * @returns Recent receipts with success rate and timing metrics
   *
   * @example
   * ```ts
   * const receipts = await api.getRecentReceipts('0x...', 20);
   * console.log(`Success rate: ${receipts.successRate}%`);
   * console.log(`Avg settlement: ${receipts.avgSettlementTime}s`);
   * ```
   */
  async getRecentReceipts(
    executor: string,
    limit: number = 10
  ): Promise<RecentReceiptsResponse> {
    try {
      const data = await this.client.request<any>(RECENT_RECEIPTS_QUERY, {
        executor: executor.toLowerCase(),
        limit,
      });

      const receipts: Receipt[] = (data.receipts || []).map((r: any) => ({
        id: r.id,
        intentHash: r.intentHash,
        status: r.status,
        postedAt: BigInt(r.postedAt),
        finalizedAt: r.finalizedAt ? BigInt(r.finalizedAt) : null,
        settlementTime: r.settlementTime ? BigInt(r.settlementTime) : null,
      }));

      const solver = data.solver;
      const totalFills = Number(solver?.totalFills) || 0;
      const successfulFills = Number(solver?.successfulFills) || 0;
      const successRate = totalFills > 0 ? (successfulFills / totalFills) * 100 : 0;
      const avgSettlementTime = Number(solver?.avgSettlementTime) || 0;

      return {
        receipts,
        successRate: Math.round(successRate * 100) / 100,
        avgSettlementTime,
      };
    } catch (error) {
      console.error('Failed to fetch recent receipts:', error);
      throw error;
    }
  }

  /**
   * Get active bond status for a solver
   *
   * @param executor - Solver address or ID
   * @returns Bond balance, lock status, and recent events
   *
   * @example
   * ```ts
   * const bond = await api.getActiveBond('0x...');
   * if (!bond.isAboveMinimum) {
   *   console.log('Warning: Bond below minimum threshold');
   * }
   * ```
   */
  async getActiveBond(executor: string): Promise<BondStatus> {
    try {
      const data = await this.client.request<any>(BOND_STATUS_QUERY, {
        executor: executor.toLowerCase(),
      });

      if (!data.solver) {
        return {
          totalBond: BigInt(0),
          availableBond: BigInt(0),
          lockedBond: BigInt(0),
          isAboveMinimum: false,
          coverageRatio: 0,
          recentEvents: [],
        };
      }

      const solver = data.solver;
      const bondBalance = BigInt(solver.bondBalance);
      const lockedBalance = BigInt(solver.lockedBalance);

      const recentEvents = (solver.bondEvents || []).map((e: any) => ({
        type: e.eventType as 'Deposit' | 'Withdrawal',
        amount: BigInt(e.amount),
        timestamp: BigInt(e.timestamp),
      }));

      return {
        totalBond: bondBalance + lockedBalance,
        availableBond: bondBalance,
        lockedBond: lockedBalance,
        isAboveMinimum: solver.isAboveMinimum || bondBalance >= MINIMUM_BOND,
        coverageRatio: parseFloat(solver.coverageRatio) || 0,
        recentEvents,
      };
    } catch (error) {
      console.error('Failed to fetch bond status:', error);
      throw error;
    }
  }

  /**
   * Check if solver is safe to use based on combined metrics
   *
   * @param executor - Solver address or ID
   * @returns boolean indicating if solver passes safety checks
   *
   * @example
   * ```ts
   * if (await api.isSolverSafe('0x...')) {
   *   // Proceed with intent
   * }
   * ```
   */
  async isSolverSafe(executor: string): Promise<boolean> {
    const [risk, bond] = await Promise.all([
      this.getRiskScore(executor),
      this.getActiveBond(executor),
    ]);

    return (
      risk.score >= 50 &&
      risk.status === 'Active' &&
      risk.recentSlashes === 0 &&
      bond.isAboveMinimum
    );
  }
}

// ============ Utility Functions ============

/**
 * Create a wallet API instance for a specific subgraph
 */
export function createWalletApi(subgraphUrl: string): WalletApi {
  return new WalletApi(subgraphUrl);
}

/**
 * Default subgraph URLs by network
 */
export const SUBGRAPH_URLS: Record<string, string> = {
  sepolia: 'https://api.studio.thegraph.com/query/XXXXX/irsb-sepolia/version/latest',
  mainnet: 'https://api.studio.thegraph.com/query/XXXXX/irsb-mainnet/version/latest',
};
