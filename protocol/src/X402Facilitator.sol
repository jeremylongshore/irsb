// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { TypesDelegation } from "./libraries/TypesDelegation.sol";
import { IWalletDelegate } from "./interfaces/IWalletDelegate.sol";

/// @title X402Facilitator
/// @notice Settlement contract for x402 HTTP payments with delegation support
/// @dev Handles direct payments, delegated payments via WalletDelegate, and batch settlement
contract X402Facilitator is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State ============

    /// @notice Double-settlement prevention: paymentHash => settled
    mapping(bytes32 => bool) public settledPayments;

    /// @notice WalletDelegate contract for delegated settlements
    IWalletDelegate public walletDelegate;

    /// @notice IntentReceiptHub for posting receipts (optional)
    address public receiptHub;

    /// @notice Total payments settled
    uint256 public totalSettlements;

    // ============ Events ============

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

    // ============ Errors ============

    error AlreadySettled();
    error InvalidPaymentHash();
    error InvalidAmount();
    error InvalidSeller();
    error InvalidBuyer();
    error InvalidToken();
    error PaymentExpired();
    error TransferFailed();
    error BatchLengthMismatch();
    error DelegationNotActive();
    error InvalidWalletDelegate();
    error BatchTooLarge();

    // ============ Constants ============

    uint256 private constant MAX_BATCH_SIZE = 50;

    // ============ Constructor ============

    constructor(address _walletDelegate, address _receiptHub) Ownable(msg.sender) {
        if (_walletDelegate == address(0)) revert InvalidWalletDelegate();
        walletDelegate = IWalletDelegate(_walletDelegate);
        receiptHub = _receiptHub;
    }

    // ============ External Functions ============

    /// @notice Settle a direct payment (buyer pays directly)
    /// @param params Settlement parameters
    function settlePayment(TypesDelegation.SettlementParams calldata params) external whenNotPaused nonReentrant {
        _validateSettlement(params);

        // XF-1: Double-settlement prevention
        if (settledPayments[params.paymentHash]) {
            revert AlreadySettled();
        }

        // Effects
        settledPayments[params.paymentHash] = true;
        totalSettlements++;

        // Interactions: Transfer from buyer to seller (caller must be buyer)
        if (msg.sender != params.buyer) revert InvalidBuyer();
        IERC20(params.token).safeTransferFrom(params.buyer, params.seller, params.amount);

        emit PaymentSettled(
            params.paymentHash, params.buyer, params.seller, params.token, params.amount, params.receiptId
        );
    }

    /// @notice Settle a payment via delegation (WalletDelegate executes transfer)
    /// @param delegationHash Hash of the active delegation
    /// @param params Settlement parameters
    function settleDelegated(bytes32 delegationHash, TypesDelegation.SettlementParams calldata params)
        external
        whenNotPaused
        nonReentrant
    {
        _validateSettlement(params);

        // XF-1: Double-settlement prevention
        if (settledPayments[params.paymentHash]) {
            revert AlreadySettled();
        }

        // Verify delegation is active
        if (!walletDelegate.isDelegationActive(delegationHash)) {
            revert DelegationNotActive();
        }

        // Effects
        settledPayments[params.paymentHash] = true;
        totalSettlements++;

        // Interactions: Execute transferFrom via delegation (delegator → seller)
        bytes memory callData =
            abi.encodeWithSelector(IERC20.transferFrom.selector, params.buyer, params.seller, params.amount);
        walletDelegate.executeDelegated(delegationHash, params.token, callData, 0);

        emit DelegatedPaymentSettled(
            params.paymentHash, delegationHash, params.buyer, params.seller, params.token, params.amount
        );
    }

    /// @notice Settle multiple payments in a single transaction
    /// @param params Array of settlement parameters
    function batchSettle(TypesDelegation.SettlementParams[] calldata params) external whenNotPaused nonReentrant {
        if (params.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 totalAmount;

        for (uint256 i = 0; i < params.length; i++) {
            _validateSettlement(params[i]);

            if (settledPayments[params[i].paymentHash]) {
                revert AlreadySettled();
            }

            settledPayments[params[i].paymentHash] = true;
            totalSettlements++;
            totalAmount += params[i].amount;

            IERC20(params[i].token).safeTransferFrom(msg.sender, params[i].seller, params[i].amount);

            emit PaymentSettled(
                params[i].paymentHash,
                params[i].buyer,
                params[i].seller,
                params[i].token,
                params[i].amount,
                params[i].receiptId
            );
        }

        emit BatchSettled(params.length, totalAmount);
    }

    // ============ View Functions ============

    /// @notice Check if a payment has been settled
    /// @param paymentHash The payment hash to check
    /// @return settled Whether the payment has been settled
    function isSettled(bytes32 paymentHash) external view returns (bool) {
        return settledPayments[paymentHash];
    }

    // ============ Admin Functions ============

    /// @notice Update the WalletDelegate contract address
    /// @param _walletDelegate New WalletDelegate address
    function setWalletDelegate(address _walletDelegate) external onlyOwner {
        if (_walletDelegate == address(0)) revert InvalidWalletDelegate();
        walletDelegate = IWalletDelegate(_walletDelegate);
    }

    /// @notice Update the receipt hub address
    /// @param _receiptHub New receipt hub address
    function setReceiptHub(address _receiptHub) external onlyOwner {
        receiptHub = _receiptHub;
    }

    /// @notice Pause all settlements (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause settlements
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    function _validateSettlement(TypesDelegation.SettlementParams calldata params) internal view {
        if (params.paymentHash == bytes32(0)) revert InvalidPaymentHash();
        if (params.amount == 0) revert InvalidAmount();
        if (params.seller == address(0)) revert InvalidSeller();
        if (params.buyer == address(0)) revert InvalidBuyer();
        if (params.token == address(0)) revert InvalidToken();
        if (params.expiry != 0 && block.timestamp > params.expiry) revert PaymentExpired();
    }
}
