// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICredibilityRegistry
/// @notice Comprehensive on-chain credibility system for intent solvers
/// @dev Extends ERC-8004 validation signals with rich identity and reputation primitives
/// @custom:security This is the source of truth for solver reputation across protocols
interface ICredibilityRegistry {
    // ============ Enums ============

    /// @notice Solver registration status
    enum RegistrationStatus {
        Unregistered, // 0 - Never registered
        Active, // 1 - Registered and operational
        Suspended, // 2 - Temporarily suspended (can be reactivated)
        Banned // 3 - Permanently banned (jail limit exceeded)
    }

    /// @notice Validation outcome severity levels
    enum OutcomeSeverity {
        Success, // 0 - Task completed successfully
        MinorFault, // 1 - Task failed, no slashing
        ModerateFault, // 2 - Task failed, partial slash
        SevereFault, // 3 - Task failed, full slash
        MaliciousFault // 4 - Intentional harm, slash + ban
    }

    /// @notice Dispute resolution outcomes
    enum DisputeOutcome {
        Pending, // 0 - Not yet resolved
        SolverVindicated, // 1 - Solver was correct
        SolverFaulted, // 2 - Solver was at fault
        PartialFault, // 3 - Shared responsibility
        Escalated // 4 - Escalated to arbitration
    }

    // ============ Structs ============

    /// @notice On-chain solver identity
    struct SolverIdentity {
        bytes32 solverId; // Unique identifier
        address operator; // Current operator address
        bytes32 metadataHash; // Hash of off-chain metadata (name, description, etc.)
        uint64 registeredAt; // Registration timestamp
        uint64 lastActiveAt; // Last successful validation
        RegistrationStatus status; // Current status
        uint16 chainId; // Primary chain of operation
    }

    /// @notice Comprehensive reputation snapshot
    struct ReputationSnapshot {
        // Core metrics
        uint64 totalTasks; // Total tasks attempted
        uint64 successfulTasks; // Successfully completed
        uint64 failedTasks; // Failed (any severity)
        uint64 disputedTasks; // Tasks that went to dispute

        // Dispute outcomes
        uint32 disputesWon; // Disputes won by solver
        uint32 disputesLost; // Disputes lost by solver
        uint32 disputesPartial; // Partial fault outcomes

        // Slashing history
        uint128 totalSlashed; // Cumulative ETH slashed (wei)
        uint32 slashCount; // Number of slash events
        uint32 jailCount; // Number of times jailed

        // Economic stake
        uint128 currentBond; // Current bonded amount
        uint128 peakBond; // Highest historical bond

        // Time-weighted metrics
        uint64 avgResponseTime; // Average task completion time (seconds)
        uint64 lastSlashAt; // Timestamp of last slash
        uint64 snapshotAt; // When this snapshot was taken
    }

    /// @notice Individual validation record with rich context
    struct ValidationRecord {
        bytes32 taskId; // Receipt/task identifier
        bytes32 solverId; // Solver who performed task
        bytes32 intentHash; // Hash of original intent
        bytes32 evidenceHash; // Hash of execution evidence
        OutcomeSeverity severity; // Outcome severity
        DisputeOutcome disputeResult; // If disputed, the outcome
        uint128 valueAtRisk; // ETH value involved
        uint128 slashAmount; // If slashed, how much
        uint64 executedAt; // When task was executed
        uint64 finalizedAt; // When outcome was finalized
        uint16 chainId; // Chain where task executed
    }

    /// @notice Cross-chain reputation proof
    struct ReputationProof {
        bytes32 solverId;
        ReputationSnapshot snapshot;
        bytes32 merkleRoot; // Root of reputation Merkle tree
        bytes32[] merkleProof; // Proof of inclusion
        uint64 proofTimestamp; // When proof was generated
        bytes signature; // Signature from authorized oracle
    }

    // ============ Events ============

    /// @notice Emitted when solver identity is registered
    event SolverRegistered(bytes32 indexed solverId, address indexed operator, bytes32 metadataHash, uint64 timestamp);

    /// @notice Emitted when solver status changes
    event SolverStatusChanged(
        bytes32 indexed solverId, RegistrationStatus oldStatus, RegistrationStatus newStatus, bytes32 reason
    );

