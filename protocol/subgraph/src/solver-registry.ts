import { BigInt, BigDecimal, Bytes } from "@graphprotocol/graph-ts";
import {
  SolverRegistered,
  BondDeposited,
  BondWithdrawn,
  SolverSlashed,
  SolverStatusChanged,
} from "../generated/SolverRegistry/SolverRegistry";
import { Solver, SlashEvent, BondEvent, ProtocolStats, DailyStats } from "../generated/schema";

// Status enum values (matches Types.SolverStatus in contract)
const STATUS_UNREGISTERED = 0;
const STATUS_ACTIVE = 1;
const STATUS_JAILED = 2;
const STATUS_BANNED = 3;
const STATUS_WITHDRAWING = 4;

// Helper to get status string
function getStatusString(status: i32): string {
  switch (status) {
    case STATUS_ACTIVE:
      return "Active";
    case STATUS_JAILED:
      return "Jailed";
    case STATUS_BANNED:
      return "Banned";
    case STATUS_WITHDRAWING:
      return "Withdrawing";
    default:
      return "Unregistered";
  }
}

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
    stats.totalFinalized = BigInt.zero();
    stats.avgSettlementTime = BigInt.zero();
    stats.avgDisputeRate = BigDecimal.zero();
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
    stats.receiptsFinalized = 0;
    stats.disputesOpened = 0;
    stats.disputesResolved = 0;
    stats.slashEvents = 0;
    stats.slashAmount = BigInt.zero();
    stats.bondDeposited = BigInt.zero();
    stats.bondWithdrawn = BigInt.zero();
    stats.avgSettlementTime = BigInt.zero();
  }
  return stats;
}

