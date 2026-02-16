// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IIntentReceiptHub } from "./IIntentReceiptHub.sol";
import { ISolverRegistry } from "./ISolverRegistry.sol";

/// @title IAcrossAdapter
/// @notice Interface for Across Protocol integration with IRSB
/// @dev Maps Across fill events to IRSB intent receipts
interface IAcrossAdapter {
    // ============ Structs ============

    /// @notice Across deposit data structure
    /// @dev Mirrors the deposit structure from Across SpokePool
    struct AcrossDeposit {
        uint256 originChainId;
        uint256 destinationChainId;
        address originToken;
        address destinationToken;
        uint256 inputAmount;
        uint256 outputAmount;
        address depositor;
        address recipient;
        uint256 fillDeadline;
        bytes32 depositId;
        uint256 exclusivityDeadline;
        address exclusiveRelayer;
        bytes message;
    }

    /// @notice Fill data proving execution on destination chain
    struct FillData {
        uint256 fillChainId;
        address tokenFilled;
        uint256 amountFilled;
        address recipientFilled;
        bytes32 fillTxHash;
        uint64 filledAt;
    }

    /// @notice Across receipt posted to IRSB
    struct AcrossReceipt {
        bytes32 receiptId;
        bytes32 depositId;
        bytes32 intentHash;
        bytes32 solverId;
        uint64 postedAt;
        uint64 expiry;
    }

    // ============ Events ============

    /// @notice Emitted when an Across receipt is posted
    event AcrossReceiptPosted(
        bytes32 indexed receiptId,
        bytes32 indexed depositId,
        bytes32 indexed solverId,
        uint256 originChainId,
        uint256 destinationChainId
    );

    /// @notice Emitted when a fill is validated
    event FillValidated(bytes32 indexed receiptId, bool valid, string reason);

    // ============ Errors ============

    error InvalidDeposit();
    error InvalidFillData();
    error DepositExpired();
    error SolverNotRegistered();
    error SignatureVerificationFailed();
    error UnauthorizedRelayer();
    error ReceiptAlreadyPosted();
    error AmountMismatch();
    error RecipientMismatch();
    error ChainMismatch();

    // ============ External Functions ============

    /// @notice Post a receipt for an Across fill
    /// @param deposit Original Across deposit data
    /// @param fill Fill execution data
    /// @param relayerSig Relayer signature over fill commitment
    /// @return receiptId The unique IRSB receipt ID
    function postAcrossReceipt(AcrossDeposit calldata deposit, FillData calldata fill, bytes calldata relayerSig)
        external
        returns (bytes32 receiptId);

    /// @notice Validate a fill against its deposit constraints
    /// @param receiptId Receipt to validate
    /// @param fill Fill data to verify
    /// @return valid Whether fill satisfies constraints
    /// @return reason Validation failure reason (empty if valid)
    function validateFill(bytes32 receiptId, FillData calldata fill)
        external
        view
        returns (bool valid, string memory reason);

    /// @notice Compute intent hash from Across deposit
    /// @param deposit Across deposit data
    /// @return intentHash Hash uniquely identifying the intent
    function computeIntentHash(AcrossDeposit calldata deposit) external pure returns (bytes32 intentHash);

    /// @notice Compute constraints hash from Across deposit
    /// @param deposit Across deposit data
    /// @return constraintsHash Hash of execution constraints
    function computeConstraintsHash(AcrossDeposit calldata deposit) external pure returns (bytes32 constraintsHash);

    /// @notice Get receipt by deposit ID
    /// @param depositId Across deposit identifier
    /// @return receipt Associated IRSB receipt
    function getReceiptByDepositId(bytes32 depositId) external view returns (AcrossReceipt memory receipt);

    /// @notice Check if deposit already has a receipt
    /// @param depositId Across deposit identifier
    /// @return exists Whether receipt exists
    function hasReceipt(bytes32 depositId) external view returns (bool exists);

    // ============ View Functions ============

    /// @notice Get the IntentReceiptHub
    function intentReceiptHub() external view returns (IIntentReceiptHub);

    /// @notice Get the SolverRegistry
    function solverRegistry() external view returns (ISolverRegistry);

    /// @notice Get gas overhead estimate for posting receipt
    /// @return gas Estimated gas cost in wei
    function estimateGasOverhead() external pure returns (uint256 gas);
}
