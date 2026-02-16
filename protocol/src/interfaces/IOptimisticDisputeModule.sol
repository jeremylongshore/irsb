// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IOptimisticDisputeModule
/// @notice Interface for optimistic dispute resolution with counter-bond mechanism
/// @dev V2 receipts use optimistic disputes: challenger posts bond, solver must counter or lose by timeout
interface IOptimisticDisputeModule {
    // ============ Enums ============

    /// @notice Optimistic dispute lifecycle states
    enum OptimisticDisputeStatus {
        None, // 0 - No dispute
        Open, // 1 - Waiting for counter-bond
        Contested, // 2 - Counter-bond posted, needs arbitration
        ChallengerWins, // 3 - Resolved for challenger
        SolverWins // 4 - Resolved for solver
    }

    // ============ Structs ============

    /// @notice Optimistic dispute record
    struct OptimisticDispute {
        bytes32 receiptId; // Receipt being disputed
        bytes32 solverId; // Solver under dispute
        address challenger; // Who opened the dispute
        uint256 challengerBond; // Bond posted by challenger
        uint256 counterBond; // Bond posted by solver
        bytes32 evidenceHash; // Initial evidence from challenger
        uint64 openedAt; // Dispute start time
        uint64 counterBondDeadline; // Deadline for counter-bond
        uint64 arbitrationDeadline; // Deadline for arbitration (if contested)
        OptimisticDisputeStatus status; // Current status
    }

    // ============ Events ============

    /// @notice Emitted when optimistic dispute is opened
    event OptimisticDisputeOpened(
        bytes32 indexed disputeId,
        bytes32 indexed receiptId,
        bytes32 indexed solverId,
        address challenger,
        uint256 challengerBond,
        uint64 counterBondDeadline
    );

    /// @notice Emitted when solver posts counter-bond
    event CounterBondPosted(
        bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, uint256 counterBond
    );

    /// @notice Emitted when dispute is resolved by timeout (no counter-bond)
    event ResolvedByTimeout(
        bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, address challenger
    );

    /// @notice Emitted when dispute is resolved by arbitrator
    event ResolvedByArbitration(
        bytes32 indexed disputeId, bytes32 indexed receiptId, bool solverFault, uint256 slashAmount, string reason
    );

    /// @notice Emitted when evidence is submitted
    event EvidenceSubmitted(bytes32 indexed disputeId, address indexed submitter, bytes32 evidenceHash);

    /// @notice Emitted when ETH is credited to pending withdrawals (pull pattern)
    event WithdrawalPending(address indexed recipient, uint256 amount);

    /// @notice Emitted when pending ETH is withdrawn
    event WithdrawalCompleted(address indexed recipient, uint256 amount);

    // ============ Errors ============

    /// @notice Caller not authorized
    error UnauthorizedCaller();

    /// @notice Receipt not in disputed state
    error ReceiptNotDisputed();

    /// @notice Dispute not found
    error DisputeNotFound();

    /// @notice Counter-bond already posted
    error CounterBondAlreadyPosted();

    /// @notice Counter-bond deadline passed
    error CounterBondDeadlinePassed();

    /// @notice Counter-bond deadline not reached
    error CounterBondDeadlineNotReached();

    /// @notice Insufficient counter-bond amount
    error InsufficientCounterBond();

    /// @notice Invalid or missing challenger bond in ReceiptV2Extension
    error InvalidChallengerBond();

    /// @notice Dispute not contested (no counter-bond)
    error DisputeNotContested();

    /// @notice Dispute already resolved
    error DisputeAlreadyResolved();

    /// @notice Arbitration deadline not reached
    error ArbitrationDeadlineNotReached();

    /// @notice Not authorized arbitrator
    error NotAuthorizedArbitrator();

    /// @notice Evidence window closed
    error EvidenceWindowClosed();

    /// @notice Not a dispute party
    error NotDisputeParty();

    /// @notice Invalid slash percentage
    error InvalidSlashPercentage();

    /// @notice Transfer failed
    error TransferFailed();

    /// @notice Dispute status invalid for operation
    error InvalidDisputeStatus();

    // ============ External Functions ============

    /// @notice Open an optimistic dispute against a V2 receipt
    /// @dev No longer payable - references the bond already paid to ReceiptV2Extension
    /// @param receiptId Receipt to dispute
    /// @param evidenceHash Hash of challenger's evidence
    /// @return disputeId Unique dispute identifier
    function openOptimisticDispute(bytes32 receiptId, bytes32 evidenceHash) external returns (bytes32 disputeId);

    /// @notice Solver posts counter-bond to contest dispute
    /// @param disputeId Dispute to contest
    function postCounterBond(bytes32 disputeId) external payable;

    /// @notice Resolve dispute by timeout (no counter-bond posted)
    /// @dev Anyone can call after counter-bond deadline
    /// @param disputeId Dispute to resolve
    function resolveByTimeout(bytes32 disputeId) external;

    /// @notice Resolve dispute by arbitration
    /// @dev Only arbitrator can call for contested disputes
    /// @param disputeId Dispute to resolve
    /// @param solverFault Whether solver is at fault
    /// @param slashPercentage Percentage of bond to slash (0-100)
    /// @param reason Human-readable resolution reason
    function resolveByArbitration(bytes32 disputeId, bool solverFault, uint8 slashPercentage, string calldata reason)
        external;

    /// @notice Submit evidence for a dispute
    /// @param disputeId Dispute ID
    /// @param evidenceHash Hash of evidence
    function submitEvidence(bytes32 disputeId, bytes32 evidenceHash) external;

    // ============ View Functions ============

    /// @notice Get dispute details
    /// @param disputeId Dispute to query
    /// @return dispute Dispute details
    function getDispute(bytes32 disputeId) external view returns (OptimisticDispute memory dispute);

    /// @notice Get dispute status
    /// @param disputeId Dispute to query
    /// @return status Current dispute status
    function getDisputeStatus(bytes32 disputeId) external view returns (OptimisticDisputeStatus status);

    /// @notice Check if counter-bond can be posted
    /// @param disputeId Dispute to check
    /// @return canPost Whether counter-bond can be posted
    function canPostCounterBond(bytes32 disputeId) external view returns (bool canPost);

    /// @notice Check if dispute can be resolved by timeout
    /// @param disputeId Dispute to check
    /// @return canResolve Whether timeout resolution is available
    function canResolveByTimeout(bytes32 disputeId) external view returns (bool canResolve);

    /// @notice Get required counter-bond amount
    /// @param disputeId Dispute to query
    /// @return amount Required counter-bond in wei
    function getRequiredCounterBond(bytes32 disputeId) external view returns (uint256 amount);

    /// @notice Get counter-bond window duration
    /// @return window Duration in seconds
    function getCounterBondWindow() external view returns (uint64 window);

    /// @notice Get arbitration timeout duration
    /// @return timeout Duration in seconds
    function getArbitrationTimeout() external view returns (uint64 timeout);

    /// @notice Get evidence window duration
    /// @return window Duration in seconds
    function getEvidenceWindow() external view returns (uint64 window);

    /// @notice Get arbitrator address
    /// @return arbitrator Current arbitrator
    function getArbitrator() external view returns (address arbitrator);

    /// @notice Get evidence history for a dispute
    /// @param disputeId Dispute to query
    /// @return hashes Evidence hashes
    /// @return submitters Who submitted each evidence
    /// @return timestamps When each was submitted
    function getEvidenceHistory(bytes32 disputeId)
        external
        view
        returns (bytes32[] memory hashes, address[] memory submitters, uint64[] memory timestamps);
}
