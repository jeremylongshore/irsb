// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title MockTarget
/// @notice Simple target contract for delegation execution tests
contract MockTarget {
    uint256 public value;
    address public lastCaller;

    event ValueSet(uint256 newValue, address caller);
    event ETHReceived(uint256 amount, address sender);

    function setValue(uint256 newValue) external {
        value = newValue;
        lastCaller = msg.sender;
        emit ValueSet(newValue, msg.sender);
    }

    function receiveETH() external payable {
        emit ETHReceived(msg.value, msg.sender);
    }

    function alwaysRevert() external pure {
        revert("MockTarget: always reverts");
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable { }
}
