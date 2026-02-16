// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { IEscrowVault } from "../src/interfaces/IEscrowVault.sol";

/// @title EscrowVault Tests (Native ETH)
/// @notice Unit tests for native ETH escrow functionality
contract EscrowVaultTest is Test {
    EscrowVault public vault;

    address public owner = address(this);
    address public hub = address(0x1);
    address public depositor = address(0x2);
    address public recipient = address(0x3);

    bytes32 public constant RECEIPT_ID = keccak256("receipt1");
    bytes32 public constant ESCROW_ID = keccak256("escrow1");

    event EscrowCreated(
        bytes32 indexed escrowId,
        bytes32 indexed receiptId,
        address indexed depositor,
        address token,
        uint256 amount,
        uint64 deadline
    );

    event EscrowReleased(
        bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed recipient, uint256 amount
    );

    event EscrowRefunded(
        bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed depositor, uint256 amount
    );

    function setUp() public {
        vault = new EscrowVault();

        // Authorize hub
        vault.setAuthorizedHub(hub, true);

        // Fund accounts
        vm.deal(depositor, 10 ether);
        vm.deal(address(this), 10 ether);
    }

    receive() external payable { }

    // ============ Create Escrow Tests ============

    function test_CreateEscrow() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(escrow.receiptId, RECEIPT_ID);
        assertEq(escrow.depositor, depositor);
        assertEq(escrow.token, address(0));
        assertEq(escrow.amount, 1 ether);
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Active));
        assertEq(escrow.deadline, deadline);
    }

    function test_CreateEscrow_EmitsEvent() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.expectEmit(true, true, true, true);
        emit EscrowCreated(ESCROW_ID, RECEIPT_ID, depositor, address(0), 1 ether, deadline);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
    }

    function test_CreateEscrow_RevertZeroAmount() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        vault.createEscrow{ value: 0 }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
    }

    function test_CreateEscrow_RevertInvalidReceiptId() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidReceiptId()"));
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, bytes32(0), depositor, deadline);
    }

    function test_CreateEscrow_RevertInvalidDeadline() public {
        uint64 deadline = uint64(block.timestamp); // Must be > current time

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
    }

    function test_CreateEscrow_RevertDuplicate() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.startPrank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vm.expectRevert(abi.encodeWithSignature("EscrowAlreadyExists()"));
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, keccak256("receipt2"), depositor, deadline);
        vm.stopPrank();
    }

    // ============ Release Tests ============

    function test_Release() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        // Create escrow
        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        uint256 recipientBalanceBefore = recipient.balance;

        // Release (as hub)
        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);

        // Check recipient received funds
        assertEq(recipient.balance, recipientBalanceBefore + 1 ether);

        // Check escrow status
        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Released));
        assertEq(escrow.amount, 0);
    }

    function test_Release_EmitsEvent() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vm.expectEmit(true, true, true, true);
        emit EscrowReleased(ESCROW_ID, RECEIPT_ID, recipient, 1 ether);

        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);
    }

    function test_Release_RevertNotAuthorized() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vm.prank(address(0x999)); // Not authorized
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedCaller()"));
        vault.release(ESCROW_ID, recipient);
    }

    function test_Release_RevertNotActive() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        // Release first time
        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);

        // Try to release again
        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("EscrowNotActive()"));
        vault.release(ESCROW_ID, recipient);
    }

    function test_Release_RevertNotFound() public {
        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("EscrowNotFound()"));
        vault.release(keccak256("nonexistent"), recipient);
    }

    function test_Release_RevertZeroRecipient() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("TransferFailed()"));
        vault.release(ESCROW_ID, address(0));
    }

    // ============ Refund Tests ============

    function test_Refund() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        uint256 depositorBalanceBefore = depositor.balance;

        // Refund (as hub)
        vm.prank(hub);
        vault.refund(ESCROW_ID);

        // Check depositor received funds back
        assertEq(depositor.balance, depositorBalanceBefore + 1 ether);

        // Check escrow status
        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Refunded));
        assertEq(escrow.amount, 0);
    }

    function test_Refund_EmitsEvent() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vm.expectEmit(true, true, true, true);
        emit EscrowRefunded(ESCROW_ID, RECEIPT_ID, depositor, 1 ether);

        vm.prank(hub);
        vault.refund(ESCROW_ID);
    }

    function test_Refund_RevertNotAuthorized() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedCaller()"));
        vault.refund(ESCROW_ID);
    }

    function test_Refund_RevertNotActive() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        // Refund first time
        vm.prank(hub);
        vault.refund(ESCROW_ID);

        // Try to refund again
        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSignature("EscrowNotActive()"));
        vault.refund(ESCROW_ID);
    }

    // ============ View Function Tests ============

    function test_IsActive() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        // Before creation
        assertFalse(vault.isActive(ESCROW_ID));

        // After creation
        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
        assertTrue(vault.isActive(ESCROW_ID));

        // After release
        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);
        assertFalse(vault.isActive(ESCROW_ID));
    }

    function test_GetEscrowByReceipt() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        bytes32 foundEscrowId = vault.getEscrowByReceipt(RECEIPT_ID);
        assertEq(foundEscrowId, ESCROW_ID);
    }

    function test_GetStatus() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        // None before creation
        assertEq(uint256(vault.getStatus(ESCROW_ID)), uint256(IEscrowVault.EscrowStatus.None));

        // Active after creation
        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
        assertEq(uint256(vault.getStatus(ESCROW_ID)), uint256(IEscrowVault.EscrowStatus.Active));

        // Released after release
        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);
        assertEq(uint256(vault.getStatus(ESCROW_ID)), uint256(IEscrowVault.EscrowStatus.Released));
    }

    function test_TotalEscrows() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        assertEq(vault.totalEscrows(), 0);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
        assertEq(vault.totalEscrows(), 1);

        vm.prank(depositor);
        vault.createEscrow{ value: 0.5 ether }(keccak256("escrow2"), keccak256("receipt2"), depositor, deadline);
        assertEq(vault.totalEscrows(), 2);
    }

    // ============ Admin Tests ============

    function test_SetAuthorizedHub() public {
        address newHub = address(0x999);

        assertFalse(vault.authorizedHubs(newHub));

        vault.setAuthorizedHub(newHub, true);
        assertTrue(vault.authorizedHubs(newHub));

        vault.setAuthorizedHub(newHub, false);
        assertFalse(vault.authorizedHubs(newHub));
    }

    function test_SetAuthorizedHub_RevertNonOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert();
        vault.setAuthorizedHub(address(0x888), true);
    }

    function test_PauseUnpause() public {
        vault.pause();

        uint64 deadline = uint64(block.timestamp + 1 days);
        vm.prank(depositor);
        vm.expectRevert();
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        vault.unpause();

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);
    }

    function test_OwnerCanRelease() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        // Owner can release even without being explicitly authorized
        vault.release(ESCROW_ID, recipient);

        assertEq(uint256(vault.getStatus(ESCROW_ID)), uint256(IEscrowVault.EscrowStatus.Released));
    }

    // ============ Reentrancy Tests ============

    function test_ReleaseReentrancy() public {
        // Deploy a malicious recipient that tries to reenter
        MaliciousRecipient malicious = new MaliciousRecipient(vault);
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(ESCROW_ID, RECEIPT_ID, depositor, deadline);

        // This should not allow reentrancy due to ReentrancyGuard
        vm.prank(hub);
        vault.release(ESCROW_ID, address(malicious));

        // Malicious contract should have received funds but reentrancy blocked
        assertEq(address(malicious).balance, 1 ether);
        assertFalse(malicious.reentrancySucceeded());
    }
}

/// @notice Malicious contract that tries to reenter on receive
contract MaliciousRecipient {
    EscrowVault public vault;
    bool public reentrancySucceeded;
    bytes32 constant ESCROW_ID = keccak256("escrow1");

    constructor(EscrowVault _vault) {
        vault = _vault;
    }

    receive() external payable {
        // Try to call release again (should fail due to reentrancy guard)
        try vault.release(ESCROW_ID, address(this)) {
            reentrancySucceeded = true;
        } catch {
            reentrancySucceeded = false;
        }
    }
}
