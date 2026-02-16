// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICaveatEnforcer } from "../interfaces/ICaveatEnforcer.sol";

/// @title TimeWindowEnforcer
/// @notice Enforces time-based session bounds on delegated executions
/// @dev Terms: abi.encode(uint64 notBefore, uint64 notAfter)
contract TimeWindowEnforcer is ICaveatEnforcer {
    // ============ External Functions ============

    /// @inheritdoc ICaveatEnforcer
    function beforeHook(
        bytes calldata terms,
        bytes32, /* delegationHash */
        address, /* delegator */
        address, /* target */
        bytes calldata, /* callData */
        uint256 /* value */
    )
        external
        view
        override
    {
        (uint64 notBefore, uint64 notAfter) = abi.decode(terms, (uint64, uint64));

        if (block.timestamp < notBefore) {
            revert CaveatViolation("Delegation not yet active");
        }

        if (block.timestamp > notAfter) {
            revert CaveatViolation("Delegation expired");
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
        // No post-execution validation needed for time windows
    }
}
