// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IAcrossAdapter } from "../interfaces/IAcrossAdapter.sol";
import { IIntentReceiptHub } from "../interfaces/IIntentReceiptHub.sol";
import { ISolverRegistry } from "../interfaces/ISolverRegistry.sol";
import { Types } from "../libraries/Types.sol";

/// @title AcrossAdapter
/// @notice Helper contract for posting Across Protocol fills as IRSB receipts
/// @dev Prepares receipts for relayers and tracks Across-specific mappings
///
/// Usage flow:
/// 1. Relayer calls prepareReceipt() to get formatted IRSB receipt
/// 2. Relayer signs the receipt message hash
/// 3. Relayer calls hub.postReceipt() directly (as they are the solver operator)
/// 4. Relayer calls registerAcrossReceipt() to track Across-specific data
contract AcrossAdapter is IAcrossAdapter, Ownable, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============

    /// @notice Default expiry offset from current time
    uint64 public constant DEFAULT_EXPIRY_OFFSET = 1 hours;

    /// @notice Estimated gas overhead for posting receipt (~50k gas)
    uint256 public constant GAS_OVERHEAD = 50_000;

    // ============ State ============

    /// @notice Reference to IntentReceiptHub
    IIntentReceiptHub public immutable intentReceiptHub;

    /// @notice Reference to SolverRegistry
    ISolverRegistry public immutable solverRegistry;

    /// @notice Mapping from Across depositId to IRSB receiptId
    mapping(bytes32 => bytes32) private _depositToReceipt;

    /// @notice Mapping from receiptId to Across receipt data
    mapping(bytes32 => AcrossReceipt) private _acrossReceipts;

    /// @notice Mapping from receiptId to original deposit
    mapping(bytes32 => AcrossDeposit) private _deposits;

    /// @notice Total Across receipts registered
    uint256 public totalAcrossReceipts;

    // ============ Constructor ============

    constructor(address _intentReceiptHub, address _solverRegistry) Ownable(msg.sender) {
        require(_intentReceiptHub != address(0), "Invalid hub address");
        require(_solverRegistry != address(0), "Invalid registry address");

        intentReceiptHub = IIntentReceiptHub(_intentReceiptHub);
        solverRegistry = ISolverRegistry(_solverRegistry);
    }

    // ============ External Functions ============

    /// @inheritdoc IAcrossAdapter
    /// @dev This is a convenience function that combines prepareAndPost + register
    /// For gas optimization, relayers can call hub.postReceipt directly
    function postAcrossReceipt(AcrossDeposit calldata deposit, FillData calldata fill, bytes calldata relayerSig)
        external
        whenNotPaused
        returns (bytes32 receiptId)
    {
        // Validate inputs
        if (block.timestamp > deposit.fillDeadline) {
            revert DepositExpired();
        }
        if (_depositToReceipt[deposit.depositId] != bytes32(0)) {
            revert ReceiptAlreadyPosted();
        }

        // Get solver ID
        bytes32 solverId = solverRegistry.getSolverByOperator(msg.sender);
        if (solverId == bytes32(0)) {
            revert SolverNotRegistered();
        }

        // Prepare receipt
        Types.IntentReceipt memory receipt = _buildReceipt(deposit, fill, solverId, relayerSig);

        // Compute receipt ID (same logic as hub)
        receiptId = intentReceiptHub.computeReceiptId(receipt);

        // Store Across-specific tracking
        _depositToReceipt[deposit.depositId] = receiptId;
        _acrossReceipts[receiptId] = AcrossReceipt({
            receiptId: receiptId,
            depositId: deposit.depositId,
            intentHash: receipt.intentHash,
            solverId: solverId,
            postedAt: receipt.createdAt,
            expiry: receipt.expiry
        });
        _deposits[receiptId] = deposit;
        totalAcrossReceipts++;

        emit AcrossReceiptPosted(
            receiptId, deposit.depositId, solverId, deposit.originChainId, deposit.destinationChainId
        );

        // Note: Caller must also call hub.postReceipt(receipt) with the returned receipt
        // This function only registers the Across tracking - the actual receipt posting
        // must be done by the solver operator directly to satisfy hub authorization
    }

    /// @notice Register an Across receipt after posting to hub
    /// @dev Called by relayer after hub.postReceipt() succeeds
    /// @param deposit Original Across deposit data
    /// @param receiptId Receipt ID from hub.postReceipt()
    function registerAcrossReceipt(AcrossDeposit calldata deposit, bytes32 receiptId) external whenNotPaused {
        // Validate not already registered
        if (_depositToReceipt[deposit.depositId] != bytes32(0)) {
            revert ReceiptAlreadyPosted();
        }

        // Verify receipt exists in hub
        (Types.IntentReceipt memory receipt, Types.ReceiptStatus status) = intentReceiptHub.getReceipt(receiptId);
        if (receipt.createdAt == 0) {
            revert InvalidDeposit();
        }

        // Verify caller is the solver operator
        Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);
        if (solver.operator != msg.sender) {
            revert UnauthorizedRelayer();
        }

        // Verify intent hash matches
        bytes32 expectedIntentHash = computeIntentHash(deposit);
        if (receipt.intentHash != expectedIntentHash) {
            revert InvalidDeposit();
        }

        // Store Across-specific tracking
        _depositToReceipt[deposit.depositId] = receiptId;
        _acrossReceipts[receiptId] = AcrossReceipt({
            receiptId: receiptId,
            depositId: deposit.depositId,
            intentHash: receipt.intentHash,
            solverId: receipt.solverId,
            postedAt: receipt.createdAt,
            expiry: receipt.expiry
        });
        _deposits[receiptId] = deposit;
        totalAcrossReceipts++;

        emit AcrossReceiptPosted(
            receiptId, deposit.depositId, receipt.solverId, deposit.originChainId, deposit.destinationChainId
        );
    }

    /// @notice Prepare an IRSB receipt from Across deposit and fill data
    /// @dev Returns a ready-to-sign/post receipt. Relayer should:
    ///      1. Call this to get the receipt
    ///      2. Sign getReceiptMessageHash() result
    ///      3. Post to hub with the signature
    function prepareReceipt(AcrossDeposit calldata deposit, FillData calldata fill, bytes32 solverId)
        external
        view
        returns (Types.IntentReceipt memory receipt)
    {
        return _buildReceipt(deposit, fill, solverId, "");
    }

    /// @notice Get the message hash that needs to be signed for a receipt
    /// @dev Relayers sign this hash, then call hub.postReceipt with signature
    function getReceiptMessageHash(AcrossDeposit calldata deposit, FillData calldata fill, bytes32 solverId)
        external
        view
        returns (bytes32 messageHash)
    {
        Types.IntentReceipt memory receipt = _buildReceipt(deposit, fill, solverId, "");
        return keccak256(
            abi.encode(
                receipt.intentHash,
                receipt.constraintsHash,
                receipt.routeHash,
                receipt.outcomeHash,
                receipt.evidenceHash,
                receipt.createdAt,
                receipt.expiry,
                receipt.solverId
            )
        );
    }

    /// @inheritdoc IAcrossAdapter
    function validateFill(bytes32 receiptId, FillData calldata fill)
        external
        view
        returns (bool valid, string memory reason)
    {
        AcrossReceipt storage acrossReceipt = _acrossReceipts[receiptId];
        if (acrossReceipt.receiptId == bytes32(0)) {
            return (false, "Receipt not found");
        }

        AcrossDeposit storage deposit = _deposits[receiptId];

        if (fill.fillChainId != deposit.destinationChainId) {
            return (false, "Wrong destination chain");
        }
        if (fill.tokenFilled != deposit.destinationToken) {
            return (false, "Wrong token");
        }
        if (fill.amountFilled < deposit.outputAmount) {
            return (false, "Amount below minimum");
        }
        if (fill.recipientFilled != deposit.recipient) {
            return (false, "Wrong recipient");
        }
        if (fill.filledAt > deposit.fillDeadline) {
            return (false, "Fill after deadline");
        }

        return (true, "");
    }

    // ============ Hash Computation Functions ============

    /// @inheritdoc IAcrossAdapter
    function computeIntentHash(AcrossDeposit calldata deposit) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                "ACROSS_INTENT_V1",
                deposit.originChainId,
                deposit.originToken,
                deposit.inputAmount,
                deposit.destinationChainId,
                deposit.recipient,
                deposit.depositId
            )
        );
    }

    /// @inheritdoc IAcrossAdapter
    function computeConstraintsHash(AcrossDeposit calldata deposit) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                deposit.outputAmount,
                deposit.fillDeadline,
                deposit.destinationChainId,
                deposit.exclusivityDeadline,
                deposit.exclusiveRelayer
            )
        );
    }

    /// @notice Compute route hash from Across deposit
    function computeRouteHash(AcrossDeposit calldata deposit) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                "ACROSS_ROUTE_V1",
                deposit.originChainId,
                deposit.destinationChainId,
                deposit.originToken,
                deposit.destinationToken
            )
        );
    }

    /// @notice Compute outcome hash from fill data
    function computeOutcomeHash(FillData calldata fill) public pure returns (bytes32) {
        return keccak256(
            abi.encode(fill.fillChainId, fill.tokenFilled, fill.amountFilled, fill.recipientFilled, fill.fillTxHash)
        );
    }

    /// @notice Compute evidence hash from deposit and fill
    function computeEvidenceHash(AcrossDeposit calldata deposit, FillData calldata fill) public pure returns (bytes32) {
        return keccak256(abi.encode("ACROSS_EVIDENCE_V1", deposit.depositId, fill.fillTxHash, fill.filledAt));
    }

    // ============ View Functions ============

    /// @inheritdoc IAcrossAdapter
    function getReceiptByDepositId(bytes32 depositId) external view returns (AcrossReceipt memory) {
        bytes32 receiptId = _depositToReceipt[depositId];
        return _acrossReceipts[receiptId];
    }

    /// @inheritdoc IAcrossAdapter
    function hasReceipt(bytes32 depositId) external view returns (bool) {
        return _depositToReceipt[depositId] != bytes32(0);
    }

    /// @notice Get original deposit data for a receipt
    function getDeposit(bytes32 receiptId) external view returns (AcrossDeposit memory) {
        return _deposits[receiptId];
    }

    /// @inheritdoc IAcrossAdapter
    function estimateGasOverhead() external pure returns (uint256) {
        return GAS_OVERHEAD;
    }

    // ============ Internal Functions ============

    function _buildReceipt(AcrossDeposit calldata deposit, FillData calldata fill, bytes32 solverId, bytes memory sig)
        internal
        view
        returns (Types.IntentReceipt memory)
    {
        return Types.IntentReceipt({
            intentHash: computeIntentHash(deposit),
            constraintsHash: computeConstraintsHash(deposit),
            routeHash: computeRouteHash(deposit),
            outcomeHash: computeOutcomeHash(fill),
            evidenceHash: computeEvidenceHash(deposit, fill),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp) + DEFAULT_EXPIRY_OFFSET,
            solverId: solverId,
            solverSig: sig
        });
    }

    // ============ Admin Functions ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
