// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TypesACP } from "../libraries/TypesACP.sol";

/// @title IACPHook
/// @notice Hook interface for EIP-8183 Agentic Commerce Protocol
/// @dev Hooks are called before and after job lifecycle actions
interface IACPHook {
    /// @notice Called before a job action is executed
    /// @param jobId The job being acted upon
    /// @param action The action about to be performed
    /// @param caller The address initiating the action
    /// @return Whether the action should proceed
    function beforeAction(uint256 jobId, TypesACP.Action action, address caller) external returns (bool);

    /// @notice Called after a job action is executed
    /// @param jobId The job that was acted upon
    /// @param action The action that was performed
    /// @param caller The address that initiated the action
    function afterAction(uint256 jobId, TypesACP.Action action, address caller) external;
}
