// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICaveatEnforcer } from "../interfaces/ICaveatEnforcer.sol";

/// @title SpendLimitEnforcer
/// @notice Enforces daily and per-transaction spend limits on delegated executions
/// @dev Terms: abi.encode(address token, uint256 dailyCap, uint256 perTxCap)
contract SpendLimitEnforcer is ICaveatEnforcer {
    // ============ Structs ============

    struct SpendState {
        uint256 totalSpent; // Total spent in current epoch
        uint256 epoch; // Last epoch number (block.timestamp / 1 days)
    }

    // ============ State ============

    /// @notice Spend tracking per delegation per token: delegationHash => token => SpendState
    mapping(bytes32 => mapping(address => SpendState)) public spendState;

    // ============ Events ============

    event SpendRecorded(
        bytes32 indexed delegationHash, address indexed token, uint256 amount, uint256 epochTotal, uint256 epoch
    );

    // ============ External Functions ============

    /// @inheritdoc ICaveatEnforcer
    function beforeHook(
        bytes calldata terms,
        bytes32 delegationHash,
        address, /* delegator */
        address, /* target */
        bytes calldata callData,
        uint256 value
    ) external override {
        (address token, uint256 dailyCap, uint256 perTxCap) = abi.decode(terms, (address, uint256, uint256));

        // Determine spend amount from calldata or value
        uint256 spendAmount = _extractSpendAmount(token, callData, value);

        // Check per-transaction limit
        if (spendAmount > perTxCap) {
            revert CaveatViolation("Per-transaction spend limit exceeded");
        }

        // Calculate current epoch
        uint256 currentEpoch = block.timestamp / 1 days;

        // Get or reset epoch state
        SpendState storage state = spendState[delegationHash][token];
        if (state.epoch != currentEpoch) {
            state.totalSpent = 0;
            state.epoch = currentEpoch;
        }

        // Check daily limit
        uint256 newTotal = state.totalSpent + spendAmount;
        if (newTotal > dailyCap) {
            revert CaveatViolation("Daily spend limit exceeded");
        }

        // Record spend
        state.totalSpent = newTotal;

        emit SpendRecorded(delegationHash, token, spendAmount, newTotal, currentEpoch);
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
        // No post-execution validation needed for spend limits
    }

    // ============ View Functions ============

    /// @notice Get current epoch spend for a delegation and token
    /// @param delegationHash The delegation hash
    /// @param token The token address
    /// @return spent Current epoch spend
    /// @return epoch Current epoch number
    function getSpend(bytes32 delegationHash, address token) external view returns (uint256 spent, uint256 epoch) {
        SpendState storage state = spendState[delegationHash][token];
        uint256 currentEpoch = block.timestamp / 1 days;
        if (state.epoch == currentEpoch) {
            return (state.totalSpent, currentEpoch);
        }
        return (0, currentEpoch);
    }

    // ============ Internal Functions ============

    /// @notice Extract the spend amount from calldata or msg.value
    /// @dev For native ETH (token == address(0)), uses value. For ERC20, decodes transfer amount.
    function _extractSpendAmount(address token, bytes calldata callData, uint256 value)
        internal
        pure
        returns (uint256)
    {
        if (token == address(0)) {
            return value;
        }

        // ERC20 transfer/transferFrom/approve
        if (callData.length >= 68) {
            bytes4 selector = bytes4(callData[:4]);
            // transfer(address,uint256) = 0xa9059cbb
            // approve(address,uint256) = 0x095ea7b3
            if (selector == 0xa9059cbb || selector == 0x095ea7b3) {
                (, uint256 amount) = abi.decode(callData[4:68], (address, uint256));
                return amount;
            }
            // transferFrom(address,address,uint256) = 0x23b872dd
            if (selector == 0x23b872dd && callData.length >= 100) {
                (,, uint256 amount) = abi.decode(callData[4:100], (address, address, uint256));
                return amount;
            }
        }

        return value;
    }
}
