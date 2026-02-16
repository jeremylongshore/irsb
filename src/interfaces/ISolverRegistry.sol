// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Types } from "../libraries/Types.sol";

/// @title ISolverRegistry
/// @notice Interface for solver registration and bond management
interface ISolverRegistry {
    // ============ Events ============

    /// @notice Emitted when a new solver is registered
    event SolverRegistered(bytes32 indexed solverId, address indexed operator, string metadataURI);

    /// @notice Emitted when bond is deposited
    event BondDeposited(bytes32 indexed solverId, uint256 amount, uint256 newBalance);

    /// @notice Emitted when bond is withdrawn
    event BondWithdrawn(bytes32 indexed solverId, uint256 amount, uint256 newBalance);

    /// @notice Emitted when solver status changes
    event SolverStatusChanged(bytes32 indexed solverId, Types.SolverStatus oldStatus, Types.SolverStatus newStatus);

    /// @notice Emitted when operator key is rotated
    event OperatorKeyRotated(bytes32 indexed solverId, address indexed oldOperator, address indexed newOperator);

    /// @notice Emitted when solver is slashed
    event SolverSlashed(
        bytes32 indexed solverId, uint256 amount, bytes32 indexed receiptId, Types.DisputeReason reason
    );

    // ============ Errors ============

    error SolverAlreadyRegistered();
    error SolverNotFound();
    error SolverNotActive();
    error SolverJailed();
    error SolverBanned();
    error InsufficientBond();
    error BondLocked();
    error NotSolverOperator();
    error InvalidOperatorAddress();
    error MinimumBondNotMet();
    error WithdrawalCooldownActive();
    error ZeroSlashAmount();

    // ============ External Functions ============

    /// @notice Register a new solver
    /// @param metadataURI IPFS URI containing solver metadata
    /// @param operator Address authorized to sign receipts
    /// @return solverId Unique identifier for the solver
    function registerSolver(string calldata metadataURI, address operator) external returns (bytes32 solverId);

    /// @notice Deposit bond for a solver
    /// @param solverId Solver to deposit for
    function depositBond(bytes32 solverId) external payable;

    /// @notice Withdraw available bond
    /// @param solverId Solver to withdraw from
    /// @param amount Amount to withdraw
    function withdrawBond(bytes32 solverId, uint256 amount) external;

    /// @notice Rotate solver's operator key
    /// @param solverId Solver to update
    /// @param newOperator New operator address
    function setSolverKey(bytes32 solverId, address newOperator) external;

    /// @notice Lock bond for active dispute
    /// @param solverId Solver under dispute
    /// @param amount Amount to lock
    function lockBond(bytes32 solverId, uint256 amount) external;

    /// @notice Unlock bond after dispute resolution
    /// @param solverId Solver to unlock
    /// @param amount Amount to unlock
    function unlockBond(bytes32 solverId, uint256 amount) external;

    /// @notice Slash solver bond
    /// @param solverId Solver to slash
    /// @param amount Amount to slash
    /// @param receiptId Associated receipt
    /// @param reason Slash reason code
    /// @param recipient Slash recipient (user/treasury)
    function slash(bytes32 solverId, uint256 amount, bytes32 receiptId, Types.DisputeReason reason, address recipient)
        external;

    /// @notice Jail a solver temporarily
    /// @param solverId Solver to jail
    function jailSolver(bytes32 solverId) external;

    /// @notice Unjail a solver
    /// @param solverId Solver to unjail
    function unjailSolver(bytes32 solverId) external;

    /// @notice Permanently ban a solver
    /// @param solverId Solver to ban
    function banSolver(bytes32 solverId) external;

    // ============ View Functions ============

    /// @notice Get solver details
    /// @param solverId Solver to query
    /// @return solver Solver struct
    function getSolver(bytes32 solverId) external view returns (Types.Solver memory solver);

    /// @notice Get solver status
    /// @param solverId Solver to query
    /// @return status Current solver status
    function getSolverStatus(bytes32 solverId) external view returns (Types.SolverStatus status);

    /// @notice Check if solver is active and has sufficient bond
    /// @param solverId Solver to check
    /// @param requiredBond Minimum bond required
    /// @return isValid Whether solver meets requirements
    function isValidSolver(bytes32 solverId, uint256 requiredBond) external view returns (bool isValid);

    /// @notice Get solver's IntentScore
    /// @param solverId Solver to query
    /// @return score Reputation metrics
    function getIntentScore(bytes32 solverId) external view returns (Types.IntentScore memory score);

    /// @notice Get solver ID from operator address
    /// @param operator Operator address
    /// @return solverId Associated solver ID (zero if not found)
    function getSolverByOperator(address operator) external view returns (bytes32 solverId);

    /// @notice Get minimum required bond
    /// @return minBond Minimum bond in wei
    function getMinimumBond() external view returns (uint256 minBond);

    /// @notice Calculate required bond for a given declared volume (PM-EC-001)
    /// @param volume Declared transaction volume in wei
    /// @return required The required bond amount
    function requiredBondForVolume(uint256 volume) external view returns (uint256 required);

    /// @notice Increment disputes opened counter for solver
    /// @param solverId Solver to update
    function incrementDisputes(bytes32 solverId) external;

    /// @notice Update solver score after receipt finalization
    /// @param solverId Solver to update
    /// @param success Whether the receipt was successful
    /// @param volume Transaction volume processed
    function updateScore(bytes32 solverId, bool success, uint256 volume) external;
}
