// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IEscrowVault } from "./interfaces/IEscrowVault.sol";

/// @title EscrowVault
/// @notice Holds native ETH and ERC20 tokens tied to receipt lifecycle
/// @dev Only authorized callers (Hub/Extension) can release/refund
contract EscrowVault is IEscrowVault, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Role identifier for hub callers
    bytes32 public constant HUB_ROLE = keccak256("HUB_ROLE");

    // ============ State ============

    /// @notice Escrow storage by ID
    mapping(bytes32 => Escrow) private _escrows;

    /// @notice Receipt ID to Escrow ID mapping
    mapping(bytes32 => bytes32) private _receiptToEscrow;

    /// @notice Authorized hub callers
    mapping(address => bool) public authorizedHubs;

    /// @notice Total escrows created
    uint256 public totalEscrows;

    /// @notice Total value released (native)
    uint256 public totalReleasedNative;

    /// @notice Total value refunded (native)
    uint256 public totalRefundedNative;

    // ============ Constructor ============

    constructor() Ownable(msg.sender) { }

    // ============ Modifiers ============

    modifier onlyHub() {
        if (!authorizedHubs[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    modifier escrowExists(bytes32 escrowId) {
        if (_escrows[escrowId].status == EscrowStatus.None) {
            revert EscrowNotFound();
        }
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IEscrowVault
    function createEscrow(bytes32 escrowId, bytes32 receiptId, address depositor, uint64 deadline)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        if (msg.value == 0) revert InvalidAmount();
        if (receiptId == bytes32(0)) revert InvalidReceiptId();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (_escrows[escrowId].status != EscrowStatus.None) revert EscrowAlreadyExists();

        _escrows[escrowId] = Escrow({
            receiptId: receiptId,
            depositor: depositor,
            token: address(0), // Native ETH
            amount: msg.value,
            status: EscrowStatus.Active,
            createdAt: uint64(block.timestamp),
            deadline: deadline
        });

        _receiptToEscrow[receiptId] = escrowId;
        totalEscrows++;

        emit EscrowCreated(escrowId, receiptId, depositor, address(0), msg.value, deadline);
    }

    /// @inheritdoc IEscrowVault
    function createEscrowERC20(
        bytes32 escrowId,
        bytes32 receiptId,
        address depositor,
        address token,
        uint256 amount,
        uint64 deadline
    ) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (token == address(0)) revert InvalidAmount(); // Use createEscrow for native
        if (receiptId == bytes32(0)) revert InvalidReceiptId();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (_escrows[escrowId].status != EscrowStatus.None) revert EscrowAlreadyExists();

        // Transfer tokens to this contract (SafeERC20 handles non-standard tokens)
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        _escrows[escrowId] = Escrow({
            receiptId: receiptId,
            depositor: depositor,
            token: token,
            amount: amount,
            status: EscrowStatus.Active,
            createdAt: uint64(block.timestamp),
            deadline: deadline
        });

        _receiptToEscrow[receiptId] = escrowId;
        totalEscrows++;

        emit EscrowCreated(escrowId, receiptId, depositor, token, amount, deadline);
    }

    /// @inheritdoc IEscrowVault
    function release(bytes32 escrowId, address recipient) external onlyHub escrowExists(escrowId) nonReentrant {
        Escrow storage escrow = _escrows[escrowId];

        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();
        if (recipient == address(0)) revert TransferFailed();

        uint256 amount = escrow.amount;
        address token = escrow.token;

        // Update state BEFORE transfer (CEI pattern)
        escrow.status = EscrowStatus.Released;
        escrow.amount = 0; // Clear amount after release

        if (token == address(0)) {
            // Native ETH transfer
            totalReleasedNative += amount;
            (bool sent,) = recipient.call{ value: amount }("");
            if (!sent) revert TransferFailed();
        } else {
            // ERC20 transfer
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit EscrowReleased(escrowId, escrow.receiptId, recipient, amount);
    }

    /// @inheritdoc IEscrowVault
    function refund(bytes32 escrowId) external onlyHub escrowExists(escrowId) nonReentrant {
        Escrow storage escrow = _escrows[escrowId];

        if (escrow.status != EscrowStatus.Active) revert EscrowNotActive();

        uint256 amount = escrow.amount;
        address token = escrow.token;
        address depositor = escrow.depositor;

        // Update state BEFORE transfer (CEI pattern)
        escrow.status = EscrowStatus.Refunded;
        escrow.amount = 0; // Clear amount after refund

        if (token == address(0)) {
            // Native ETH refund
            totalRefundedNative += amount;
            (bool sent,) = depositor.call{ value: amount }("");
            if (!sent) revert TransferFailed();
        } else {
            // ERC20 refund
            IERC20(token).safeTransfer(depositor, amount);
        }

        emit EscrowRefunded(escrowId, escrow.receiptId, depositor, amount);
    }

    // ============ View Functions ============

    /// @inheritdoc IEscrowVault
    function getEscrow(bytes32 escrowId) external view returns (Escrow memory) {
        return _escrows[escrowId];
    }

    /// @inheritdoc IEscrowVault
    function isActive(bytes32 escrowId) external view returns (bool) {
        return _escrows[escrowId].status == EscrowStatus.Active;
    }

    /// @inheritdoc IEscrowVault
    function getEscrowByReceipt(bytes32 receiptId) external view returns (bytes32) {
        return _receiptToEscrow[receiptId];
    }

    /// @notice Get escrow status
    /// @param escrowId Escrow to query
    /// @return status Escrow status
    function getStatus(bytes32 escrowId) external view returns (EscrowStatus) {
        return _escrows[escrowId].status;
    }

    /// @notice Check if caller is authorized hub
    /// @param caller Address to check
    /// @return authorized Whether caller is authorized
    function isAuthorizedHub(address caller) external view returns (bool) {
        return authorizedHubs[caller] || caller == owner();
    }

    // ============ Admin Functions ============

    /// @notice Set authorized hub address
    /// @param hub Hub address to authorize
    /// @param authorized Whether to authorize or revoke
    function setAuthorizedHub(address hub, bool authorized) external onlyOwner {
        authorizedHubs[hub] = authorized;
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency withdraw stuck tokens (only if escrow resolved)
    /// @param token Token to withdraw (address(0) for native)
    /// @param amount Amount to withdraw
    /// @param to Recipient address
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert TransferFailed();

        if (token == address(0)) {
            (bool sent,) = to.call{ value: amount }("");
            if (!sent) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    /// @notice Receive ETH (for escrow deposits)
    receive() external payable { }
}
