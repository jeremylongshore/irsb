/**
 * Contract ABIs for IRSB Protocol
 * Simplified to essential functions for SDK usage
 */

export const SOLVER_REGISTRY_ABI = [
  // Read functions
  'function MINIMUM_BOND() view returns (uint256)',
  'function WITHDRAWAL_COOLDOWN() view returns (uint64)',
  'function MAX_JAILS() view returns (uint8)',
  'function solvers(address) view returns (uint256 bondAmount, uint256 lockedAmount, uint256 reputation, uint64 registrationTime, uint64 lastActiveTime, uint64 totalIntents, uint64 successfulIntents, uint8 jailCount, uint8 status, uint256 pendingWithdrawal, uint64 withdrawalRequestTime)',
  'function isActiveSolver(address solver) view returns (bool)',
  'function getSolverBond(address solver) view returns (uint256)',
  'function getAvailableBond(address solver) view returns (uint256)',
  'function owner() view returns (address)',

  // Write functions
  'function register() payable',
  'function depositBond() payable',
  'function requestWithdrawal(uint256 amount)',
  'function cancelWithdrawal()',
  'function executeWithdrawal()',
  'function unjail() payable',

  // Events
  'event SolverRegistered(address indexed solver, uint256 bondAmount)',
  'event BondDeposited(address indexed solver, uint256 amount, uint256 newTotal)',
  'event WithdrawalRequested(address indexed solver, uint256 amount)',
  'event WithdrawalExecuted(address indexed solver, uint256 amount)',
  'event WithdrawalCancelled(address indexed solver)',
  'event SolverSlashed(address indexed solver, uint256 amount, bytes32 reason)',
  'event SolverJailed(address indexed solver, uint8 jailCount)',
  'event SolverUnjailed(address indexed solver)',
  'event SolverBanned(address indexed solver)',
] as const;

export const INTENT_RECEIPT_HUB_ABI = [
  // Read functions
  'function challengeWindow() view returns (uint64)',
  'function challengerBondBps() view returns (uint16)',
  'function receipts(bytes32) view returns (address solver, bytes32 intentHash, bytes32 constraintsHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 postedAt, uint64 deadline, bytes solverSig, uint8 status)',
  'function challenges(bytes32) view returns (address challenger, uint8 reason, uint256 bond, uint64 timestamp)',
  'function getReceipt(bytes32 intentHash) view returns (tuple(address solver, bytes32 intentHash, bytes32 constraintsHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 postedAt, uint64 deadline, bytes solverSig, uint8 status))',
  'function getChallenge(bytes32 intentHash) view returns (tuple(address challenger, uint8 reason, uint256 bond, uint64 timestamp))',
  'function solverRegistry() view returns (address)',

  // Write functions
  'function postReceipt(bytes32 intentHash, bytes32 constraintsHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 deadline, bytes solverSig)',
  'function challengeReceipt(bytes32 intentHash, uint8 reason) payable',
  'function finalizeReceipt(bytes32 intentHash)',
  'function resolveDeterministic(bytes32 intentHash, bytes settlementProof)',

  // Events
  'event ReceiptPosted(bytes32 indexed intentHash, address indexed solver, uint64 deadline)',
  'event ReceiptChallenged(bytes32 indexed intentHash, address indexed challenger, uint8 reason, uint256 bond)',
  'event ReceiptFinalized(bytes32 indexed intentHash)',
  'event ReceiptSlashed(bytes32 indexed intentHash, address indexed solver, uint256 slashAmount)',
  'event ChallengeResolved(bytes32 indexed intentHash, bool solverWins)',
] as const;

export const DISPUTE_MODULE_ABI = [
  // Read functions
  'function evidenceWindow() view returns (uint64)',
  'function arbitrationTimeout() view returns (uint64)',
  'function arbitrator() view returns (address)',
  'function disputes(bytes32) view returns (bytes32 intentHash, address challenger, address solver, uint8 reason, bytes32 solverEvidence, bytes32 challengerEvidence, uint64 createdAt, uint64 evidenceDeadline, uint8 status, uint8 resolution)',
  'function getDispute(bytes32 intentHash) view returns (tuple(bytes32 intentHash, address challenger, address solver, uint8 reason, bytes32 solverEvidence, bytes32 challengerEvidence, uint64 createdAt, uint64 evidenceDeadline, uint8 status, uint8 resolution))',

  // Write functions
  'function submitEvidence(bytes32 intentHash, bytes32 evidenceHash)',
  'function escalateToArbitration(bytes32 intentHash)',
  'function resolveArbitration(bytes32 intentHash, uint8 resolution, uint16 solverShareBps)',
  'function resolveByTimeout(bytes32 intentHash)',

  // Events
  'event DisputeCreated(bytes32 indexed intentHash, address indexed challenger, address indexed solver, uint8 reason)',
  'event EvidenceSubmitted(bytes32 indexed intentHash, address indexed submitter, bytes32 evidenceHash)',
  'event DisputeEscalated(bytes32 indexed intentHash)',
  'event DisputeResolved(bytes32 indexed intentHash, uint8 resolution)',
] as const;

// ============ V2 Contract ABIs ============

