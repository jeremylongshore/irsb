// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICaveatEnforcer } from "../interfaces/ICaveatEnforcer.sol";

/// @title AllowedMethodsEnforcer
/// @notice Restricts delegated execution to a set of approved function selectors
/// @dev Terms: abi.encode(bytes4[] allowedSelectors)
contract AllowedMethodsEnforcer is ICaveatEnforcer {
    // ============ External Functions ============

    /// @inheritdoc ICaveatEnforcer
    function beforeHook(
        bytes calldata terms,
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
        bytes4[] memory allowedSelectors = abi.decode(terms, (bytes4[]));

        // Empty callData means plain ETH transfer — no selector to check
        if (callData.length < 4) {
            return;
        }

        bytes4 selector = bytes4(callData[:4]);

        bool allowed = false;
        for (uint256 i = 0; i < allowedSelectors.length; i++) {
            if (selector == allowedSelectors[i]) {
                allowed = true;
                break;
            }
        }

        if (!allowed) {
            revert CaveatViolation("Method selector not allowed");
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
        // No post-execution validation needed for method allowlist
    }
}
