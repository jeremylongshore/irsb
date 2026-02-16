// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { TimeWindowEnforcer } from "../../src/enforcers/TimeWindowEnforcer.sol";
import { ICaveatEnforcer } from "../../src/interfaces/ICaveatEnforcer.sol";

/// @title TimeWindowEnforcer Tests
/// @notice Unit tests for time-based session bounds enforcement
contract TimeWindowEnforcerTest is Test {
    TimeWindowEnforcer public enforcer;

    address public delegator = address(0x1);
    address public target = address(0x2);
    bytes32 public constant DELEGATION_HASH = keccak256("delegation1");

    function setUp() public {
        enforcer = new TimeWindowEnforcer();
        // Set a known timestamp
        vm.warp(1_000_000);
    }

    // ============ Happy Path ============

    function test_BeforeHook_WithinWindow() public view {
        uint64 notBefore = uint64(block.timestamp - 1 hours);
        uint64 notAfter = uint64(block.timestamp + 1 hours);
        bytes memory terms = abi.encode(notBefore, notAfter);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_ExactStart() public view {
        uint64 notBefore = uint64(block.timestamp);
        uint64 notAfter = uint64(block.timestamp + 1 hours);
        bytes memory terms = abi.encode(notBefore, notAfter);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_ExactEnd() public view {
        uint64 notBefore = uint64(block.timestamp - 1 hours);
        uint64 notAfter = uint64(block.timestamp);
        bytes memory terms = abi.encode(notBefore, notAfter);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    // ============ Revert Cases ============

    function test_BeforeHook_RevertNotYetActive() public {
        uint64 notBefore = uint64(block.timestamp + 1 hours);
        uint64 notAfter = uint64(block.timestamp + 2 hours);
        bytes memory terms = abi.encode(notBefore, notAfter);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Delegation not yet active"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_RevertExpired() public {
        uint64 notBefore = uint64(block.timestamp - 2 hours);
        uint64 notAfter = uint64(block.timestamp - 1 hours);
        bytes memory terms = abi.encode(notBefore, notAfter);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Delegation expired"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    // ============ Time Progression ============

    function test_BeforeHook_ValidThenExpired() public {
        uint64 notBefore = uint64(block.timestamp);
        uint64 notAfter = uint64(block.timestamp + 1 hours);
        bytes memory terms = abi.encode(notBefore, notAfter);

        // Should work now
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);

        // Move past expiry
        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Delegation expired"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    // ============ AfterHook ============

    function test_AfterHook_NoOp() public {
        enforcer.afterHook("", DELEGATION_HASH, delegator, target, "", 0);
    }
}
