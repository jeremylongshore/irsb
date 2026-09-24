// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICaveatEnforcer } from "../interfaces/ICaveatEnforcer.sol";
import { IAgenticCommerce } from "../interfaces/IAgenticCommerce.sol";

/// @title ACPMethodEnforcer
/// @notice Restricts EIP-7702 delegated agents to safe ACP function selectors
/// @dev Allows acceptJob and submitResult; denies claimRefund, completeJob, and rejectJob
contract ACPMethodEnforcer is ICaveatEnforcer {
    /// @notice Selectors that delegated agents are allowed to call
    bytes4 public constant ACCEPT_JOB_SELECTOR = IAgenticCommerce.acceptJob.selector;
    bytes4 public constant SUBMIT_RESULT_SELECTOR = IAgenticCommerce.submitResult.selector;

    /// @inheritdoc ICaveatEnforcer
    function beforeHook(
        bytes calldata, /* terms */
        bytes32, /* delegationHash */
        address, /* delegator */
        address, /* target */
        bytes calldata callData,
        uint256 /* value */
    )
        external
        pure
        override
    {
        // Empty callData means plain ETH transfer — no selector to check
        if (callData.length < 4) {
            return;
        }

        bytes4 selector = bytes4(callData[:4]);

        if (selector != ACCEPT_JOB_SELECTOR && selector != SUBMIT_RESULT_SELECTOR) {
            revert CaveatViolation("ACP method not allowed for delegated agent");
        }
    }

    /// @inheritdoc ICaveatEnforcer
    function afterHook(
        bytes calldata, /* terms */
        bytes32, /* delegationHash */
        address, /* delegator */
        address, /* target */
        bytes calldata, /* callData */
        uint256 /* value */
    )
        external
        pure
        override
    {
        // No post-execution validation needed
    }
}
