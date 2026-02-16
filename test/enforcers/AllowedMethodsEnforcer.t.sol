// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { AllowedMethodsEnforcer } from "../../src/enforcers/AllowedMethodsEnforcer.sol";
import { ICaveatEnforcer } from "../../src/interfaces/ICaveatEnforcer.sol";

/// @title AllowedMethodsEnforcer Tests
/// @notice Unit tests for function selector allowlist enforcement
contract AllowedMethodsEnforcerTest is Test {
    AllowedMethodsEnforcer public enforcer;

    address public delegator = address(0x1);
    address public target = address(0x2);
    bytes32 public constant DELEGATION_HASH = keccak256("delegation1");

    // Common selectors
    bytes4 public constant TRANSFER = 0xa9059cbb; // transfer(address,uint256)
    bytes4 public constant APPROVE = 0x095ea7b3; // approve(address,uint256)
    bytes4 public constant SETTLE = bytes4(keccak256("settlePayment(bytes32,address,uint256,address)"));

    function setUp() public {
        enforcer = new AllowedMethodsEnforcer();
    }

    // ============ Happy Path ============

    function test_BeforeHook_SingleAllowedMethod() public view {
        bytes4[] memory allowed = new bytes4[](1);
        allowed[0] = TRANSFER;
        bytes memory terms = abi.encode(allowed);

        bytes memory callData = abi.encodeWithSelector(TRANSFER, address(0x3), 100);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);
    }

    function test_BeforeHook_MultipleAllowedMethods() public view {
        bytes4[] memory allowed = new bytes4[](3);
        allowed[0] = TRANSFER;
        allowed[1] = APPROVE;
        allowed[2] = SETTLE;
        bytes memory terms = abi.encode(allowed);

        bytes memory callData = abi.encodeWithSelector(APPROVE, address(0x3), 100);

        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);
    }

    // ============ Revert Cases ============

    function test_BeforeHook_RevertDisallowedMethod() public {
        bytes4[] memory allowed = new bytes4[](1);
        allowed[0] = TRANSFER;
        bytes memory terms = abi.encode(allowed);

        bytes memory callData = abi.encodeWithSelector(APPROVE, address(0x3), 100);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Method selector not allowed"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);
    }

    function test_BeforeHook_EmptyCallData_Passes() public view {
        bytes4[] memory allowed = new bytes4[](1);
        allowed[0] = TRANSFER;
        bytes memory terms = abi.encode(allowed);

        // Empty callData = plain ETH transfer, no selector to check — passes
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_ShortCallData_Passes() public view {
        bytes4[] memory allowed = new bytes4[](1);
        allowed[0] = TRANSFER;
        bytes memory terms = abi.encode(allowed);

        // Short callData (< 4 bytes) = no selector to check — passes
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, hex"aabbcc", 0);
    }

    function test_BeforeHook_RevertEmptyAllowlist() public {
        bytes4[] memory allowed = new bytes4[](0);
        bytes memory terms = abi.encode(allowed);

        bytes memory callData = abi.encodeWithSelector(TRANSFER, address(0x3), 100);

        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Method selector not allowed"));
        enforcer.beforeHook(terms, DELEGATION_HASH, delegator, target, callData, 0);
    }

    // ============ AfterHook ============

    function test_AfterHook_NoOp() public {
        enforcer.afterHook("", DELEGATION_HASH, delegator, target, "", 0);
    }
}
