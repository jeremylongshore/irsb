// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { AllowedTargetsEnforcer } from "../../src/enforcers/AllowedTargetsEnforcer.sol";
import { ICaveatEnforcer } from "../../src/interfaces/ICaveatEnforcer.sol";

/// @title AllowedTargetsEnforcer Tests
/// @notice Unit tests for target address allowlist enforcement
contract AllowedTargetsEnforcerTest is Test {
    AllowedTargetsEnforcer public enforcer;

    address public delegator = address(0x1);
    bytes32 public constant DELEGATION_HASH = keccak256("delegation1");

    address public constant TARGET_A = address(0xA);
    address public constant TARGET_B = address(0xB);
    address public constant TARGET_C = address(0xC);
    address public constant DISALLOWED = address(0xD);

    function setUp() public {
        enforcer = new AllowedTargetsEnforcer();
    }

    // ============ Happy Path ============

    function test_BeforeHook_SingleAllowedTarget() public view {
        address[] memory allowed = new address[](1);
        allowed[0] = TARGET_A;
        bytes memory terms = abi.encode(allowed);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, TARGET_A, "", 0);
    }

    function test_BeforeHook_MultipleAllowedTargets() public view {
        address[] memory allowed = new address[](3);
        allowed[0] = TARGET_A;
        allowed[1] = TARGET_B;
        allowed[2] = TARGET_C;
        bytes memory terms = abi.encode(allowed);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, TARGET_B, "", 0);
    }

    function test_BeforeHook_LastInList() public view {
        address[] memory allowed = new address[](3);
        allowed[0] = TARGET_A;
        allowed[1] = TARGET_B;
        allowed[2] = TARGET_C;
        bytes memory terms = abi.encode(allowed);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, TARGET_C, "", 0);
    }

    // ============ Revert Cases ============

    function test_BeforeHook_RevertDisallowedTarget() public {
        address[] memory allowed = new address[](2);
        allowed[0] = TARGET_A;
        allowed[1] = TARGET_B;
        bytes memory terms = abi.encode(allowed);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Target contract not allowed"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, DISALLOWED, "", 0);
    }

    function test_BeforeHook_RevertEmptyAllowlist() public {
        address[] memory allowed = new address[](0);
        bytes memory terms = abi.encode(allowed);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Target contract not allowed"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, TARGET_A, "", 0);
    }

    // ============ AfterHook ============

    function test_AfterHook_NoOp() public {
        enforcer.afterHook("", DELEGATION_HASH, delegator, TARGET_A, "", 0);
    }
}
