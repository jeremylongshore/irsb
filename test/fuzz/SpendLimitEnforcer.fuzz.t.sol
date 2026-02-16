// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SpendLimitEnforcer } from "../../src/enforcers/SpendLimitEnforcer.sol";
import { ICaveatEnforcer } from "../../src/interfaces/ICaveatEnforcer.sol";

/// @title SpendLimitEnforcer Fuzz Tests
/// @notice Property-based tests for spend limit enforcement invariants
contract SpendLimitEnforcerFuzzTest is Test {
    SpendLimitEnforcer public enforcer;

    address public delegator = address(0x1);
    address public target = address(0x2);
    bytes32 public constant DELEGATION_HASH = keccak256("delegation1");

    function setUp() public {
        enforcer = new SpendLimitEnforcer();
    }

    /// @notice SLE-1: totalSpent never exceeds dailyCap within an epoch
    function testFuzz_SpendNeverExceedsDailyCap(uint256 dailyCap, uint256 perTxCap, uint256 amount) public {
        // Bound to reasonable values
        dailyCap = bound(dailyCap, 1, 1000 ether);
        perTxCap = bound(perTxCap, 1, dailyCap);
        amount = bound(amount, 1, perTxCap);

        bytes memory terms = abi.encode(address(0), dailyCap, perTxCap);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", amount);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertLe(spent, dailyCap);
    }

    /// @notice Per-tx amounts above perTxCap always revert
    function testFuzz_PerTxOverCapAlwaysReverts(uint256 dailyCap, uint256 perTxCap, uint256 amount) public {
        dailyCap = bound(dailyCap, 2, 1000 ether);
        perTxCap = bound(perTxCap, 1, dailyCap - 1);
        amount = bound(amount, perTxCap + 1, type(uint128).max);

        bytes memory terms = abi.encode(address(0), dailyCap, perTxCap);

        vm.expectRevert(
            abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Per-transaction spend limit exceeded")
        );
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", amount);
    }

    /// @notice Epoch boundaries correctly reset spend tracking
    function testFuzz_EpochResetClearsSpend(uint256 dailyCap, uint256 amount, uint256 timeSkip) public {
        dailyCap = bound(dailyCap, 1, 1000 ether);
        amount = bound(amount, 1, dailyCap);
        timeSkip = bound(timeSkip, 1 days, 365 days);

        bytes memory terms = abi.encode(address(0), dailyCap, dailyCap);

        // Spend up to daily cap
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", amount);

        // Skip to new epoch
        vm.warp(block.timestamp + timeSkip);

        // Should be able to spend again
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", amount);

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, amount);
    }

    /// @notice Multiple small spends that sum to exactly dailyCap succeed
    function testFuzz_MultipleSmallSpendsUpToCap(uint256 dailyCap, uint8 numTxs) public {
        dailyCap = bound(dailyCap, 10, 1000 ether);
        numTxs = uint8(bound(numTxs, 1, 10));

        uint256 perTx = dailyCap / numTxs;
        if (perTx == 0) return;

        bytes memory terms = abi.encode(address(0), dailyCap, perTx);

        for (uint8 i = 0; i < numTxs; i++) {
            enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", perTx);
        }

        (uint256 spent,) = enforcer.getSpend(DELEGATION_HASH, address(0));
        assertEq(spent, perTx * numTxs);
        assertLe(spent, dailyCap);
    }
}
