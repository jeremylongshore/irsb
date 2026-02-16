// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { WalletDelegate } from "../../src/delegation/WalletDelegate.sol";
import { IWalletDelegate } from "../../src/interfaces/IWalletDelegate.sol";
import { TypesDelegation } from "../../src/libraries/TypesDelegation.sol";
import { MockTarget } from "../helpers/MockTarget.sol";

/// @title WalletDelegate Fuzz Tests
/// @notice Property-based tests for delegation invariants
contract WalletDelegateFuzzTest is Test {
    WalletDelegate public walletDelegate;
    MockTarget public mockTarget;

    uint256 public delegatorKey;
    address public delegator;

    function setUp() public {
        walletDelegate = new WalletDelegate();
        mockTarget = new MockTarget();

        delegatorKey = 0xA11CE;
        delegator = vm.addr(delegatorKey);
        vm.deal(address(walletDelegate), 100 ether);
    }

    function _buildDelegation(uint256 salt) internal view returns (TypesDelegation.Delegation memory delegation) {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);
        delegation.delegator = delegator;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = salt;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", walletDelegate.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey, digest);
        delegation.signature = abi.encodePacked(r, s, v);
    }

    /// @notice WD-1: Revoked delegations always revert on execution
    function testFuzz_RevokedDelegationAlwaysReverts(uint256 salt, uint256 targetValue) public {
        salt = bound(salt, 1, type(uint128).max);

        TypesDelegation.Delegation memory delegation = _buildDelegation(salt);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        vm.prank(delegator);
        walletDelegate.revokeDelegation(delegationHash);

        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, targetValue);
        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationNotActive.selector));
        walletDelegate.executeDelegated(delegationHash, address(mockTarget), callData, 0);
    }

    /// @notice Different salts produce different delegation hashes
    function testFuzz_UniqueSaltsProduceUniqueHashes(uint256 salt1, uint256 salt2) public {
        vm.assume(salt1 != salt2);

        TypesDelegation.Delegation memory d1 = _buildDelegation(salt1);
        TypesDelegation.Delegation memory d2 = _buildDelegation(salt2);

        bytes32 hash1 = TypesDelegation.hashDelegation(d1);
        bytes32 hash2 = TypesDelegation.hashDelegation(d2);

        assertNotEq(hash1, hash2);
    }

    /// @notice Active delegation can always execute simple calls
    function testFuzz_ActiveDelegationExecutes(uint256 salt, uint256 targetValue) public {
        salt = bound(salt, 1, type(uint128).max);

        TypesDelegation.Delegation memory delegation = _buildDelegation(salt);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.setupDelegation(delegation);

        bytes memory callData = abi.encodeWithSelector(MockTarget.setValue.selector, targetValue);
        walletDelegate.executeDelegated(delegationHash, address(mockTarget), callData, 0);

        assertEq(mockTarget.value(), targetValue);
    }
}
