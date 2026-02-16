// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICaveatEnforcer
/// @notice Interface for caveat enforcers per ERC-7710 delegation pattern
/// @dev Each enforcer validates a specific constraint (spend limit, time window, etc.)
interface ICaveatEnforcer {
    // ============ Errors ============

    error CaveatViolation(string reason);

    // ============ External Functions ============

    /// @notice Called before delegated execution to validate constraints
    /// @param terms ABI-encoded enforcer-specific parameters
    /// @param delegationHash Hash of the delegation being executed
    /// @param delegator Address of the EOA that created the delegation
    /// @param target Contract being called
    /// @param callData Encoded function call on target
    /// @param value ETH value being sent
    function beforeHook(
        bytes calldata terms,
        bytes32 delegationHash,
        address delegator,
        address target,
        bytes calldata callData,
        uint256 value
    ) external;

    /// @notice Called after delegated execution for post-execution validation
    /// @param terms ABI-encoded enforcer-specific parameters
    /// @param delegationHash Hash of the delegation being executed
    /// @param delegator Address of the EOA that created the delegation
    /// @param target Contract that was called
    /// @param callData Encoded function call that was executed
    /// @param value ETH value that was sent
    function afterHook(
        bytes calldata terms,
        bytes32 delegationHash,
        address delegator,
        address target,
        bytes calldata callData,
        uint256 value
    ) external;
}