export const RECEIPT_V2_EXTENSION_ABI = [
  // Read functions
  'function domainSeparator() view returns (bytes32)',
  'function challengeWindow() view returns (uint64)',
  'function challengerBondMin() view returns (uint256)',
  'function getReceiptV2(bytes32 receiptId) view returns (tuple(bytes32 intentHash, bytes32 constraintsHash, bytes32 routeHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 createdAt, uint64 expiry, bytes32 solverId, address client, bytes32 metadataCommitment, string ciphertextPointer, uint8 privacyLevel, bytes32 escrowId, bytes solverSig, bytes clientSig), uint8 status)',
  'function getReceiptsV2BySolver(bytes32 solverId, uint256 offset, uint256 limit) view returns (bytes32[] receiptIds)',
  'function getReceiptsV2ByClient(address client, uint256 offset, uint256 limit) view returns (bytes32[] receiptIds)',
  'function totalReceiptsV2() view returns (uint256)',

  // Write functions
  'function postReceiptV2(tuple(bytes32 intentHash, bytes32 constraintsHash, bytes32 routeHash, bytes32 outcomeHash, bytes32 evidenceHash, uint64 createdAt, uint64 expiry, bytes32 solverId, address client, bytes32 metadataCommitment, string ciphertextPointer, uint8 privacyLevel, bytes32 escrowId, bytes solverSig, bytes clientSig) receipt) returns (bytes32 receiptId)',
  'function finalizeV2(bytes32 receiptId)',
  'function openDisputeV2(bytes32 receiptId, bytes32 reasonHash, bytes32 evidenceHash) payable',

  // Events
  'event ReceiptV2Posted(bytes32 indexed receiptId, bytes32 indexed intentHash, bytes32 indexed solverId, address client, bytes32 metadataCommitment, uint8 privacyLevel, bytes32 escrowId, uint64 expiry)',
  'event ReceiptV2Finalized(bytes32 indexed receiptId, bytes32 indexed solverId)',
  'event ReceiptV2Disputed(bytes32 indexed receiptId, bytes32 indexed solverId, address indexed challenger, bytes32 reasonHash)',
] as const;

export const OPTIMISTIC_DISPUTE_MODULE_ABI = [
  // Read functions
  'function getCounterBondWindow() view returns (uint64)',
  'function getArbitrationTimeout() view returns (uint64)',
  'function getEvidenceWindow() view returns (uint64)',
  'function getArbitrator() view returns (address)',
  'function getDispute(bytes32 disputeId) view returns (tuple(bytes32 receiptId, bytes32 solverId, address challenger, uint256 challengerBond, uint256 counterBond, bytes32 evidenceHash, uint64 openedAt, uint64 counterBondDeadline, uint64 arbitrationDeadline, uint8 status))',
  'function getDisputeStatus(bytes32 disputeId) view returns (uint8)',
  'function canPostCounterBond(bytes32 disputeId) view returns (bool)',
  'function canResolveByTimeout(bytes32 disputeId) view returns (bool)',
  'function getRequiredCounterBond(bytes32 disputeId) view returns (uint256)',
  'function getDisputeByReceipt(bytes32 receiptId) view returns (bytes32 disputeId)',
  'function totalDisputes() view returns (uint256)',

  // Write functions
  'function openOptimisticDispute(bytes32 receiptId, bytes32 evidenceHash) payable returns (bytes32 disputeId)',
  'function postCounterBond(bytes32 disputeId) payable',
  'function resolveByTimeout(bytes32 disputeId)',
  'function resolveContestedByTimeout(bytes32 disputeId)',
  'function resolveByArbitration(bytes32 disputeId, bool solverFault, uint8 slashPercentage, string reason)',
  'function submitEvidence(bytes32 disputeId, bytes32 evidenceHash)',

  // Events
  'event OptimisticDisputeOpened(bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, address challenger, uint256 challengerBond, uint64 counterBondDeadline)',
  'event CounterBondPosted(bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, uint256 counterBond)',
  'event ResolvedByTimeout(bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, address challenger)',
  'event ResolvedByArbitration(bytes32 indexed disputeId, bytes32 indexed receiptId, bool solverFault, uint256 slashAmount, string reason)',
  'event EvidenceSubmitted(bytes32 indexed disputeId, address indexed submitter, bytes32 evidenceHash)',
] as const;

export const ESCROW_VAULT_ABI = [
  // Read functions
  'function getEscrow(bytes32 escrowId) view returns (tuple(bytes32 receiptId, address depositor, address token, uint256 amount, uint64 createdAt, uint64 deadline, uint8 status))',
  'function isActive(bytes32 escrowId) view returns (bool)',
  'function totalEscrows() view returns (uint256)',

  // Write functions (only callable by authorized hub)
  'function createEscrow(bytes32 escrowId, bytes32 receiptId, address depositor, uint64 deadline) payable',
  'function createEscrowERC20(bytes32 escrowId, bytes32 receiptId, address depositor, address token, uint256 amount, uint64 deadline)',
  'function release(bytes32 escrowId, address recipient)',
  'function refund(bytes32 escrowId)',

  // Events
  'event EscrowCreated(bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed depositor, address token, uint256 amount, uint64 deadline)',
  'event EscrowReleased(bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed recipient, uint256 amount)',
  'event EscrowRefunded(bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed depositor, uint256 amount)',
] as const;
