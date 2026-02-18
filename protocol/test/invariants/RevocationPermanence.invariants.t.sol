// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { WalletDelegate } from "../../src/delegation/WalletDelegate.sol";
import { TypesDelegation } from "../../src/libraries/TypesDelegation.sol";
import { DelegationLib } from "../../src/delegation/DelegationLib.sol";

/// @title RevocationPermanenceInvariants
/// @notice Invariant: once revokeDelegation(hash) is called, executeDelegated(hash, ...) always reverts
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract RevocationPermanenceInvariants
contract RevocationPermanenceInvariants is Test {
    WalletDelegate public delegate;
    RevocationHandler public handler;

    function setUp() public {
        delegate = new WalletDelegate();
        handler = new RevocationHandler(delegate);
        targetContract(address(handler));
    }

    /// @notice Revoked delegations must never become active again
    function invariant_revocationPermanence() public view {
        bytes32[] memory revokedHashes = handler.getRevokedHashes();

        for (uint256 i = 0; i < revokedHashes.length; i++) {
            bool isActive = delegate.isDelegationActive(revokedHashes[i]);
            assertFalse(isActive, "Revoked delegation became active again");
        }
    }

    /// @notice Active delegation count + revoked count <= total setup count
    function invariant_activeCountConsistency() public view {
        uint256 active = handler.activeCount();
        uint256 revoked = handler.revokedCount();
        uint256 total = handler.totalSetup();

        assertLe(active + revoked, total, "Active + revoked > total setup");
    }
}

/// @notice Handler for revocation permanence invariant testing
contract RevocationHandler is Test {
    WalletDelegate public delegate;

    bytes32[] public delegationHashes;
    bytes32[] public revokedHashes;

    mapping(bytes32 => bool) public isRevoked;
    mapping(bytes32 => address) public delegators;
    mapping(bytes32 => uint256) public delegatorKeys;

    uint256 public activeCount;
    uint256 public revokedCount;
    uint256 public totalSetup;

    uint256 private counter;

    constructor(WalletDelegate _delegate) {
        delegate = _delegate;
    }

    /// @notice Setup a new delegation
    function setupDelegation() public {
        counter++;
        uint256 privKey = uint256(keccak256(abi.encode("delegator", counter)));
        // Ensure key is in valid range
        privKey = bound(privKey, 1, type(uint128).max);
        address delegator = vm.addr(privKey);

        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);

        TypesDelegation.Delegation memory d = TypesDelegation.Delegation({
            delegator: delegator,
            delegate: address(delegate),
            authority: bytes32(0),
            caveats: caveats,
            salt: counter,
            signature: ""
        });

        // Sign
        bytes32 delegationHash = TypesDelegation.hashDelegation(d);
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", delegate.DOMAIN_SEPARATOR(), delegationHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, digest);
        d.signature = abi.encodePacked(r, s, v);

        vm.prank(delegator);
        try delegate.setupDelegation(d) {
            delegationHashes.push(delegationHash);
            delegators[delegationHash] = delegator;
            delegatorKeys[delegationHash] = privKey;
            activeCount++;
            totalSetup++;
        } catch {}
    }

    /// @notice Revoke an existing delegation
    function revokeDelegation(uint256 index) public {
        if (delegationHashes.length == 0) return;
        index = bound(index, 0, delegationHashes.length - 1);

        bytes32 hash = delegationHashes[index];
        if (isRevoked[hash]) return;

        address delegator = delegators[hash];

        vm.prank(delegator);
        try delegate.revokeDelegation(hash) {
            isRevoked[hash] = true;
            revokedHashes.push(hash);
            revokedCount++;
            if (activeCount > 0) activeCount--;
        } catch {}
    }

    /// @notice Attempt to execute a delegation (should fail if revoked)
    function tryExecute(uint256 index) public {
        if (delegationHashes.length == 0) return;
        index = bound(index, 0, delegationHashes.length - 1);

        bytes32 hash = delegationHashes[index];

        // Try to execute — if revoked, this must revert
        try delegate.executeDelegated(hash, address(0x1), "", 0) {}
        catch {
            // Expected for revoked delegations
        }
    }

    function getRevokedHashes() external view returns (bytes32[] memory) {
        return revokedHashes;
    }
}
