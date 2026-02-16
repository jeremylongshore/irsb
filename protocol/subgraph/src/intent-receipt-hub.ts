import { BigInt, BigDecimal, Bytes } from "@graphprotocol/graph-ts";
import {
  ReceiptPosted,
  ReceiptFinalized,
  DisputeOpened,
  DisputeResolved,
} from "../generated/IntentReceiptHub/IntentReceiptHub";
import { Receipt, Dispute, Solver, ProtocolStats, DailyStats } from "../generated/schema";

// Helper to get or create protocol stats
function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("stats");
  if (!stats) {
    stats = new ProtocolStats("stats");
    stats.totalSolvers = 0;
    stats.activeSolvers = 0;
    stats.jailedSolvers = 0;
    stats.bannedSolvers = 0;
    stats.totalBonded = BigInt.zero();
    stats.totalSlashed = BigInt.zero();
    stats.totalReceipts = BigInt.zero();
    stats.totalDisputes = BigInt.zero();
    stats.lastUpdated = BigInt.zero();
  }
  return stats;
}

// Helper to get or create daily stats
function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayId = timestamp.div(BigInt.fromI32(86400)).toString();
  let stats = DailyStats.load(dayId);
  if (!stats) {
    stats = new DailyStats(dayId);
    stats.date = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400));
    stats.newSolvers = 0;
    stats.receiptsPosted = 0;
    stats.disputesOpened = 0;
    stats.slashEvents = 0;
    stats.slashAmount = BigInt.zero();
    stats.bondDeposited = BigInt.zero();
    stats.bondWithdrawn = BigInt.zero();
  }
  return stats;
}

// Helper to calculate IntentScore (0-100)
function calculateIntentScore(solver: Solver): i32 {
  let fillRate = solver.totalFills.gt(BigInt.zero())
    ? solver.successfulFills.times(BigInt.fromI32(100)).div(solver.totalFills).toI32()
    : 50;

  let disputePenalty = solver.disputesLost.toI32() * 10;
  if (disputePenalty > 30) disputePenalty = 30;

  let score = fillRate - disputePenalty;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

export function handleReceiptPosted(event: ReceiptPosted): void {
  let receipt = new Receipt(event.params.receiptId);
  receipt.solver = event.params.solverId;
  receipt.intentHash = event.params.intentHash;
  receipt.solverId = event.params.solverId;
  receipt.expiry = event.params.expiry;
  receipt.postedAt = event.block.timestamp;
  receipt.status = "Pending";
  receipt.save();

  // Update solver stats
  let solver = Solver.load(event.params.solverId);
  if (solver) {
    solver.totalFills = solver.totalFills.plus(BigInt.fromI32(1));
    solver.lastActiveTime = event.block.timestamp;
    solver.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalReceipts = stats.totalReceipts.plus(BigInt.fromI32(1));
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.receiptsPosted += 1;
  daily.save();
}

export function handleReceiptFinalized(event: ReceiptFinalized): void {
  let receipt = Receipt.load(event.params.receiptId);
  if (!receipt) return;

  receipt.status = "Finalized";
  receipt.resolvedAt = event.block.timestamp;
  receipt.save();

  // Update solver successful fills
  let solver = Solver.load(event.params.solverId);
  if (solver) {
    solver.successfulFills = solver.successfulFills.plus(BigInt.fromI32(1));

    // Update fill rate
    if (solver.totalFills.gt(BigInt.zero())) {
      let rate = solver.successfulFills
        .times(BigInt.fromI32(10000))
        .div(solver.totalFills);
      solver.fillRate = rate.toBigDecimal().div(BigInt.fromI32(100).toBigDecimal());
    }

    solver.intentScore = calculateIntentScore(solver);
    solver.save();
  }
}

export function handleDisputeOpened(event: DisputeOpened): void {
  // Update receipt
  let receipt = Receipt.load(event.params.receiptId);
  if (!receipt) return;

  receipt.status = "Disputed";
  receipt.challenger = event.params.challenger;
  receipt.disputeReason = event.params.reason;
  receipt.disputeOpenedAt = event.block.timestamp;
  receipt.save();

  // Create dispute entity
  let dispute = new Dispute(event.params.receiptId);
  dispute.receipt = event.params.receiptId;
  dispute.solverId = event.params.solverId;
  dispute.challenger = event.params.challenger;
  dispute.reason = event.params.reason;
  dispute.openedAt = event.block.timestamp;
  dispute.resolved = false;
  dispute.escalated = false;
  dispute.evidenceHashes = [];
  dispute.arbitrationResolved = false;
  dispute.save();

  // Update solver disputes opened
  let solver = Solver.load(event.params.solverId);
  if (solver) {
    solver.disputesOpened = solver.disputesOpened.plus(BigInt.fromI32(1));
    solver.lastActiveTime = event.block.timestamp;
    solver.save();
  }

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalDisputes = stats.totalDisputes.plus(BigInt.fromI32(1));
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.disputesOpened += 1;
  daily.save();
}

export function handleDisputeResolved(event: DisputeResolved): void {
  // Update receipt
  let receipt = Receipt.load(event.params.receiptId);
  if (!receipt) return;

  receipt.slashed = event.params.slashed;
  receipt.slashAmount = event.params.slashAmount;
  receipt.resolvedAt = event.block.timestamp;
  receipt.status = event.params.slashed ? "Slashed" : "Finalized";
  receipt.save();

  // Update dispute
  let dispute = Dispute.load(event.params.receiptId);
  if (dispute) {
    dispute.resolved = true;
    dispute.slashed = event.params.slashed;
    dispute.slashAmount = event.params.slashAmount;
    dispute.resolvedAt = event.block.timestamp;
    dispute.save();
  }

  // Update solver stats
  let solver = Solver.load(event.params.solverId);
  if (solver) {
    if (event.params.slashed) {
      // Solver lost the dispute
      solver.disputesLost = solver.disputesLost.plus(BigInt.fromI32(1));
    } else {
      // Solver won - count as successful fill
      solver.successfulFills = solver.successfulFills.plus(BigInt.fromI32(1));
    }

    // Update fill rate
    if (solver.totalFills.gt(BigInt.zero())) {
      let rate = solver.successfulFills
        .times(BigInt.fromI32(10000))
        .div(solver.totalFills);
      solver.fillRate = rate.toBigDecimal().div(BigInt.fromI32(100).toBigDecimal());
    }

    solver.intentScore = calculateIntentScore(solver);
    solver.save();
  }

  // Update daily stats if slashed
  if (event.params.slashed) {
    let daily = getOrCreateDailyStats(event.block.timestamp);
    daily.slashEvents += 1;
    daily.slashAmount = daily.slashAmount.plus(event.params.slashAmount);
    daily.save();
  }
}
