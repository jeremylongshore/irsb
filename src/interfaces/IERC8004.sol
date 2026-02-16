// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IERC8004
/// @notice ERC-8004 Validation Provider interface definitions
/// @dev Standard interface for agent validation providers
/// @custom:reference https://eips.ethereum.org/EIPS/eip-8004 (proposed)
interface IERC8004 {
    // ============ Enums ============

    /// @notice Validation outcome types
    enum ValidationOutcome {
        None, // 0 - No validation
        Finalized, // 1 - Successfully validated (receipt finalized)
        Slashed, // 2 - Validation failed (solver slashed)
        DisputeWon, // 3 - Dispute resolved for solver
        DisputeLost // 4 - Dispute resolved against solver
    }

    // ============ Structs ============

    /// @notice Validation signal payload
    struct ValidationSignal {
        bytes32 taskId; // Unique task identifier (receiptId in IRSB)
        bytes32 agentId; // Agent identifier (solverId in IRSB)
        ValidationOutcome outcome; // Validation result
        uint256 timestamp; // When validation occurred
        bytes32 evidenceHash; // Hash of supporting evidence
        bytes metadata; // Additional context (optional)
    }

    // ============ Events ============

    /// @notice Emitted when a validation signal is published
    /// @param taskId Task/receipt identifier
    /// @param agentId Agent/solver identifier
    /// @param outcome Validation outcome
    /// @param timestamp When signal was emitted
    /// @param evidenceHash Hash of supporting evidence
    /// @param metadata Additional context data
    event ValidationSignalEmitted(
        bytes32 indexed taskId,
        bytes32 indexed agentId,
        ValidationOutcome outcome,
        uint256 timestamp,
        bytes32 evidenceHash,
        bytes metadata
    );

    /// @notice Emitted when a validation is recorded to registry
    /// @param taskId Task/receipt identifier
    /// @param agentId Agent/solver identifier
    /// @param registry Registry that received the signal
    event ValidationRecorded(bytes32 indexed taskId, bytes32 indexed agentId, address indexed registry);

    // ============ Functions ============

    /// @notice Emit a validation signal
    /// @param signal The validation signal to emit
    function emitValidationSignal(ValidationSignal calldata signal) external;

    /// @notice Get provider metadata
    /// @return name Provider name
    /// @return version Provider version
    /// @return chainId Chain where provider operates
    function getProviderInfo() external view returns (string memory name, string memory version, uint256 chainId);

    /// @notice Check if this contract supports ERC-8004
    /// @return supported True if ERC-8004 provider
    function supportsERC8004() external pure returns (bool supported);
}
