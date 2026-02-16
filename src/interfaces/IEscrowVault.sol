// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IEscrowVault
/// @notice Interface for escrow vault holding funds tied to receipt lifecycle
interface IEscrowVault {
    // ============ Enums ============

    enum EscrowStatus {
        None, // Does not exist
        Active, // Funds held
        Released, // Funds sent to recipient
        Refunded // Funds returned to depositor
    }

    // ============ Structs ============

    struct Escrow {
        bytes32 receiptId; // Linked receipt ID
        address depositor; // Who deposited funds
        address token; // Token address (address(0) = native ETH)
        uint256 amount; // Amount held
        EscrowStatus status; // Current status
        uint64 createdAt; // Creation timestamp
        uint64 deadline; // Must be resolved by this time
    }

    // ============ Events ============

    /// @notice Emitted when a new escrow is created
    event EscrowCreated(
        bytes32 indexed escrowId,
        bytes32 indexed receiptId,
        address indexed depositor,
        address token,
        uint256 amount,
        uint64 deadline
    );

    /// @notice Emitted when escrow funds are released to recipient
    event EscrowReleased(
        bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed recipient, uint256 amount
    );

    /// @notice Emitted when escrow funds are refunded to depositor
    event EscrowRefunded(
        bytes32 indexed escrowId, bytes32 indexed receiptId, address indexed depositor, uint256 amount
    );

    // ============ Errors ============

    error EscrowNotFound();
    error EscrowAlreadyExists();
    error EscrowNotActive();
    error EscrowAlreadyResolved();
    error InvalidAmount();
    error InvalidDeadline();
    error InvalidReceiptId();
    error UnauthorizedCaller();
    error TransferFailed();
    error InsufficientBalance();

    // ============ External Functions ============

    /// @notice Create a native ETH escrow
    /// @param escrowId Unique escrow identifier
    /// @param receiptId Linked receipt ID
    /// @param depositor Address that deposited (for refunds)
    /// @param deadline Resolution deadline
    function createEscrow(bytes32 escrowId, bytes32 receiptId, address depositor, uint64 deadline) external payable;

    /// @notice Create an ERC20 escrow
    /// @param escrowId Unique escrow identifier
    /// @param receiptId Linked receipt ID
    /// @param depositor Address that deposited (for refunds)
    /// @param token ERC20 token address
    /// @param amount Amount to escrow
    /// @param deadline Resolution deadline
    function createEscrowERC20(
        bytes32 escrowId,
        bytes32 receiptId,
        address depositor,
        address token,
        uint256 amount,
        uint64 deadline
    ) external;

    /// @notice Release escrow funds to recipient
    /// @param escrowId Escrow to release
    /// @param recipient Address to receive funds
    function release(bytes32 escrowId, address recipient) external;

    /// @notice Refund escrow funds to depositor
    /// @param escrowId Escrow to refund
    function refund(bytes32 escrowId) external;

    // ============ View Functions ============

    /// @notice Get escrow details
    /// @param escrowId Escrow to query
    /// @return escrow Escrow struct
    function getEscrow(bytes32 escrowId) external view returns (Escrow memory escrow);

    /// @notice Check if escrow is active
    /// @param escrowId Escrow to check
    /// @return isActive Whether escrow is active
    function isActive(bytes32 escrowId) external view returns (bool isActive);

    /// @notice Get escrow by receipt ID
    /// @param receiptId Receipt to query
    /// @return escrowId Linked escrow ID
    function getEscrowByReceipt(bytes32 receiptId) external view returns (bytes32 escrowId);
}
