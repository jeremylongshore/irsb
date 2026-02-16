// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IValidationRegistry
/// @notice Interface for external validation registries (ERC-8004 style)
/// @dev IRSB acts as a Validation Provider, pushing signals to external registries
interface IValidationRegistry {
    /// @notice Record a validation event
    /// @param taskId Unique task/receipt identifier
    /// @param agentId Agent/solver identifier
    /// @param success Whether validation was successful
    function recordValidation(bytes32 taskId, bytes32 agentId, bool success) external;

    /// @notice Get validation count for an agent
    /// @param agentId Agent/solver to query
    /// @return total Total validations
    /// @return successful Successful validations
    function getValidationCount(bytes32 agentId) external view returns (uint256 total, uint256 successful);

    /// @notice Get validation details for a task
    /// @param taskId Task/receipt to query
    /// @return agentId Agent that performed the task
    /// @return success Whether validation succeeded
    /// @return timestamp When validation was recorded
    function getValidation(bytes32 taskId) external view returns (bytes32 agentId, bool success, uint64 timestamp);

    /// @notice Check if task has been validated
    /// @param taskId Task to check
    /// @return validated Whether task has validation record
    function isValidated(bytes32 taskId) external view returns (bool validated);
}
