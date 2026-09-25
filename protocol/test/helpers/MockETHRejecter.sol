// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title MockETHRejecter
/// @notice Contract that rejects ETH transfers (no receive/fallback)
/// @dev Used to test all "Transfer failed" revert paths
contract MockETHRejecter {
    // Intentionally no receive() or fallback()
    // Any ETH sent to this contract will revert
}
