// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IOptimisticDisputeModule } from "../interfaces/IOptimisticDisputeModule.sol";
import { IReceiptV2Extension } from "../interfaces/IReceiptV2Extension.sol";
import { ISolverRegistry } from "../interfaces/ISolverRegistry.sol";
import { IEscrowVault } from "../interfaces/IEscrowVault.sol";
import { Types } from "../libraries/Types.sol";
import { TypesV2 } from "../libraries/TypesV2.sol";

/// @title OptimisticDisputeModule
/// @notice Optimistic dispute resolution with counter-bond mechanism for V2 receipts
/// @dev Challenger opens dispute → Solver has 24h to counter → No counter = challenger wins
contract OptimisticDisputeModule is IOptimisticDisputeModule, Ownable, ReentrancyGuard, Pausable {
    // ============ Constants ============

    /// @notice Counter-bond window (24 hours)
    uint64 public constant COUNTER_BOND_WINDOW = 24 hours;

    /// @notice Arbitration timeout (7 days)
    uint64 public constant ARBITRATION_TIMEOUT = 7 days;

    /// @notice Evidence submission window (48 hours from escalation)
    uint64 public constant EVIDENCE_WINDOW = 48 hours;

    /// @notice Counter-bond multiplier (100% of challenger bond)
    uint256 public constant COUNTER_BOND_MULTIPLIER = 100;

    /// @notice Slash distribution: user share (75%)
    uint256 public constant SLASH_USER_BPS = 7500;

    /// @notice Slash distribution: treasury share (25%)
    uint256 public constant SLASH_TREASURY_BPS = 2500;

    /// @notice Basis points denominator
    uint256 public constant BPS = 10000;

    // ============ State ============

    /// @notice Reference to ReceiptV2Extension
    IReceiptV2Extension public receiptV2Extension;

    /// @notice Reference to SolverRegistry
    ISolverRegistry public solverRegistry;

    /// @notice Reference to EscrowVault (optional)
    IEscrowVault public escrowVault;

    /// @notice Authorized arbitrator address
    address public arbitrator;

    /// @notice Treasury address
    address public treasury;

    /// @notice Dispute storage by ID
    mapping(bytes32 => OptimisticDispute) private _disputes;

    /// @notice Receipt ID to dispute ID mapping
    mapping(bytes32 => bytes32) private _receiptToDispute;

    /// @notice Evidence history by dispute ID
    struct Evidence {
        bytes32 hash;
        address submitter;
        uint64 timestamp;
    }

    mapping(bytes32 => Evidence[]) private _evidenceHistory;

    /// @notice Flat fee paid to arbitrator per resolved dispute (from contract balance, not from slash)
    uint256 public arbitrationFlatFee = 0.005 ether;

    /// @notice Pending withdrawals for pull-pattern ETH transfers (PM-SC-023 fix)
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Total disputes created
    uint256 public totalDisputes;

    /// @notice Total disputes resolved
    uint256 public totalResolved;

    // ============ Constructor ============

    constructor(address _receiptV2Extension, address _solverRegistry, address _arbitrator) Ownable(msg.sender) {
        receiptV2Extension = IReceiptV2Extension(_receiptV2Extension);
        solverRegistry = ISolverRegistry(_solverRegistry);
        arbitrator = _arbitrator;
        treasury = msg.sender;
    }

    // ============ Modifiers ============

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert NotAuthorizedArbitrator();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IOptimisticDisputeModule
    /// @dev No longer payable - references the bond already paid to ReceiptV2Extension
    function openOptimisticDispute(bytes32 receiptId, bytes32 evidenceHash)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 disputeId)
    {
        // Get receipt from V2 extension
        (TypesV2.IntentReceiptV2 memory receipt, TypesV2.ReceiptV2Status status) =
            receiptV2Extension.getReceiptV2(receiptId);

        // Must be disputed status (set by ReceiptV2Extension.openDisputeV2)
        if (status != TypesV2.ReceiptV2Status.Disputed) revert ReceiptNotDisputed();

        // Check if dispute already exists for this receipt
        if (_receiptToDispute[receiptId] != bytes32(0)) revert DisputeAlreadyResolved();

        // Verify caller is the same challenger who opened the dispute in ReceiptV2Extension
        address originalChallenger = receiptV2Extension.getChallenger(receiptId);
        if (msg.sender != originalChallenger) revert UnauthorizedCaller();

        // Get the bond amount from ReceiptV2Extension (already paid there - no double charge)
        uint256 challengerBond = receiptV2Extension.getChallengerBondV2(receiptId);
        if (challengerBond == 0) revert InvalidChallengerBond();

        // Generate dispute ID
        disputeId = keccak256(abi.encode(receiptId, msg.sender, block.timestamp, totalDisputes));

        // Create dispute record
        _disputes[disputeId] = OptimisticDispute({
            receiptId: receiptId,
            solverId: receipt.solverId,
            challenger: msg.sender,
            challengerBond: challengerBond,
            counterBond: 0,
            evidenceHash: evidenceHash,
            openedAt: uint64(block.timestamp),
            counterBondDeadline: uint64(block.timestamp) + COUNTER_BOND_WINDOW,
            arbitrationDeadline: 0, // Set when contested
            status: OptimisticDisputeStatus.Open
        });

        // Map receipt to dispute
        _receiptToDispute[receiptId] = disputeId;

        // Store initial evidence
        _evidenceHistory[disputeId].push(
            Evidence({ hash: evidenceHash, submitter: msg.sender, timestamp: uint64(block.timestamp) })
        );

        totalDisputes++;

        emit OptimisticDisputeOpened(
            disputeId,
            receiptId,
            receipt.solverId,
            msg.sender,
            challengerBond,
            uint64(block.timestamp) + COUNTER_BOND_WINDOW
        );
    }

    /// @inheritdoc IOptimisticDisputeModule
    function postCounterBond(bytes32 disputeId) external payable whenNotPaused nonReentrant {
        OptimisticDispute storage dispute = _disputes[disputeId];

        // Validate dispute exists and is open
        if (dispute.status == OptimisticDisputeStatus.None) revert DisputeNotFound();
        if (dispute.status != OptimisticDisputeStatus.Open) revert CounterBondAlreadyPosted();

        // Check deadline
        if (block.timestamp > dispute.counterBondDeadline) revert CounterBondDeadlinePassed();

        // Validate caller is solver operator
        Types.Solver memory solver = solverRegistry.getSolver(dispute.solverId);
        if (msg.sender != solver.operator) revert UnauthorizedCaller();

        // Validate counter-bond amount (must match challenger bond)
        uint256 requiredBond = (dispute.challengerBond * COUNTER_BOND_MULTIPLIER) / 100;
        if (msg.value < requiredBond) revert InsufficientCounterBond();

        // Update dispute
        dispute.counterBond = msg.value;
        dispute.status = OptimisticDisputeStatus.Contested;
        dispute.arbitrationDeadline = uint64(block.timestamp) + ARBITRATION_TIMEOUT;

        emit CounterBondPosted(disputeId, dispute.receiptId, dispute.solverId, msg.value);
    }

    /// @inheritdoc IOptimisticDisputeModule
    function resolveByTimeout(bytes32 disputeId) external nonReentrant {
        OptimisticDispute storage dispute = _disputes[disputeId];

        // Validate dispute exists and is open (not contested)
        if (dispute.status == OptimisticDisputeStatus.None) revert DisputeNotFound();
        if (dispute.status != OptimisticDisputeStatus.Open) revert InvalidDisputeStatus();

        // Check deadline has passed
        if (block.timestamp <= dispute.counterBondDeadline) revert CounterBondDeadlineNotReached();

        // Challenger wins - solver didn't counter
        dispute.status = OptimisticDisputeStatus.ChallengerWins;
        totalResolved++;

        // Get solver info for slashing
        Types.Solver memory solver = solverRegistry.getSolver(dispute.solverId);

        // Calculate slash amount (use locked bond from registry)
        uint256 slashAmount = solver.lockedBalance;

        if (slashAmount > 0) {
            // Slash entire locked amount to challenger (simplified for timeout)
            solverRegistry.slash(
                dispute.solverId, slashAmount, dispute.receiptId, Types.DisputeReason.Subjective, dispute.challenger
            );
        }

        // Return challenger bond (held by ReceiptV2Extension)
        receiptV2Extension.returnChallengerBond(dispute.receiptId);

        // Handle escrow refund if applicable
        _handleEscrowOutcome(dispute.receiptId, false); // false = solver fault, refund to client

        emit ResolvedByTimeout(disputeId, dispute.receiptId, dispute.solverId, dispute.challenger);
    }

    /// @inheritdoc IOptimisticDisputeModule
    function resolveByArbitration(bytes32 disputeId, bool solverFault, uint8 slashPercentage, string calldata reason)
        external
        onlyArbitrator
        nonReentrant
    {
        OptimisticDispute storage dispute = _disputes[disputeId];

        // Validate dispute exists and is contested
        if (dispute.status == OptimisticDisputeStatus.None) revert DisputeNotFound();
        if (dispute.status != OptimisticDisputeStatus.Contested) revert DisputeNotContested();
        if (slashPercentage > 100) revert InvalidSlashPercentage();

        uint256 totalSlashAmount = 0;

        if (solverFault) {
            dispute.status = OptimisticDisputeStatus.ChallengerWins;

            // Calculate slash from solver's locked bond
            Types.Solver memory solver = solverRegistry.getSolver(dispute.solverId);
            uint256 availableBond = solver.lockedBalance;
            totalSlashAmount = (availableBond * slashPercentage) / 100;

            if (totalSlashAmount > 0) {
                // Distribute slash: 75% user, 25% treasury, 0% arbitrator (PM-EC-002 fix)
                uint256 userShare = (totalSlashAmount * SLASH_USER_BPS) / BPS;
                uint256 treasuryShare = totalSlashAmount - userShare;

                if (userShare > 0) {
                    solverRegistry.slash(
                        dispute.solverId,
                        userShare,
                        dispute.receiptId,
                        Types.DisputeReason.Subjective,
                        dispute.challenger
                    );
                }
                if (treasuryShare > 0) {
                    solverRegistry.slash(
                        dispute.solverId, treasuryShare, dispute.receiptId, Types.DisputeReason.Subjective, treasury
                    );
                }
            }

            // Return challenger bond (held by ReceiptV2Extension)
            receiptV2Extension.returnChallengerBond(dispute.receiptId);

            // Award solver's counter-bond to challenger via pull pattern (PM-SC-023 fix)
            if (dispute.counterBond > 0) {
                pendingWithdrawals[dispute.challenger] += dispute.counterBond;
                emit WithdrawalPending(dispute.challenger, dispute.counterBond);
            }

            // Handle escrow refund
            _handleEscrowOutcome(dispute.receiptId, false); // Refund to client
        } else {
            dispute.status = OptimisticDisputeStatus.SolverWins;

            // Unlock solver's bond
            Types.Solver memory solver = solverRegistry.getSolver(dispute.solverId);
            if (solver.lockedBalance > 0) {
                solverRegistry.unlockBond(dispute.solverId, solver.lockedBalance);
            }

            address solverOperator = _getSolverOperator(dispute.solverId);

            // Return solver's counter-bond via pull pattern (PM-SC-023 fix)
            if (dispute.counterBond > 0) {
                pendingWithdrawals[solverOperator] += dispute.counterBond;
                emit WithdrawalPending(solverOperator, dispute.counterBond);
            }

            // Challenger loses bond - goes to solver as anti-griefing (held by ReceiptV2Extension)
            receiptV2Extension.transferChallengerBondTo(dispute.receiptId, solverOperator);

            // Handle escrow release to solver
            _handleEscrowOutcome(dispute.receiptId, true); // Release to solver
        }

        // Pay arbitrator flat fee from contract balance (PM-EC-002 fix)
        if (arbitrationFlatFee > 0 && address(this).balance >= arbitrationFlatFee) {
            pendingWithdrawals[arbitrator] += arbitrationFlatFee;
            emit WithdrawalPending(arbitrator, arbitrationFlatFee);
        }

        totalResolved++;

        emit ResolvedByArbitration(disputeId, dispute.receiptId, solverFault, totalSlashAmount, reason);
    }

    /// @inheritdoc IOptimisticDisputeModule
    function submitEvidence(bytes32 disputeId, bytes32 evidenceHash) external {
        OptimisticDispute storage dispute = _disputes[disputeId];

        if (dispute.status == OptimisticDisputeStatus.None) revert DisputeNotFound();

        // Must be open or contested
        if (dispute.status != OptimisticDisputeStatus.Open && dispute.status != OptimisticDisputeStatus.Contested) {
            revert DisputeAlreadyResolved();
        }

        // Check evidence window (for contested disputes)
        if (dispute.status == OptimisticDisputeStatus.Contested) {
            // Evidence window is from when counter-bond was posted
            uint64 escalatedAt = dispute.arbitrationDeadline - ARBITRATION_TIMEOUT;
            if (block.timestamp > escalatedAt + EVIDENCE_WINDOW) {
                revert EvidenceWindowClosed();
            }
        }

        // Only parties can submit evidence
        Types.Solver memory solver = solverRegistry.getSolver(dispute.solverId);
        if (msg.sender != dispute.challenger && msg.sender != solver.operator) {
            revert NotDisputeParty();
        }

        _evidenceHistory[disputeId].push(
            Evidence({ hash: evidenceHash, submitter: msg.sender, timestamp: uint64(block.timestamp) })
        );

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
    }

    /// @notice Resolve dispute after arbitration timeout (default: challenger wins)
    /// @dev Anyone can call after arbitration deadline for contested disputes
    /// @param disputeId Dispute to resolve
    function resolveContestedByTimeout(bytes32 disputeId) external nonReentrant {
        OptimisticDispute storage dispute = _disputes[disputeId];

        if (dispute.status == OptimisticDisputeStatus.None) revert DisputeNotFound();
        if (dispute.status != OptimisticDisputeStatus.Contested) revert DisputeNotContested();

        // Check arbitration deadline has passed
        if (block.timestamp <= dispute.arbitrationDeadline) revert ArbitrationDeadlineNotReached();

        // Default: challenger wins if arbitrator failed to resolve
        dispute.status = OptimisticDisputeStatus.ChallengerWins;
        totalResolved++;

        // Slash solver
        Types.Solver memory solver = solverRegistry.getSolver(dispute.solverId);
        uint256 slashAmount = solver.lockedBalance;

        if (slashAmount > 0) {
            solverRegistry.slash(
                dispute.solverId, slashAmount, dispute.receiptId, Types.DisputeReason.Subjective, dispute.challenger
            );
        }

        // Return challenger bond (held by ReceiptV2Extension)
        receiptV2Extension.returnChallengerBond(dispute.receiptId);

        // Return solver's counter-bond to challenger via pull pattern (PM-SC-023 fix) - arbitrator failed to act
        if (dispute.counterBond > 0) {
            pendingWithdrawals[dispute.challenger] += dispute.counterBond;
            emit WithdrawalPending(dispute.challenger, dispute.counterBond);
        }

        // Handle escrow refund
        _handleEscrowOutcome(dispute.receiptId, false);

        emit ResolvedByTimeout(disputeId, dispute.receiptId, dispute.solverId, dispute.challenger);
    }

    // ============ View Functions ============

    /// @inheritdoc IOptimisticDisputeModule
    function getDispute(bytes32 disputeId) external view returns (OptimisticDispute memory dispute) {
        return _disputes[disputeId];
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getDisputeStatus(bytes32 disputeId) external view returns (OptimisticDisputeStatus status) {
        return _disputes[disputeId].status;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function canPostCounterBond(bytes32 disputeId) external view returns (bool canPost) {
        OptimisticDispute storage dispute = _disputes[disputeId];
        return dispute.status == OptimisticDisputeStatus.Open && block.timestamp <= dispute.counterBondDeadline;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function canResolveByTimeout(bytes32 disputeId) external view returns (bool canResolve) {
        OptimisticDispute storage dispute = _disputes[disputeId];
        if (dispute.status == OptimisticDisputeStatus.Open) {
            return block.timestamp > dispute.counterBondDeadline;
        }
        if (dispute.status == OptimisticDisputeStatus.Contested) {
            return block.timestamp > dispute.arbitrationDeadline;
        }
        return false;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getRequiredCounterBond(bytes32 disputeId) external view returns (uint256 amount) {
        OptimisticDispute storage dispute = _disputes[disputeId];
        return (dispute.challengerBond * COUNTER_BOND_MULTIPLIER) / 100;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getCounterBondWindow() external pure returns (uint64 window) {
        return COUNTER_BOND_WINDOW;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getArbitrationTimeout() external pure returns (uint64 timeout) {
        return ARBITRATION_TIMEOUT;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getEvidenceWindow() external pure returns (uint64 window) {
        return EVIDENCE_WINDOW;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getArbitrator() external view returns (address) {
        return arbitrator;
    }

    /// @inheritdoc IOptimisticDisputeModule
    function getEvidenceHistory(bytes32 disputeId)
        external
        view
        returns (bytes32[] memory hashes, address[] memory submitters, uint64[] memory timestamps)
    {
        Evidence[] storage history = _evidenceHistory[disputeId];
        uint256 length = history.length;

        hashes = new bytes32[](length);
        submitters = new address[](length);
        timestamps = new uint64[](length);

        for (uint256 i = 0; i < length; i++) {
            hashes[i] = history[i].hash;
            submitters[i] = history[i].submitter;
            timestamps[i] = history[i].timestamp;
        }
    }

    /// @notice Get dispute ID for a receipt
    /// @param receiptId Receipt to query
    /// @return disputeId Associated dispute ID (bytes32(0) if none)
    function getDisputeByReceipt(bytes32 receiptId) external view returns (bytes32) {
        return _receiptToDispute[receiptId];
    }

    // ============ Pull-Pattern Withdrawal (PM-SC-023) ============

    /// @notice Withdraw pending ETH balance (pull pattern)
    /// @dev Replaces push-based _transferETH for counter-bond returns
    function withdrawPending() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert TransferFailed();

        pendingWithdrawals[msg.sender] = 0;

        (bool success,) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert TransferFailed();

        emit WithdrawalCompleted(msg.sender, amount);
    }

    // ============ Admin Functions ============

    /// @notice Set arbitration flat fee (PM-EC-002: decoupled from slash)
    /// @param _fee New flat fee in wei
    function setArbitrationFlatFee(uint256 _fee) external onlyOwner {
        arbitrationFlatFee = _fee;
    }

    /// @notice Set arbitrator address
    /// @param _arbitrator New arbitrator address
    function setArbitrator(address _arbitrator) external onlyOwner {
        require(_arbitrator != address(0), "Zero address");
        arbitrator = _arbitrator;
    }

    /// @notice Set treasury address
    /// @param _treasury New treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    /// @notice Set escrow vault reference
    /// @param _escrowVault Escrow vault address
    function setEscrowVault(address _escrowVault) external onlyOwner {
        escrowVault = IEscrowVault(_escrowVault);
    }

    /// @notice Update contract references
    /// @param _receiptV2Extension New receipt extension address
    /// @param _solverRegistry New solver registry address
    function setContracts(address _receiptV2Extension, address _solverRegistry) external onlyOwner {
        receiptV2Extension = IReceiptV2Extension(_receiptV2Extension);
        solverRegistry = ISolverRegistry(_solverRegistry);
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    /// @notice Transfer ETH safely
    /// @dev DEPRECATED: Use pendingWithdrawals + withdrawPending() pull pattern instead (PM-SC-023)
    function _transferETH(address to, uint256 amount) internal {
        if (to == address(0) || amount == 0) return;
        (bool success,) = payable(to).call{ value: amount }("");
        if (!success) revert TransferFailed();
    }

    /// @notice Get solver operator address
    function _getSolverOperator(bytes32 solverId) internal view returns (address) {
        Types.Solver memory solver = solverRegistry.getSolver(solverId);
        return solver.operator;
    }

    /// @notice Handle escrow outcome based on dispute resolution
    /// @param receiptId Receipt with linked escrow
    /// @param solverWins Whether solver won the dispute
    function _handleEscrowOutcome(bytes32 receiptId, bool solverWins) internal {
        // Only if escrow vault is configured
        if (address(escrowVault) == address(0)) return;

        // Get receipt to find escrow ID
        (TypesV2.IntentReceiptV2 memory receipt,) = receiptV2Extension.getReceiptV2(receiptId);

        // Only if receipt has escrow linked
        if (receipt.escrowId == bytes32(0)) return;

        // Check if escrow is active before attempting operation
        if (!escrowVault.isActive(receipt.escrowId)) return;

        if (solverWins) {
            // Release to solver operator
            Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);
            escrowVault.release(receipt.escrowId, solver.operator);
        } else {
            // Refund to client (depositor)
            escrowVault.refund(receipt.escrowId);
        }
    }

    /// @notice Receive ETH for bonds
    receive() external payable { }
}
