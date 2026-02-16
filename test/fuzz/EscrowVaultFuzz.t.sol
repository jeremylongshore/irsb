// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { IEscrowVault } from "../../src/interfaces/IEscrowVault.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";

/// @title EscrowVault Fuzz Tests
/// @notice Fuzz tests for escrow vault - run with 10k iterations in CI
contract EscrowVaultFuzzTest is Test {
    EscrowVault public vault;
    MockERC20 public token;

    address public hub = address(0x1);
    address public depositor = address(0x2);
    address public recipient = address(0x3);

    function setUp() public {
        vault = new EscrowVault();
        token = new MockERC20("Test Token", "TEST", 18);

        vault.setAuthorizedHub(hub, true);
        vm.deal(depositor, 1000 ether);

        token.mint(depositor, type(uint256).max / 2);
        vm.prank(depositor);
        token.approve(address(vault), type(uint256).max);
    }

    receive() external payable { }

    // ============ Invariant: Balance Consistency ============

    /// @notice Fuzz test: escrow amount matches contract balance (native)
    function testFuzz_NativeBalanceConsistency(uint256 amount, uint64 deadlineOffset) public {
        amount = bound(amount, 1, 100 ether);
        deadlineOffset = uint64(bound(deadlineOffset, 1, 365 days));

        bytes32 escrowId = keccak256(abi.encode(amount, deadlineOffset));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp) + deadlineOffset;

        uint256 vaultBalanceBefore = address(vault).balance;

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        // Balance should increase by amount
        assertEq(address(vault).balance, vaultBalanceBefore + amount);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(escrowId);
        assertEq(escrow.amount, amount);
    }

    /// @notice Fuzz test: escrow amount matches contract balance (ERC20)
    function testFuzz_ERC20BalanceConsistency(uint256 amount, uint64 deadlineOffset) public {
        amount = bound(amount, 1, 1000 ether);
        deadlineOffset = uint64(bound(deadlineOffset, 1, 365 days));

        bytes32 escrowId = keccak256(abi.encode("erc20", amount, deadlineOffset));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp) + deadlineOffset;

        uint256 vaultBalanceBefore = token.balanceOf(address(vault));

        vm.prank(depositor);
        vault.createEscrowERC20(escrowId, receiptId, depositor, address(token), amount, deadline);

        assertEq(token.balanceOf(address(vault)), vaultBalanceBefore + amount);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(escrowId);
        assertEq(escrow.amount, amount);
    }

    // ============ Invariant: Status Finality ============

    /// @notice Fuzz test: released escrow cannot be released again
    function testFuzz_ReleasedIsImmutable(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("release", amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        vm.prank(hub);
        vault.release(escrowId, recipient);

        // Status should be Released
        assertEq(uint256(vault.getStatus(escrowId)), uint256(IEscrowVault.EscrowStatus.Released));

        // Second release should fail
        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("EscrowNotActive()"));
        vault.release(escrowId, recipient);
    }

    /// @notice Fuzz test: refunded escrow cannot be refunded again
    function testFuzz_RefundedIsImmutable(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("refund", amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        vm.prank(hub);
        vault.refund(escrowId);

        assertEq(uint256(vault.getStatus(escrowId)), uint256(IEscrowVault.EscrowStatus.Refunded));

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("EscrowNotActive()"));
        vault.refund(escrowId);
    }

    /// @notice Fuzz test: released escrow cannot be refunded
    function testFuzz_ReleasedCannotBeRefunded(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("release-refund", amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        vm.prank(hub);
        vault.release(escrowId, recipient);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("EscrowNotActive()"));
        vault.refund(escrowId);
    }

    // ============ Invariant: Full Amount Transfer ============

    /// @notice Fuzz test: release transfers full amount to recipient (native)
    function testFuzz_ReleaseFullAmountNative(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("full-release", amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        uint256 recipientBefore = recipient.balance;

        vm.prank(hub);
        vault.release(escrowId, recipient);

        assertEq(recipient.balance, recipientBefore + amount);
    }

    /// @notice Fuzz test: refund transfers full amount to depositor (native)
    function testFuzz_RefundFullAmountNative(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("full-refund", amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        uint256 depositorBefore = depositor.balance;

        vm.prank(hub);
        vault.refund(escrowId);

        assertEq(depositor.balance, depositorBefore + amount);
    }

    /// @notice Fuzz test: release transfers full amount to recipient (ERC20)
    function testFuzz_ReleaseFullAmountERC20(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);

        bytes32 escrowId = keccak256(abi.encode("erc20-release", amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(escrowId, receiptId, depositor, address(token), amount, deadline);

        uint256 recipientBefore = token.balanceOf(recipient);

        vm.prank(hub);
        vault.release(escrowId, recipient);

        assertEq(token.balanceOf(recipient), recipientBefore + amount);
    }

    // ============ Invariant: Escrow ID Uniqueness ============

    /// @notice Fuzz test: each escrow has unique ID
    function testFuzz_EscrowIdUniqueness(bytes32 escrowId1, bytes32 escrowId2, uint256 amount) public {
        vm.assume(escrowId1 != escrowId2);
        amount = bound(amount, 1, 50 ether);

        bytes32 receiptId1 = keccak256(abi.encode("receipt1", escrowId1));
        bytes32 receiptId2 = keccak256(abi.encode("receipt2", escrowId2));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.startPrank(depositor);
        vault.createEscrow{ value: amount }(escrowId1, receiptId1, depositor, deadline);
        vault.createEscrow{ value: amount }(escrowId2, receiptId2, depositor, deadline);
        vm.stopPrank();

        // Both should exist independently
        assertTrue(vault.isActive(escrowId1));
        assertTrue(vault.isActive(escrowId2));

        // Release one, other should still be active
        vm.prank(hub);
        vault.release(escrowId1, recipient);

        assertFalse(vault.isActive(escrowId1));
        assertTrue(vault.isActive(escrowId2));
    }

    // ============ Invariant: Authorization ============

    /// @notice Fuzz test: only authorized callers can release
    function testFuzz_OnlyAuthorizedCanRelease(address caller, uint256 amount) public {
        vm.assume(caller != hub && caller != address(this)); // not owner or hub
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("auth", caller, amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedCaller()"));
        vault.release(escrowId, recipient);
    }

    /// @notice Fuzz test: only authorized callers can refund
    function testFuzz_OnlyAuthorizedCanRefund(address caller, uint256 amount) public {
        vm.assume(caller != hub && caller != address(this));
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("auth-refund", caller, amount));
        bytes32 receiptId = keccak256(abi.encode("receipt", amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedCaller()"));
        vault.refund(escrowId);
    }

    // ============ Invariant: Deadline Validation ============

    /// @notice Fuzz test: deadline must be in the future
    function testFuzz_DeadlineMustBeFuture(uint64 deadlineOffset) public {
        // Test deadlines in the past or exactly now
        deadlineOffset = uint64(bound(deadlineOffset, 0, block.timestamp));

        bytes32 escrowId = keccak256(abi.encode("deadline", deadlineOffset));
        bytes32 receiptId = keccak256(abi.encode("receipt"));

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
        vault.createEscrow{ value: 1 ether }(escrowId, receiptId, depositor, uint64(deadlineOffset));
    }

    // ============ Invariant: Total Tracking ============

    /// @notice Fuzz test: totalEscrows increments correctly
    function testFuzz_TotalEscrowsIncrement(uint8 numEscrows) public {
        numEscrows = uint8(bound(numEscrows, 1, 20));

        uint64 deadline = uint64(block.timestamp + 1 days);

        for (uint256 i = 0; i < numEscrows; i++) {
            bytes32 escrowId = keccak256(abi.encode("total", i));
            bytes32 receiptId = keccak256(abi.encode("receipt", i));

            vm.prank(depositor);
            vault.createEscrow{ value: 0.1 ether }(escrowId, receiptId, depositor, deadline);
        }

        assertEq(vault.totalEscrows(), numEscrows);
    }

    // ============ Edge Case: Receipt Mapping ============

    /// @notice Fuzz test: receipt to escrow mapping is correct
    function testFuzz_ReceiptMapping(bytes32 receiptId, uint256 amount) public {
        vm.assume(receiptId != bytes32(0));
        amount = bound(amount, 1, 100 ether);

        bytes32 escrowId = keccak256(abi.encode("mapping", receiptId, amount));
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        bytes32 foundEscrowId = vault.getEscrowByReceipt(receiptId);
        assertEq(foundEscrowId, escrowId);
    }
}
