// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SpendLimitEnforcer } from "../../src/enforcers/SpendLimitEnforcer.sol";
import { ICaveatEnforcer } from "../../src/interfaces/ICaveatEnforcer.sol";

/// @title SpendLimitEnforcer Tests
/// @notice Unit tests for daily and per-transaction spend limit enforcement
contract SpendLimitEnforcerTest is Test {
    SpendLimitEnforcer public enforcer;

    address public delegator = address(0x1);
    address public target = address(0x2);
    bytes32 public constant DELEGATION_HASH = keccak256("delegation1");
    address public constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    event SpendRecorded(
        bytes32 indexed delegationHash, address indexed token, uint256 amount, uint256 epochTotal, uint256 epoch
    );

    function setUp() public {
        enforcer = new SpendLimitEnforcer();
    }

    // ============ Native ETH Tests ============

    function test_BeforeHook_NativeETH_WithinLimits() public {
        bytes memory terms = abi.encode(address(0), 10 ether, 5 ether);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 1 ether);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, 1 ether);
    }

    function test_BeforeHook_NativeETH_ExactDailyLimit() public {
        bytes memory terms = abi.encode(address(0), 10 ether, 10 ether);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 10 ether);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, 10 ether);
    }

    function test_BeforeHook_NativeETH_RevertPerTxExceeded() public {
        bytes memory terms = abi.encode(address(0), 10 ether, 5 ether);

        vm.expectRevert(
            abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Per-transaction spend limit exceeded")
        );
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 6 ether);
    }

    function test_BeforeHook_NativeETH_RevertDailyExceeded() public {
        bytes memory terms = abi.encode(address(0), 10 ether, 6 ether);

        // First spend: 6 ETH
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 6 ether);

        // Second spend: 5 ETH (total 11 > 10 daily cap)
        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Daily spend limit exceeded"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 5 ether);
    }

    function test_BeforeHook_NativeETH_EpochReset() public {
        bytes memory terms = abi.encode(address(0), 10 ether, 10 ether);

        // Spend 10 ETH in epoch 1
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 10 ether);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, 10 ether);

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        // Should be able to spend again
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 10 ether);

        (spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, 10 ether);
    }

    // ============ ERC20 Tests ============

    function test_BeforeHook_ERC20Transfer_WithinLimits() public {
        bytes memory terms = abi.encode(USDC, 1000e6, 500e6);

        // ERC20 transfer(address,uint256) calldata
        bytes memory callData = abi.encodeWithSelector(0xa9059cbb, address(0x3), 100e6);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, USDC);
        assertEq(spent, 100e6);
    }

    function test_BeforeHook_ERC20Approve_WithinLimits() public {
        bytes memory terms = abi.encode(USDC, 1000e6, 500e6);

        // ERC20 approve(address,uint256) calldata
        bytes memory callData = abi.encodeWithSelector(0x095ea7b3, address(0x3), 200e6);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, USDC);
        assertEq(spent, 200e6);
    }

    function test_BeforeHook_ERC20Transfer_RevertPerTxExceeded() public {
        bytes memory terms = abi.encode(USDC, 1000e6, 500e6);

        bytes memory callData = abi.encodeWithSelector(0xa9059cbb, address(0x3), 600e6);

        vm.expectRevert(
            abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Per-transaction spend limit exceeded")
        );
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);
    }

    // ============ Event Tests ============

    function test_BeforeHook_EmitsSpendRecorded() public {
        bytes memory terms = abi.encode(address(0), 10 ether, 5 ether);
        uint256 epoch = block.timestamp / 1 days;

        vm.expectEmit(true, true, false, true);
        emit SpendRecorded(DELEGATION_HASH, address(0), 1 ether, 1 ether, epoch);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 1 ether);
    }

    // ============ View Tests ============

    function test_GetSpend_ReturnsZeroForNewEpoch() public view {
        (uint256 spent, uint256 epoch) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, 0);
        assertEq(epoch, block.timestamp / 1 days);
    }

    // ============ AfterHook Tests ============

    function test_AfterHook_NoOp() public {
        // afterHook should not revert
        enforcer.afterHook("", DELEGATION_HASH, delegator, target, "", 0);
    }
}
