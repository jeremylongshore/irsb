// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICaveatEnforcer } from "../interfaces/ICaveatEnforcer.sol";

/// @title AllowedTargetsEnforcer
/// @notice Restricts delegated execution to a set of approved contract addresses
/// @dev Terms: abi.encode(address[] allowedTargets)
contract AllowedTargetsEnforcer is ICaveatEnforcer {
    // ============ External Functions ============

    /// @inheritdoc ICaveatEnforcer
    function beforeHook(
        bytes calldata terms,
        bytes32, /* delegationHash */
        address, /* delegator */
        address target,
        bytes calldata, /* callData */
        uint256 /* value */
    )
        external
        pure
        override
    {
        address[] memory allowedTargets = abi.decode(terms, (address[]));

        bool allowed = false;
        for (uint256 i = 0; i < allowedTargets.length; i++) {
            if (target == allowedTargets[i]) {
                allowed = true;
                break;
            }
        }

        if (!allowed) {
            revert CaveatViolation("Target contract not allowed");
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
        // No post-execution validation needed for target allowlist
    }
}