// Helper to calculate IntentScore (0-100)
function calculateIntentScore(solver: Solver): i32 {
  let fillRate = solver.totalFills.gt(BigInt.zero())
    ? solver.successfulFills.times(BigInt.fromI32(100)).div(solver.totalFills).toI32()
    : 50; // Default 50% for new solvers

  // Dispute penalty: lose 10 points per dispute lost
  let disputePenalty = solver.disputesLost.toI32() * 10;
  if (disputePenalty > 30) disputePenalty = 30; // Cap at 30

  let score = fillRate - disputePenalty;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

export function handleSolverRegistered(event: SolverRegistered): void {
  let solver = new Solver(event.params.solverId);
  solver.operator = event.params.operator;
  solver.metadataURI = event.params.metadataURI;
  solver.bondBalance = BigInt.zero();
  solver.lockedBalance = BigInt.zero();
  solver.registrationTime = event.block.timestamp;
  solver.lastActiveTime = event.block.timestamp;
  solver.totalFills = BigInt.zero();
  solver.successfulFills = BigInt.zero();
  solver.disputesOpened = BigInt.zero();
  solver.disputesLost = BigInt.zero();
  solver.volumeProcessed = BigInt.zero();
  solver.totalSlashed = BigInt.zero();
  solver.status = "Active";
  solver.fillRate = BigDecimal.zero();
  solver.intentScore = 50; // Starting score
  solver.riskScore = 50; // Starting risk score (50 = neutral)
  solver.disputeRate = BigDecimal.zero();
  solver.avgSettlementTime = BigInt.zero();
  solver.isAboveMinimum = false; // Will be true after bond deposit
  solver.coverageRatio = BigDecimal.zero();
  solver.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalSolvers += 1;
  stats.activeSolvers += 1;
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.newSolvers += 1;
  daily.save();
}

// Minimum bond: 0.1 ETH = 100000000000000000 wei
let MINIMUM_BOND = BigInt.fromString("100000000000000000");

export function handleBondDeposited(event: BondDeposited): void {
  let solver = Solver.load(event.params.solverId);
  if (!solver) return;

  let previousBalance = solver.bondBalance;
  solver.bondBalance = event.params.newBalance;
  solver.lastActiveTime = event.block.timestamp;
  solver.isAboveMinimum = solver.bondBalance.ge(MINIMUM_BOND);
  solver.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalBonded = stats.totalBonded.plus(event.params.amount);
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.bondDeposited = daily.bondDeposited.plus(event.params.amount);
  daily.save();

  // Create bond event
  let bondEvent = new BondEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  bondEvent.solver = event.params.solverId;
  bondEvent.eventType = "Deposit";
  bondEvent.amount = event.params.amount;
  bondEvent.newBalance = event.params.newBalance;
  bondEvent.timestamp = event.block.timestamp;
  bondEvent.txHash = event.transaction.hash;
  bondEvent.save();
}

export function handleBondWithdrawn(event: BondWithdrawn): void {
  let solver = Solver.load(event.params.solverId);
  if (!solver) return;

  solver.bondBalance = event.params.newBalance;
  solver.lastActiveTime = event.block.timestamp;
  solver.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalBonded = stats.totalBonded.minus(event.params.amount);
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.bondWithdrawn = daily.bondWithdrawn.plus(event.params.amount);
  daily.save();

  // Create bond event
  let bondEvent = new BondEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  bondEvent.solver = event.params.solverId;
  bondEvent.eventType = "Withdrawal";
  bondEvent.amount = event.params.amount;
  bondEvent.newBalance = event.params.newBalance;
  bondEvent.timestamp = event.block.timestamp;
  bondEvent.txHash = event.transaction.hash;
  bondEvent.save();
}

export function handleSolverSlashed(event: SolverSlashed): void {
  let solver = Solver.load(event.params.solverId);
  if (!solver) return;

  solver.bondBalance = solver.bondBalance.minus(event.params.amount);
  solver.totalSlashed = solver.totalSlashed.plus(event.params.amount);
  solver.lastActiveTime = event.block.timestamp;
  solver.intentScore = calculateIntentScore(solver);
  solver.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();
  stats.totalBonded = stats.totalBonded.minus(event.params.amount);
  stats.totalSlashed = stats.totalSlashed.plus(event.params.amount);
  stats.lastUpdated = event.block.timestamp;
  stats.save();

  // Update daily stats
  let daily = getOrCreateDailyStats(event.block.timestamp);
  daily.slashEvents += 1;
  daily.slashAmount = daily.slashAmount.plus(event.params.amount);
  daily.save();

  // Create slash event
  let slashEvent = new SlashEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  slashEvent.solver = event.params.solverId;
  slashEvent.amount = event.params.amount;
  slashEvent.receiptId = event.params.receiptId;
  slashEvent.reason = event.params.reason;
  slashEvent.timestamp = event.block.timestamp;
  slashEvent.txHash = event.transaction.hash;
  slashEvent.save();
}

export function handleSolverStatusChanged(event: SolverStatusChanged): void {
  let solver = Solver.load(event.params.solverId);
  if (!solver) return;

  let oldStatus = event.params.oldStatus;
  let newStatus = event.params.newStatus;

  solver.status = getStatusString(newStatus);
  solver.lastActiveTime = event.block.timestamp;
  solver.intentScore = calculateIntentScore(solver);
  solver.save();

  // Update protocol stats
  let stats = getOrCreateProtocolStats();

  // Decrement old status counter
  if (oldStatus == STATUS_ACTIVE) {
    stats.activeSolvers -= 1;
  } else if (oldStatus == STATUS_JAILED) {
    stats.jailedSolvers -= 1;
  } else if (oldStatus == STATUS_BANNED) {
    stats.bannedSolvers -= 1;
  }

  // Increment new status counter
  if (newStatus == STATUS_ACTIVE) {
    stats.activeSolvers += 1;
  } else if (newStatus == STATUS_JAILED) {
    stats.jailedSolvers += 1;
  } else if (newStatus == STATUS_BANNED) {
    stats.bannedSolvers += 1;
  }

  stats.lastUpdated = event.block.timestamp;
  stats.save();
}
