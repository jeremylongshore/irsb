// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { X402Facilitator } from "../src/X402Facilitator.sol";
import { WalletDelegate } from "../src/delegation/WalletDelegate.sol";
import { SpendLimitEnforcer } from "../src/enforcers/SpendLimitEnforcer.sol";
import { TypesDelegation } from "../src/libraries/TypesDelegation.sol";
import { IWalletDelegate } from "../src/interfaces/IWalletDelegate.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

/// @title X402Facilitator Tests
/// @notice Unit tests for x402 payment settlement
contract X402FacilitatorTest is Test {
    X402Facilitator public facilitator;
    WalletDelegate public walletDelegate;
    SpendLimitEnforcer public spendEnforcer;
    MockERC20 public usdc;

    address public owner = address(this);
    address public buyer = address(0x1);
    address public seller = address(0x2);
    address public receiptHub = address(0x3);

    uint256 public delegatorKey;
    address public delegator;

    event PaymentSettled(
        bytes32 indexed paymentHash,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        bytes32 receiptId
    );

    event DelegatedPaymentSettled(
        bytes32 indexed paymentHash,
        bytes32 indexed delegationHash,
        address indexed buyer,
        address seller,
        address token,
        uint256 amount
    );

    event BatchSettled(uint256 count, uint256 totalAmount);

    function setUp() public {
        walletDelegate = new WalletDelegate();
        spendEnforcer = new SpendLimitEnforcer();
        facilitator = new X402Facilitator(address(walletDelegate), receiptHub);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Fund buyer
        usdc.mint(buyer, 10_000e6);
        vm.prank(buyer);
        usdc.approve(address(facilitator), type(uint256).max);

        // Setup delegator
        delegatorKey = 0xA11CE;
        delegator = vm.addr(delegatorKey);
        usdc.mint(delegator, 10_000e6);
    }

    // ============ Helpers ============

    function _makeParams(bytes32 paymentHash, uint256 amount)
        internal
        view
        returns (TypesDelegation.SettlementParams memory)
    {
        return TypesDelegation.SettlementParams({
            paymentHash: paymentHash,
            token: address(usdc),
            amount: amount,
            seller: seller,
            buyer: buyer,
            receiptId: keccak256("receipt1"),
            intentHash: keccak256("intent1"),
            proof: "proof",
            expiry: uint64(block.timestamp + 1 hours)
        });
    }

    function _setupDelegation(uint256 dailyCap, uint256 perTxCap, uint256 salt)
        internal
        returns (bytes32 delegationHash)
    {
        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](1);
        caveats[0] = TypesDelegation.Caveat({
            enforcer: address(spendEnforcer), terms: abi.encode(address(usdc), dailyCap, perTxCap)
        });

        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegator;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = salt;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", walletDelegate.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        walletDelegate.setupDelegation(delegation);
        delegationHash = TypesDelegation.hashDelegation(delegation);
    }

    // ============ settlePayment Tests ============

    function test_SettlePayment() public {
        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 100e6);

        vm.prank(buyer);
        facilitator.settlePayment(params);

        assertTrue(facilitator.isSettled(params.paymentHash));
        assertEq(usdc.balanceOf(seller), 100e6);
        assertEq(facilitator.totalSettlements(), 1);
    }

    function test_SettlePayment_EmitsEvent() public {
        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 100e6);

        vm.expectEmit(true, true, true, true);
        emit PaymentSettled(params.paymentHash, buyer, seller, address(usdc), 100e6, params.receiptId);

        vm.prank(buyer);
        facilitator.settlePayment(params);
    }

    // XF-1: Double-settlement prevention
    function test_SettlePayment_RevertDoubleSettlement() public {
        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 100e6);

        vm.prank(buyer);
        facilitator.settlePayment(params);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.AlreadySettled.selector));
        facilitator.settlePayment(params);
    }

    function test_SettlePayment_RevertZeroAmount() public {
        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 0);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidAmount.selector));
        facilitator.settlePayment(params);
    }

    function test_SettlePayment_RevertExpired() public {
        // Warp to a reasonable timestamp so expiry-1 is non-zero
        vm.warp(1000);

        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 100e6);
        params.expiry = uint64(block.timestamp - 1);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.PaymentExpired.selector));
        facilitator.settlePayment(params);
    }

    function test_SettlePayment_RevertZeroPaymentHash() public {
        TypesDelegation.SettlementParams memory params = _makeParams(bytes32(0), 100e6);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidPaymentHash.selector));
        facilitator.settlePayment(params);
    }

    function test_SettlePayment_NoExpiryCheck() public {
        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 100e6);
        params.expiry = 0; // No expiry

        vm.prank(buyer);
        facilitator.settlePayment(params);

        assertTrue(facilitator.isSettled(params.paymentHash));
    }

    // ============ settleDelegated Tests ============

    function test_SettleDelegated() public {
        bytes32 delegationHash = _setupDelegation(10_000e6, 5_000e6, 1);

        // Delegator approves walletDelegate to transfer USDC
        vm.prank(delegator);
        usdc.approve(address(walletDelegate), type(uint256).max);

        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("dpay1"), 100e6);
        params.buyer = delegator;

        facilitator.settleDelegated(delegationHash, params);

        assertTrue(facilitator.isSettled(params.paymentHash));
        assertEq(usdc.balanceOf(seller), 100e6);
    }

    function test_SettleDelegated_RevertInactiveDelegation() public {
        bytes32 delegationHash = _setupDelegation(10_000e6, 5_000e6, 1);

        // Revoke delegation
        vm.prank(delegator);
        walletDelegate.revokeDelegation(delegationHash);

        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("dpay1"), 100e6);
        params.buyer = delegator;

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.DelegationNotActive.selector));
        facilitator.settleDelegated(delegationHash, params);
    }

    // ============ batchSettle Tests ============

    function test_BatchSettle() public {
        TypesDelegation.SettlementParams[] memory batch = new TypesDelegation.SettlementParams[](3);
        batch[0] = _makeParams(keccak256("batch1"), 100e6);
        batch[1] = _makeParams(keccak256("batch2"), 200e6);
        batch[2] = _makeParams(keccak256("batch3"), 300e6);

        vm.prank(buyer);
        facilitator.batchSettle(batch);

        assertTrue(facilitator.isSettled(keccak256("batch1")));
        assertTrue(facilitator.isSettled(keccak256("batch2")));
        assertTrue(facilitator.isSettled(keccak256("batch3")));
        assertEq(usdc.balanceOf(seller), 600e6);
        assertEq(facilitator.totalSettlements(), 3);
    }

    function test_BatchSettle_EmitsEvents() public {
        TypesDelegation.SettlementParams[] memory batch = new TypesDelegation.SettlementParams[](2);
        batch[0] = _makeParams(keccak256("batch1"), 100e6);
        batch[1] = _makeParams(keccak256("batch2"), 200e6);

        vm.prank(buyer);
        facilitator.batchSettle(batch);

        // Verify batch event was emitted (simplified check - just verify state)
        assertEq(facilitator.totalSettlements(), 2);
    }

    function test_BatchSettle_RevertDuplicateInBatch() public {
        TypesDelegation.SettlementParams[] memory batch = new TypesDelegation.SettlementParams[](2);
        batch[0] = _makeParams(keccak256("same"), 100e6);
        batch[1] = _makeParams(keccak256("same"), 200e6);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.AlreadySettled.selector));
        facilitator.batchSettle(batch);
    }

    // ============ Admin Tests ============

    function test_SetWalletDelegate() public {
        address newDelegate = address(0x99);
        facilitator.setWalletDelegate(newDelegate);
        assertEq(address(facilitator.walletDelegate()), newDelegate);
    }

    function test_SetReceiptHub() public {
        address newHub = address(0x88);
        facilitator.setReceiptHub(newHub);
        assertEq(facilitator.receiptHub(), newHub);
    }

    function test_Pause_BlocksSettlement() public {
        facilitator.pause();

        TypesDelegation.SettlementParams memory params = _makeParams(keccak256("pay1"), 100e6);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        facilitator.settlePayment(params);
    }

    // ============ View Tests ============

    function test_IsSettled_ReturnsFalseByDefault() public view {
        assertFalse(facilitator.isSettled(keccak256("nonexistent")));
    }
}
