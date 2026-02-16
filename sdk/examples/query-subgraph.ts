/**
 * IRSB SDK - Subgraph Query Examples
 *
 * This example demonstrates how to query IRSB data from The Graph:
 * 1. Get top solvers by IntentScore
 * 2. Get protocol statistics
 * 3. Get solver history
 * 4. Get recent disputes
 */

// Subgraph endpoint (update after deployment)
const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/YOUR_ID/irsb-protocol/version/latest";

/**
 * Query the IRSB subgraph
 */
async function querySubgraph(query: string, variables?: Record<string, any>) {
  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

// ===========================================
// QUERY: TOP SOLVERS BY INTENT SCORE
// ===========================================

async function getTopSolvers(limit: number = 10) {
  const query = `
    query TopSolvers($limit: Int!) {
      solvers(
        first: $limit
        orderBy: intentScore
        orderDirection: desc
        where: { status: Active }
      ) {
        id
        operator
        bondBalance
        intentScore
        fillRate
        totalFills
        successfulFills
        disputesOpened
        disputesLost
        status
        registrationTime
        lastActiveTime
      }
    }
  `;

  const data = await querySubgraph(query, { limit });
  return data.solvers;
}

// ===========================================
// QUERY: PROTOCOL STATISTICS
// ===========================================

async function getProtocolStats() {
  const query = `
    query ProtocolStats {
      protocolStats(id: "stats") {
        totalSolvers
        activeSolvers
        jailedSolvers
        bannedSolvers
        totalBonded
        totalSlashed
        totalReceipts
        totalDisputes
        lastUpdated
      }
    }
  `;

  const data = await querySubgraph(query);
  return data.protocolStats;
}

// ===========================================
// QUERY: DAILY STATISTICS (Last 30 Days)
// ===========================================

async function getDailyStats(days: number = 30) {
  const query = `
    query DailyStats($days: Int!) {
      dailyStats(
        first: $days
        orderBy: date
        orderDirection: desc
      ) {
        id
        date
        newSolvers
        receiptsPosted
        disputesOpened
        slashEvents
        slashAmount
        bondDeposited
        bondWithdrawn
      }
    }
  `;

  const data = await querySubgraph(query, { days });
  return data.dailyStats;
}

// ===========================================
// QUERY: SOLVER PROFILE
// ===========================================

async function getSolverProfile(solverId: string) {
  const query = `
    query SolverProfile($solverId: Bytes!) {
      solver(id: $solverId) {
        id
        operator
        metadataURI
        bondBalance
        lockedBalance
        intentScore
        fillRate
        totalFills
        successfulFills
        disputesOpened
        disputesLost
        volumeProcessed
        totalSlashed
        status
        registrationTime
        lastActiveTime

        # Recent receipts
        receipts(first: 10, orderBy: postedAt, orderDirection: desc) {
          id
          intentHash
          status
          postedAt
          expiry
          slashed
          slashAmount
        }

        # Slash history
        slashEvents(first: 5, orderBy: timestamp, orderDirection: desc) {
          id
          amount
          reason
          receiptId
          timestamp
        }

        # Bond history
        bondEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
          id
          eventType
          amount
          newBalance
          timestamp
        }
      }
    }
  `;

  const data = await querySubgraph(query, { solverId });
  return data.solver;
}

// ===========================================
// QUERY: RECENT DISPUTES
// ===========================================

async function getRecentDisputes(limit: number = 20) {
  const query = `
    query RecentDisputes($limit: Int!) {
      disputes(
        first: $limit
        orderBy: openedAt
        orderDirection: desc
      ) {
        id
        solverId
        challenger
        reason
        openedAt
        resolved
        slashed
        slashAmount
        resolvedAt
        escalated
        escalatedAt
        arbitrator
        arbitrationResolved
        solverFault
        arbitrationReason

        receipt {
          id
          intentHash
          status
        }
      }
    }
  `;

  const data = await querySubgraph(query, { limit });
  return data.disputes;
}

// ===========================================
// QUERY: RECEIPTS BY INTENT
// ===========================================

async function getReceiptsByIntent(intentHash: string) {
  const query = `
    query ReceiptsByIntent($intentHash: Bytes!) {
      receipts(
        where: { intentHash: $intentHash }
        orderBy: postedAt
        orderDirection: desc
      ) {
        id
        solver {
          id
          operator
          intentScore
        }
        intentHash
        solverId
        expiry
        postedAt
        status
        challenger
        disputeReason
        slashed
        slashAmount
        resolvedAt
      }
    }
  `;

  const data = await querySubgraph(query, { intentHash });
  return data.receipts;
}

// ===========================================
// DEMO: RUN ALL QUERIES
// ===========================================

async function main() {
  console.log("IRSB Subgraph Query Examples\n");
  console.log("=".repeat(50));

  try {
    // 1. Protocol Stats
    console.log("\n📊 Protocol Statistics:");
    const stats = await getProtocolStats();
    console.log(`   Total Solvers: ${stats.totalSolvers}`);
    console.log(`   Active Solvers: ${stats.activeSolvers}`);
    console.log(`   Jailed: ${stats.jailedSolvers}`);
    console.log(`   Banned: ${stats.bannedSolvers}`);
    console.log(`   Total Bonded: ${formatEth(stats.totalBonded)} ETH`);
    console.log(`   Total Slashed: ${formatEth(stats.totalSlashed)} ETH`);
    console.log(`   Total Receipts: ${stats.totalReceipts}`);
    console.log(`   Total Disputes: ${stats.totalDisputes}`);

    // 2. Top Solvers
    console.log("\n🏆 Top 5 Solvers by IntentScore:");
    const topSolvers = await getTopSolvers(5);
    topSolvers.forEach((solver: any, i: number) => {
      console.log(
        `   ${i + 1}. Score: ${solver.intentScore} | ` +
          `Fill Rate: ${solver.fillRate}% | ` +
          `Bond: ${formatEth(solver.bondBalance)} ETH | ` +
          `${solver.id.slice(0, 10)}...`
      );
    });

    // 3. Recent Disputes
    console.log("\n⚖️ Recent Disputes:");
    const disputes = await getRecentDisputes(5);
    if (disputes.length === 0) {
      console.log("   No disputes found.");
    } else {
      disputes.forEach((dispute: any) => {
        const status = dispute.resolved
          ? dispute.slashed
            ? "❌ Slashed"
            : "✅ Cleared"
          : "⏳ Pending";
        console.log(
          `   ${status} | Reason: ${dispute.reason} | ` +
            `Receipt: ${dispute.id.slice(0, 10)}...`
        );
      });
    }

    // 4. Daily Stats (last 7 days)
    console.log("\n📈 Last 7 Days:");
    const dailyStats = await getDailyStats(7);
    dailyStats.reverse().forEach((day: any) => {
      const date = new Date(Number(day.date) * 1000)
        .toISOString()
        .split("T")[0];
      console.log(
        `   ${date}: ${day.receiptsPosted} receipts, ` +
          `${day.disputesOpened} disputes, ` +
          `${formatEth(day.slashAmount)} ETH slashed`
      );
    });
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.log("\nMake sure to update SUBGRAPH_URL with your deployed endpoint.");
  }
}

function formatEth(wei: string): string {
  return (Number(wei) / 1e18).toFixed(4);
}

// Run
main().catch(console.error);
