// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { NonceEnforcer } from "../../src/enforcers/NonceEnforcer.sol";
import { ICaveatEnforcer } from "../../src/interfaces/ICaveatEnforcer.sol";

/// @title NonceEnforcer Tests
/// @notice Unit tests for nonce-based replay prevention with expected nonce validation
contract NonceEnforcerTest is Test {
    NonceEnforcer public enforcer;

    address public delegator = address(0x1);
    address public target = address(0x2);
    bytes32 public constant DELEGATION_HASH = keccak256("delegation1");
    bytes32 public constant DELEGATION_HASH_2 = keccak256("delegation2");

    event NonceUsed(bytes32 indexed delegationHash, uint256 nonce);

    function setUp() public {
        enforcer = new NonceEnforcer();
    }

    // ============ Happy Path ============

    function test_BeforeHook_IncrementsNonce() public {
        // First call: expect nonce 0
        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH, delegator, target, "", 0);
        assertEq(enforcer.getNonce(DELEGATION_HASH), 1);

        // Second call: expect nonce 1
        enforcer.beforeHook(abi.encode(uint256(1)), DELEGATION_HASH, delegator, target, "", 0);
        assertEq(enforcer.getNonce(DELEGATION_HASH), 2);

        // Third call: expect nonce 2
        enforcer.beforeHook(abi.encode(uint256(2)), DELEGATION_HASH, delegator, target, "", 0);
        assertEq(enforcer.getNonce(DELEGATION_HASH), 3);
    }

    function test_BeforeHook_IsolatedPerDelegation() public {
        // Delegation 1: nonce 0, then 1
        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH, delegator, target, "", 0);
        enforcer.beforeHook(abi.encode(uint256(1)), DELEGATION_HASH, delegator, target, "", 0);

        // Delegation 2: nonce 0
        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH_2, delegator, target, "", 0);

        assertEq(enforcer.getNonce(DELEGATION_HASH), 2);
        assertEq(enforcer.getNonce(DELEGATION_HASH_2), 1);
    }

    // ============ Nonce Validation Tests (PM-SC-002 fix) ============

    function test_BeforeHook_RevertWrongExpectedNonce() public {
        // Current nonce is 0, but we provide expectedNonce=1 → should revert
        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Nonce mismatch"));
        enforcer.beforeHook(abi.encode(uint256(1)), DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_RevertReplayAttempt() public {
        // First call succeeds with nonce 0
        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH, delegator, target, "", 0);
        assertEq(enforcer.getNonce(DELEGATION_HASH), 1);

        // Replay attempt: same nonce 0 again → should revert
        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Nonce mismatch"));
        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_RevertSkippedNonce() public {
        // Current nonce is 0, try to use nonce 5 → should revert
        vm.expectRevert(abi.encodeWithSelector(ICaveatEnforcer.CaveatViolation.selector, "Nonce mismatch"));
        enforcer.beforeHook(abi.encode(uint256(5)), DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_SequentialNoncesSucceed() public {
        // Full sequential sequence 0 → 1 → 2 → 3
        for (uint256 i = 0; i < 4; i++) {
            enforcer.beforeHook(abi.encode(i), DELEGATION_HASH, delegator, target, "", 0);
            assertEq(enforcer.getNonce(DELEGATION_HASH), i + 1);
        }
    }

    // ============ Event Tests ============

    function test_BeforeHook_EmitsNonceUsed() public {
        vm.expectEmit(true, false, false, true);
        emit NonceUsed(DELEGATION_HASH, 0);

        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH, delegator, target, "", 0);
    }

    function test_BeforeHook_EmitsSequentialNonces() public {
        vm.expectEmit(true, false, false, true);
        emit NonceUsed(DELEGATION_HASH, 0);
        enforcer.beforeHook(abi.encode(uint256(0)), DELEGATION_HASH, delegator, target, "", 0);

        vm.expectEmit(true, false, false, true);
        emit NonceUsed(DELEGATION_HASH, 1);
        enforcer.beforeHook(abi.encode(uint256(1)), DELEGATION_HASH, delegator, target, "", 0);
    }

    // ============ View Tests ============

    function test_GetNonce_ReturnsZeroInitially() public view {
        assertEq(enforcer.getNonce(DELEGATION_HASH), 0);
    }

    // ============ AfterHook ============

    function test_AfterHook_NoOp() public {
        enforcer.afterHook("", DELEGATION_HASH, delegator, target, "", 0);
    }
}
