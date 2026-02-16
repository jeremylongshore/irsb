// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { WalletDelegate } from "../src/delegation/WalletDelegate.sol";
import { DelegationLib } from "../src/delegation/DelegationLib.sol";
import { IWalletDelegate } from "../src/interfaces/IWalletDelegate.sol";
import { ICaveatEnforcer } from "../src/interfaces/ICaveatEnforcer.sol";
import { TypesDelegation } from "../src/libraries/TypesDelegation.sol";
import { SpendLimitEnforcer } from "../src/enforcers/SpendLimitEnforcer.sol";
import { TimeWindowEnforcer } from "../src/enforcers/TimeWindowEnforcer.sol";
import { MockTarget } from "./helpers/MockTarget.sol";

/// @title WalletDelegate Tests
/// @notice Unit tests for delegation setup, revocation, and execution
contract WalletDelegateTest is Test {
    WalletDelegate public walletDelegate;
    SpendLimitEnforcer public spendEnforcer;
    TimeWindowEnforcer public timeEnforcer;
    MockTarget public mockTarget;

    uint256 public delegatorKey;
    address public delegator;
    address public executor = address(0x3);

    event DelegationSetup(bytes32 indexed delegationHash, address indexed delegator, uint256 caveatCount, uint256 salt);
    event DelegationRevoked(bytes32 indexed delegationHash, address indexed delegator);
    event DelegatedExecution(
        bytes32 indexed delegationHash, address indexed delegator, address indexed target, uint256 value
    );

    function setUp() public {
        walletDelegate = new WalletDelegate();
        spendEnforcer = new SpendLimitEnforcer();
        timeEnforcer = new TimeWindowEnforcer();
        mockTarget = new MockTarget();

        // Create delegator with known private key
        delegatorKey = 0xA11CE;
        delegator = vm.addr(delegatorKey);
        vm.deal(delegator, 10 ether);
        vm.deal(address(walletDelegate), 10 ether);
    }

    // ============ Helpers ============

    function _buildDelegation(TypesDelegation.Caveat[] memory caveats, uint256 salt)
        internal
        view
        returns (TypesDelegation.Delegation memory delegation)
    {
        delegation.delegator = delegator;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = salt;

        // Sign with EIP-712
        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest = _computeDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey, digest);
        delegation.signature = abi.encodePacked(r, s, v);
    }

    function _computeDigest(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", walletDelegate.DOMAIN_SEPARATOR(), structHash));
    }

    function _buildNoCaveatDelegation(uint256 salt) internal view returns (TypesDelegation.Delegation memory) {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);
        return _buildDelegation(caveats, salt);
    }

    function _buildSpendLimitDelegation(uint256 dailyCap, uint256 perTxCap, uint256 salt)
        internal
        view
        returns (TypesDelegation.Delegation memory)
    {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](1);
        caveats[0] = TypesDelegation.Caveat({
            enforcer: address(spendEnforcer), terms: abi.encode(address(0), dailyCap, perTxCap)
        });
        return _buildDelegation(caveats, salt);
    }

    // ============ Setup Tests ============

    function test_SetupDelegation() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        TypesDelegation.StoredDelegation memory stored = walletDelegate.getDelegation(delegationHash);
        assertEq(stored.delegator, delegator);
        assertTrue(stored.active);
        assertEq(stored.revokedAt, 0);
    }

    function test_SetupDelegation_EmitsEvent() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        vm.expectEmit(true, true, false, true);
        emit DelegationSetup(delegationHash, delegator, 0, 1);

        walletDelegate.setupDelegation(delegation);
    }

    function test_SetupDelegation_WithCaveats() public {
        TypesDelegation.Delegation memory delegation = _buildSpendLimitDelegation(10 ether, 5 ether, 2);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        TypesDelegation.StoredDelegation memory stored = walletDelegate.getDelegation(delegationHash);
        assertTrue(stored.active);
    }

    function test_SetupDelegation_RevertAlreadyExists() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);

        walletDelegate.setupDelegation(delegation);

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationAlreadyExists.selector));
        walletDelegate.setupDelegation(delegation);
    }

    function test_SetupDelegation_RevertInvalidDelegate() public {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);

        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegator;
        delegation.delegate = address(0xDEAD); // Wrong delegate
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = 1;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest = _computeDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.InvalidDelegate.selector));
        walletDelegate.setupDelegation(delegation);
    }

    function test_SetupDelegation_RevertInvalidSignature() public {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);

        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegator;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = 1;

        // Sign with wrong key
        uint256 wrongKey = 0xB0B;
        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest = _computeDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.InvalidSignature.selector));
        walletDelegate.setupDelegation(delegation);
    }

    function test_SetupDelegation_RevertInvalidCaveat() public {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](1);
        caveats[0] = TypesDelegation.Caveat({ enforcer: address(0), terms: "" });

        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegator;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = 1;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest = _computeDigest(structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.InvalidCaveat.selector));
        walletDelegate.setupDelegation(delegation);
    }

    // ============ Revocation Tests ============

    function test_RevokeDelegation() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        vm.prank(delegator);
        walletDelegate.revokeDelegation(delegationHash);

        TypesDelegation.StoredDelegation memory stored = walletDelegate.getDelegation(delegationHash);
        assertFalse(stored.active);
        assertGt(stored.revokedAt, 0);
    }

    function test_RevokeDelegation_EmitsEvent() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        vm.expectEmit(true, true, false, false);
        emit DelegationRevoked(delegationHash, delegator);

        vm.prank(delegator);
        walletDelegate.revokeDelegation(delegationHash);
    }

    function test_RevokeDelegation_RevertNotDelegator() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.NotDelegator.selector));
        walletDelegate.revokeDelegation(delegationHash);
    }

    function test_RevokeDelegation_RevertNotFound() public {
        bytes32 fakeHash = keccak256("fake");

        vm.prank(delegator);
        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationNotFound.selector));
        walletDelegate.revokeDelegation(fakeHash);
    }

    // ============ Execution Tests ============

    function test_ExecuteDelegated() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, 42);
        walletDelegate.executeDelegated(delegationHash, address(mockTarget), callData, 0);

        assertEq(mockTarget.value(), 42);
    }

    function test_ExecuteDelegated_WithETH() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        bytes memory callData = abi.encodeWithSelector(MockTarget.receiveETH.selector);
        walletDelegate.executeDelegated{ value: 1 ether }(delegationHash, address(mockTarget), callData, 1 ether);

        assertEq(address(mockTarget).balance, 1 ether);
    }

    function test_ExecuteDelegated_EmitsEvent() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        vm.expectEmit(true, true, true, true);
        emit DelegatedExecution(delegationHash, delegator, address(mockTarget), 0);

        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, 42);
        walletDelegate.executeDelegated(delegationHash, address(mockTarget), callData, 0);
    }

    function test_ExecuteDelegated_WithSpendLimit() public {
        TypesDelegation.Delegation memory delegation = _buildSpendLimitDelegation(10 ether, 5 ether, 3);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        bytes memory callData = abi.encodeWithSelector(MockTarget.receiveETH.selector);
        walletDelegate.executeDelegated{ value: 1 ether }(delegationHash, address(mockTarget), callData, 1 ether);

        assertEq(address(mockTarget).balance, 1 ether);
    }

    // WD-1: executeDelegated() reverts if delegation is revoked
    function test_ExecuteDelegated_RevertAfterRevocation() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        vm.prank(delegator);
        walletDelegate.revokeDelegation(delegationHash);

        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, 42);
        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationNotActive.selector));
        walletDelegate.executeDelegated(delegationHash, address(mockTarget), callData, 0);
    }

    function test_ExecuteDelegated_RevertNotFound() public {
        bytes32 fakeHash = keccak256("fake");

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationNotFound.selector));
        walletDelegate.executeDelegated(fakeHash, address(mockTarget), "", 0);
    }

    function test_ExecuteDelegated_RevertTargetReverts() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        bytes memory callData = abi.encodeWithSelector(MockTarget.alwaysRevert.selector);
        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.ExecutionFailed.selector));
        walletDelegate.executeDelegated(delegationHash, address(mockTarget), callData, 0);
    }

    // ============ View Tests ============

    function test_IsDelegationActive() public {
        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        assertFalse(walletDelegate.isDelegationActive(delegationHash));

        walletDelegate.setupDelegation(delegation);
        assertTrue(walletDelegate.isDelegationActive(delegationHash));

        vm.prank(delegator);
        walletDelegate.revokeDelegation(delegationHash);
        assertFalse(walletDelegate.isDelegationActive(delegationHash));
    }

    // ============ Admin Tests ============

    function test_Pause_BlocksSetup() public {
        walletDelegate.pause();

        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        walletDelegate.setupDelegation(delegation);
    }

    function test_Unpause_AllowsSetup() public {
        walletDelegate.pause();
        walletDelegate.unpause();

        TypesDelegation.Delegation memory delegation = _buildNoCaveatDelegation(1);
        walletDelegate.setupDelegation(delegation);
    }
}
