// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC8004 } from "../interfaces/IERC8004.sol";
import { IValidationRegistry } from "../interfaces/IValidationRegistry.sol";
import { ICredibilityRegistry } from "../interfaces/ICredibilityRegistry.sol";

/// @title ERC8004Adapter
/// @notice Adapter that emits ERC-8004 validation signals for IRSB events
/// @dev Acts as a Validation Provider, pushing signals to external registries
/// @custom:security Non-critical module - failures should NOT revert core operations
/// @custom:version 2.0.0 - Added CredibilityRegistry integration
contract ERC8004Adapter is IERC8004, Ownable {
    // ============ Constants ============

    string public constant PROVIDER_NAME = "IRSB Protocol";
    string public constant PROVIDER_VERSION = "2.0.0";

    // ============ State ============

    /// @notice External validation registry (optional, legacy)
    IValidationRegistry public registry;

    /// @notice Credibility registry for rich reputation data (optional)
    ICredibilityRegistry public credibilityRegistry;

    /// @notice Authorized hub addresses that can emit signals
    mapping(address => bool) public authorizedHubs;

    /// @notice Total signals emitted
    uint256 public totalSignals;

    /// @notice Signals by outcome type
    mapping(ValidationOutcome => uint256) public signalsByOutcome;

    // ============ Events ============

    /// @notice Emitted when hub authorization changes
    event HubAuthorizationChanged(address indexed hub, bool authorized);

    /// @notice Emitted when registry is updated
    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    /// @notice Emitted when credibility registry is updated
    event CredibilityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    /// @notice Emitted when rich validation is recorded to credibility registry
    event CredibilityRecorded(
        bytes32 indexed taskId, bytes32 indexed solverId, ICredibilityRegistry.OutcomeSeverity severity
    );

    // ============ Errors ============

    /// @notice Caller not authorized to emit signals
    error UnauthorizedHub();

    /// @notice Invalid hub address
    error InvalidHubAddress();

    // ============ Constructor ============

    /// @notice Deploy adapter
    /// @param _hub Initial authorized hub address
    constructor(address _hub) Ownable(msg.sender) {
        if (_hub != address(0)) {
            authorizedHubs[_hub] = true;
            emit HubAuthorizationChanged(_hub, true);
        }
    }

    // ============ Modifiers ============

    modifier onlyAuthorizedHub() {
        if (!authorizedHubs[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedHub();
        }
        _;
    }

    // ============ Hub Signal Functions ============

    /// @notice Signal a receipt finalization
    /// @param receiptId Receipt that was finalized
    /// @param solverId Solver who fulfilled the receipt
    function signalFinalized(bytes32 receiptId, bytes32 solverId) external onlyAuthorizedHub {
        _emitSignal(receiptId, solverId, ValidationOutcome.Finalized, bytes32(0), "");
    }

    /// @notice Signal a solver slash
    /// @param receiptId Receipt that caused the slash
    /// @param solverId Solver who was slashed
    /// @param amount Amount slashed (encoded in metadata)
    function signalSlashed(bytes32 receiptId, bytes32 solverId, uint256 amount) external onlyAuthorizedHub {
        _emitSignal(receiptId, solverId, ValidationOutcome.Slashed, bytes32(0), abi.encode(amount));
    }

    /// @notice Signal dispute won by solver
    /// @param receiptId Receipt under dispute
    /// @param solverId Solver who won
    function signalDisputeWon(bytes32 receiptId, bytes32 solverId) external onlyAuthorizedHub {
        _emitSignal(receiptId, solverId, ValidationOutcome.DisputeWon, bytes32(0), "");
    }

    /// @notice Signal dispute lost by solver
    /// @param receiptId Receipt under dispute
    /// @param solverId Solver who lost
    /// @param slashAmount Amount slashed
    function signalDisputeLost(bytes32 receiptId, bytes32 solverId, uint256 slashAmount) external onlyAuthorizedHub {
        _emitSignal(receiptId, solverId, ValidationOutcome.DisputeLost, bytes32(0), abi.encode(slashAmount));
    }

    /// @notice Signal with full parameters
    /// @param receiptId Task/receipt identifier
    /// @param solverId Agent/solver identifier
    /// @param outcome Validation outcome
    /// @param evidenceHash Hash of evidence
    /// @param metadata Additional context
    function signalValidation(
        bytes32 receiptId,
        bytes32 solverId,
        ValidationOutcome outcome,
        bytes32 evidenceHash,
        bytes calldata metadata
    ) external onlyAuthorizedHub {
        _emitSignal(receiptId, solverId, outcome, evidenceHash, metadata);
    }

    // ============ Internal Functions ============

    /// @notice Internal signal emission
    function _emitSignal(
        bytes32 taskId,
        bytes32 agentId,
        ValidationOutcome outcome,
        bytes32 evidenceHash,
        bytes memory metadata
    ) internal {
        _emitSignalWithTimestamp(taskId, agentId, outcome, evidenceHash, metadata, block.timestamp);
    }

    /// @notice Internal signal emission with custom timestamp
    function _emitSignalWithTimestamp(
        bytes32 taskId,
        bytes32 agentId,
        ValidationOutcome outcome,
        bytes32 evidenceHash,
        bytes memory metadata,
        uint256 timestamp
    ) internal {
        // Emit the validation signal event with all data for off-chain consumers
        emit ValidationSignalEmitted(taskId, agentId, outcome, timestamp, evidenceHash, metadata);

        // Try to record to legacy registry (non-reverting)
        if (address(registry) != address(0)) {
            bool success = outcome == ValidationOutcome.Finalized || outcome == ValidationOutcome.DisputeWon;

            // Use low-level call to prevent registry failures from reverting
            try registry.recordValidation(taskId, agentId, success) {
                emit ValidationRecorded(taskId, agentId, address(registry));
            } catch {
                // Registry call failed - emit but don't revert
                // This ensures IRSB core operations are never blocked by registry issues
            }
        }

        // Try to record to credibility registry with rich data (non-reverting)
        if (address(credibilityRegistry) != address(0)) {
            ICredibilityRegistry.OutcomeSeverity severity = _mapOutcomeToSeverity(outcome);
            uint128 slashAmount = _extractSlashAmount(metadata);

            ICredibilityRegistry.ValidationRecord memory record = ICredibilityRegistry.ValidationRecord({
                taskId: taskId,
                solverId: agentId,
                intentHash: bytes32(0), // Set by caller if needed
                evidenceHash: evidenceHash,
                severity: severity,
                disputeResult: ICredibilityRegistry.DisputeOutcome.Pending,
                valueAtRisk: 0, // Set by caller if needed
                slashAmount: slashAmount,
                executedAt: uint64(timestamp),
                finalizedAt: severity == ICredibilityRegistry.OutcomeSeverity.Success ? uint64(timestamp) : 0,
                chainId: uint16(block.chainid)
            });

            try credibilityRegistry.recordValidation(record) {
                emit CredibilityRecorded(taskId, agentId, severity);
            } catch {
                // Credibility registry call failed - don't revert
            }
        }

        // Update counters
        totalSignals++;
        signalsByOutcome[outcome]++;
    }

    /// @notice Map ValidationOutcome to OutcomeSeverity
    function _mapOutcomeToSeverity(ValidationOutcome outcome)
        internal
        pure
        returns (ICredibilityRegistry.OutcomeSeverity)
    {
        if (outcome == ValidationOutcome.Finalized || outcome == ValidationOutcome.DisputeWon) {
            return ICredibilityRegistry.OutcomeSeverity.Success;
        } else if (outcome == ValidationOutcome.Slashed) {
            return ICredibilityRegistry.OutcomeSeverity.SevereFault;
        } else if (outcome == ValidationOutcome.DisputeLost) {
            return ICredibilityRegistry.OutcomeSeverity.ModerateFault;
        }
        return ICredibilityRegistry.OutcomeSeverity.MinorFault;
    }

    /// @notice Extract slash amount from metadata if present
    function _extractSlashAmount(bytes memory metadata) internal pure returns (uint128) {
        if (metadata.length >= 32) {
            return uint128(abi.decode(metadata, (uint256)));
        }
        return 0;
    }

    // ============ IERC8004 Implementation ============

    /// @inheritdoc IERC8004
    function emitValidationSignal(ValidationSignal calldata signal) external onlyAuthorizedHub {
        // Use signal's timestamp if provided (non-zero), otherwise use block.timestamp
        uint256 timestamp = signal.timestamp > 0 ? signal.timestamp : block.timestamp;
        _emitSignalWithTimestamp(
            signal.taskId, signal.agentId, signal.outcome, signal.evidenceHash, signal.metadata, timestamp
        );
    }

    /// @inheritdoc IERC8004
    function getProviderInfo() external view returns (string memory name, string memory version, uint256 chainId) {
        return (PROVIDER_NAME, PROVIDER_VERSION, block.chainid);
    }

    /// @inheritdoc IERC8004
    function supportsERC8004() external pure returns (bool supported) {
        return true;
    }

    // ============ View Functions ============

    /// @notice Get statistics for an outcome type
    /// @param outcome Outcome to query
    /// @return count Number of signals with this outcome
    function getOutcomeCount(ValidationOutcome outcome) external view returns (uint256 count) {
        return signalsByOutcome[outcome];
    }

    /// @notice Get all outcome statistics
    /// @return finalized Count of finalized signals
    /// @return slashed Count of slashed signals
    /// @return disputeWon Count of dispute won signals
    /// @return disputeLost Count of dispute lost signals
    function getAllOutcomeStats()
        external
        view
        returns (uint256 finalized, uint256 slashed, uint256 disputeWon, uint256 disputeLost)
    {
        return (
            signalsByOutcome[ValidationOutcome.Finalized],
            signalsByOutcome[ValidationOutcome.Slashed],
            signalsByOutcome[ValidationOutcome.DisputeWon],
            signalsByOutcome[ValidationOutcome.DisputeLost]
        );
    }

    /// @notice Check if hub is authorized
    /// @param hub Address to check
    /// @return authorized Whether hub can emit signals
    function isAuthorizedHub(address hub) external view returns (bool authorized) {
        return authorizedHubs[hub];
    }

    // ============ Admin Functions ============

    /// @notice Set hub authorization
    /// @param hub Hub address
    /// @param authorized Whether to authorize
    function setAuthorizedHub(address hub, bool authorized) external onlyOwner {
        if (hub == address(0)) revert InvalidHubAddress();
        authorizedHubs[hub] = authorized;
        emit HubAuthorizationChanged(hub, authorized);
    }

    /// @notice Set validation registry (legacy)
    /// @param _registry New registry address (can be zero to disable)
    function setRegistry(address _registry) external onlyOwner {
        address oldRegistry = address(registry);
        registry = IValidationRegistry(_registry);
        emit RegistryUpdated(oldRegistry, _registry);
    }

    /// @notice Set credibility registry (v2)
    /// @param _registry New credibility registry address (can be zero to disable)
    function setCredibilityRegistry(address _registry) external onlyOwner {
        address oldRegistry = address(credibilityRegistry);
        credibilityRegistry = ICredibilityRegistry(_registry);
        emit CredibilityRegistryUpdated(oldRegistry, _registry);
    }

    // ============ Credibility Query Functions ============

    /// @notice Get solver's IntentScore from credibility registry
    /// @param solverId Solver to query
    /// @return score IntentScore (0-10000 basis points)
    function getSolverIntentScore(bytes32 solverId) external view returns (uint256 score) {
        if (address(credibilityRegistry) == address(0)) return 0;
        return credibilityRegistry.getIntentScore(solverId);
    }

    /// @notice Get solver's success rate from credibility registry
    /// @param solverId Solver to query
    /// @return rate Success rate (0-10000 basis points)
    function getSolverSuccessRate(bytes32 solverId) external view returns (uint256 rate) {
        if (address(credibilityRegistry) == address(0)) return 0;
        return credibilityRegistry.getSuccessRate(solverId);
    }

    /// @notice Check if solver meets credibility threshold
    /// @param solverId Solver to check
    /// @param minScore Minimum IntentScore required
    /// @param maxSlashRate Maximum slash rate allowed (basis points)
    /// @return meets True if solver meets threshold
    function solverMeetsThreshold(bytes32 solverId, uint256 minScore, uint256 maxSlashRate)
        external
        view
        returns (bool meets)
    {
        if (address(credibilityRegistry) == address(0)) return false;
        return credibilityRegistry.meetsCredibilityThreshold(solverId, minScore, maxSlashRate);
    }

    /// @notice Get full solver reputation from credibility registry
    /// @param solverId Solver to query
    /// @return snapshot Full reputation snapshot
    function getSolverReputation(bytes32 solverId)
        external
        view
        returns (ICredibilityRegistry.ReputationSnapshot memory snapshot)
    {
        if (address(credibilityRegistry) == address(0)) {
            return snapshot; // Empty snapshot
        }
        return credibilityRegistry.getReputation(solverId);
    }
}
