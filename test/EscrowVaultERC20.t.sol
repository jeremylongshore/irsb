// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { IEscrowVault } from "../src/interfaces/IEscrowVault.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title EscrowVault ERC20 Tests
/// @notice Unit tests for ERC20 escrow functionality
contract EscrowVaultERC20Test is Test {
    EscrowVault public vault;
    MockERC20 public token;

    address public owner = address(this);
    address public hub = address(0x1);
    address public depositor = address(0x2);
    address public recipient = address(0x3);

    bytes32 public constant RECEIPT_ID = keccak256("receipt1");
    bytes32 public constant ESCROW_ID = keccak256("escrow1");
    uint256 public constant INITIAL_BALANCE = 1000 ether;
    uint256 public constant ESCROW_AMOUNT = 100 ether;

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
        token = new MockERC20("Test Token", "TEST", 18);

        // Authorize hub
        vault.setAuthorizedHub(hub, true);

        // Mint tokens to depositor
        token.mint(depositor, INITIAL_BALANCE);

        // Approve vault to spend depositor's tokens
        vm.prank(depositor);
        token.approve(address(vault), type(uint256).max);
    }

    // ============ Create ERC20 Escrow Tests ============

    function test_CreateEscrowERC20() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(escrow.receiptId, RECEIPT_ID);
        assertEq(escrow.depositor, depositor);
        assertEq(escrow.token, address(token));
        assertEq(escrow.amount, ESCROW_AMOUNT);
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Active));

        // Check token transferred to vault
        assertEq(token.balanceOf(address(vault)), ESCROW_AMOUNT);
        assertEq(token.balanceOf(depositor), INITIAL_BALANCE - ESCROW_AMOUNT);
    }

    function test_CreateEscrowERC20_EmitsEvent() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.expectEmit(true, true, true, true);
        emit EscrowCreated(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);
    }

    function test_CreateEscrowERC20_RevertZeroAmount() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), 0, deadline);
    }

    function test_CreateEscrowERC20_RevertZeroToken() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(0), ESCROW_AMOUNT, deadline);
    }

    function test_CreateEscrowERC20_RevertInvalidReceiptId() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidReceiptId()"));
        vault.createEscrowERC20(ESCROW_ID, bytes32(0), depositor, address(token), ESCROW_AMOUNT, deadline);
    }

    function test_CreateEscrowERC20_RevertInvalidDeadline() public {
        uint64 deadline = uint64(block.timestamp);

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);
    }

    function test_CreateEscrowERC20_RevertDuplicate() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.startPrank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        vm.expectRevert(abi.encodeWithSignature("EscrowAlreadyExists()"));
        vault.createEscrowERC20(ESCROW_ID, keccak256("receipt2"), depositor, address(token), ESCROW_AMOUNT, deadline);
        vm.stopPrank();
    }

    function test_CreateEscrowERC20_RevertInsufficientAllowance() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        // Remove approval
        vm.prank(depositor);
        token.approve(address(vault), 0);

        vm.prank(depositor);
        vm.expectRevert();
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);
    }

    // ============ Release ERC20 Tests ============

    function test_ReleaseERC20() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        uint256 recipientBalanceBefore = token.balanceOf(recipient);

        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);

        assertEq(token.balanceOf(recipient), recipientBalanceBefore + ESCROW_AMOUNT);
        assertEq(token.balanceOf(address(vault)), 0);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Released));
        assertEq(escrow.amount, 0);
    }

    function test_ReleaseERC20_EmitsEvent() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        vm.expectEmit(true, true, true, true);
        emit EscrowReleased(ESCROW_ID, RECEIPT_ID, recipient, ESCROW_AMOUNT);

        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);
    }

    // ============ Refund ERC20 Tests ============

    function test_RefundERC20() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        uint256 depositorBalanceBefore = token.balanceOf(depositor);

        vm.prank(hub);
        vault.refund(ESCROW_ID);

        assertEq(token.balanceOf(depositor), depositorBalanceBefore + ESCROW_AMOUNT);
        assertEq(token.balanceOf(address(vault)), 0);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Refunded));
        assertEq(escrow.amount, 0);
    }

    function test_RefundERC20_EmitsEvent() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        vm.expectEmit(true, true, true, true);
        emit EscrowRefunded(ESCROW_ID, RECEIPT_ID, depositor, ESCROW_AMOUNT);

        vm.prank(hub);
        vault.refund(ESCROW_ID);
    }

    // ============ Multiple Escrow Tests ============

    function test_MultipleEscrowsDifferentTokens() public {
        MockERC20 token2 = new MockERC20("Token 2", "TK2", 18);
        token2.mint(depositor, INITIAL_BALANCE);

        vm.startPrank(depositor);
        token2.approve(address(vault), type(uint256).max);

        uint64 deadline = uint64(block.timestamp + 1 days);

        // Create two escrows with different tokens
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);
        vault.createEscrowERC20(
            keccak256("escrow2"), keccak256("receipt2"), depositor, address(token2), ESCROW_AMOUNT / 2, deadline
        );
        vm.stopPrank();

        // Verify both escrows
        IEscrowVault.Escrow memory escrow1 = vault.getEscrow(ESCROW_ID);
        IEscrowVault.Escrow memory escrow2 = vault.getEscrow(keccak256("escrow2"));

        assertEq(escrow1.token, address(token));
        assertEq(escrow1.amount, ESCROW_AMOUNT);

        assertEq(escrow2.token, address(token2));
        assertEq(escrow2.amount, ESCROW_AMOUNT / 2);

        assertEq(vault.totalEscrows(), 2);
    }

    function test_MixedNativeAndERC20() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        // Create ERC20 escrow
        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);

        // Create native escrow
        vm.deal(depositor, 1 ether);
        vm.prank(depositor);
        vault.createEscrow{ value: 1 ether }(keccak256("escrow2"), keccak256("receipt2"), depositor, deadline);

        // Release both
        vm.startPrank(hub);
        vault.release(ESCROW_ID, recipient);
        vault.release(keccak256("escrow2"), recipient);
        vm.stopPrank();

        assertEq(token.balanceOf(recipient), ESCROW_AMOUNT);
        assertEq(recipient.balance, 1 ether);
    }

    // ============ Edge Cases ============

    function test_EscrowWithDifferentDecimals() public {
        // Create a 6-decimal token (like USDC)
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        uint256 usdcAmount = 1000 * 10 ** 6; // 1000 USDC

        usdc.mint(depositor, usdcAmount);
        vm.prank(depositor);
        usdc.approve(address(vault), usdcAmount);

        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(usdc), usdcAmount, deadline);

        IEscrowVault.Escrow memory escrow = vault.getEscrow(ESCROW_ID);
        assertEq(escrow.amount, usdcAmount);

        // Release and verify
        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);

        assertEq(usdc.balanceOf(recipient), usdcAmount);
    }

    // ============ View Function Tests ============

    function test_IsActiveERC20() public {
        uint64 deadline = uint64(block.timestamp + 1 days);

        assertFalse(vault.isActive(ESCROW_ID));

        vm.prank(depositor);
        vault.createEscrowERC20(ESCROW_ID, RECEIPT_ID, depositor, address(token), ESCROW_AMOUNT, deadline);
        assertTrue(vault.isActive(ESCROW_ID));

        vm.prank(hub);
        vault.release(ESCROW_ID, recipient);
        assertFalse(vault.isActive(ESCROW_ID));
    }
}