    /// @notice Emitted when validation is recorded
    event ValidationRecorded(
        bytes32 indexed taskId,
        bytes32 indexed solverId,
        OutcomeSeverity severity,
        uint128 valueAtRisk,
        uint64 timestamp
    );

    /// @notice Emitted when dispute is resolved
    event DisputeResolved(
        bytes32 indexed taskId, bytes32 indexed solverId, DisputeOutcome outcome, uint128 slashAmount
    );

    /// @notice Emitted when reputation snapshot is updated
    event ReputationUpdated(
        bytes32 indexed solverId, uint64 totalTasks, uint64 successfulTasks, uint128 totalSlashed, uint256 intentScore
    );

    /// @notice Emitted when cross-chain proof is verified
    event CrossChainProofVerified(
        bytes32 indexed solverId, uint16 sourceChain, bytes32 merkleRoot, uint64 proofTimestamp
    );

    // ============ Identity Functions ============

    /// @notice Register a new solver identity
    /// @param solverId Unique solver identifier
    /// @param operator Operator address
    /// @param metadataHash Hash of off-chain metadata
    function registerSolver(bytes32 solverId, address operator, bytes32 metadataHash) external;

    /// @notice Get solver identity
    /// @param solverId Solver to query
    /// @return identity Full identity record
    function getSolverIdentity(bytes32 solverId) external view returns (SolverIdentity memory identity);

    /// @notice Check if solver is active
    /// @param solverId Solver to check
    /// @return active True if solver can accept tasks
    function isSolverActive(bytes32 solverId) external view returns (bool active);

    // ============ Validation Functions ============

    /// @notice Record a validation outcome
    /// @param record Full validation record
    function recordValidation(ValidationRecord calldata record) external;

    /// @notice Get validation record
    /// @param taskId Task to query
    /// @return record Full validation record
    function getValidation(bytes32 taskId) external view returns (ValidationRecord memory record);

    /// @notice Record dispute resolution
    /// @param taskId Task that was disputed
    /// @param outcome Dispute outcome
    /// @param slashAmount Amount slashed (if any)
    function recordDisputeResolution(bytes32 taskId, DisputeOutcome outcome, uint128 slashAmount) external;

    // ============ Reputation Functions ============

    /// @notice Get full reputation snapshot
    /// @param solverId Solver to query
    /// @return snapshot Current reputation snapshot
    function getReputation(bytes32 solverId) external view returns (ReputationSnapshot memory snapshot);

    /// @notice Calculate IntentScore (0-10000 basis points)
    /// @param solverId Solver to score
    /// @return score Composite reputation score
    function getIntentScore(bytes32 solverId) external view returns (uint256 score);

    /// @notice Get success rate in basis points
    /// @param solverId Solver to query
    /// @return rate Success rate (0-10000)
    function getSuccessRate(bytes32 solverId) external view returns (uint256 rate);

    /// @notice Get dispute win rate in basis points
    /// @param solverId Solver to query
    /// @return rate Dispute win rate (0-10000)
    function getDisputeWinRate(bytes32 solverId) external view returns (uint256 rate);

    // ============ Cross-Chain Functions ============

    /// @notice Verify cross-chain reputation proof
    /// @param proof Reputation proof from another chain
    /// @return valid True if proof is valid
    function verifyCrossChainProof(ReputationProof calldata proof) external view returns (bool valid);

    /// @notice Import verified cross-chain reputation
    /// @param proof Valid reputation proof
    function importCrossChainReputation(ReputationProof calldata proof) external;

    /// @notice Generate Merkle root for current reputation state
    /// @param solverId Solver to generate proof for
    /// @return root Merkle root of reputation state
    function generateReputationRoot(bytes32 solverId) external view returns (bytes32 root);

    // ============ Query Functions ============

    /// @notice Get solvers ranked by IntentScore
    /// @param offset Pagination offset
    /// @param limit Number of results
    /// @return solverIds Sorted solver IDs
    /// @return scores Corresponding scores
    function getLeaderboard(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory solverIds, uint256[] memory scores);

    /// @notice Check if solver meets minimum credibility threshold
    /// @param solverId Solver to check
    /// @param minScore Minimum required IntentScore
    /// @param maxSlashRate Maximum allowed slash rate (basis points)
    /// @return meets True if solver meets criteria
    function meetsCredibilityThreshold(bytes32 solverId, uint256 minScore, uint256 maxSlashRate)
        external
        view
        returns (bool meets);
}
