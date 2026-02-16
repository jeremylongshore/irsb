// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Types } from "../libraries/Types.sol";

/// @title IIntentReceiptHub
/// @notice Interface for receipt posting and dispute management
interface IIntentReceiptHub {
    // ============ Events ============

    /// @notice Emitted when a receipt is posted
    event ReceiptPosted(bytes32 indexed receiptId, bytes32 indexed intentHash, bytes32 indexed solverId, uint64 expiry);

    /// @notice Emitted when a dispute is opened
    event DisputeOpened(
        bytes32 indexed receiptId, bytes32 indexed solverId, address indexed challenger, Types.DisputeReason reason
    );

    /// @notice Emitted when a dispute is resolved
    event DisputeResolved(bytes32 indexed receiptId, bytes32 indexed solverId, bool slashed, uint256 slashAmount);

    /// @notice Emitted when a receipt is finalized
    event ReceiptFinalized(bytes32 indexed receiptId, bytes32 indexed solverId);

    /// @notice Emitted when settlement proof is submitted
    event SettlementProofSubmitted(bytes32 indexed receiptId, bytes32 proofHash);

    // ============ Errors ============

    error ReceiptAlreadyExists();
    error ReceiptNotFound();
    error ReceiptExpired();
    error ReceiptNotPending();
    error ReceiptAlreadyDisputed();
    error ReceiptAlreadyFinalized();
    error InvalidReceiptSignature();
    error InvalidSolver();
    error ChallengeWindowActive();
    error ChallengeWindowExpired();
    error InvalidDisputeReason();
    error NotAuthorizedChallenger();
    error DisputeNotFound();
    error DisputeAlreadyResolved();
    error InsufficientChallengerBond();
    error ChallengerBondTransferFailed();
    error NoForfeitedBonds();
    error SweepTransferFailed();
    error InsufficientBondForVolume();

    // ============ Events (Additional) ============

    /// @notice Emitted when a challenger's bond is forfeited
    event ChallengerBondForfeited(bytes32 indexed receiptId, address indexed challenger, uint256 amount);

    /// @notice Emitted when forfeited bonds are swept to treasury
    event ForfeitedBondsSwept(address indexed treasury, uint256 amount);

    // ============ External Functions ============

    /// @notice Post a new intent receipt with declared volume
    /// @param receipt The receipt to post
    /// @param declaredVolume The declared transaction volume for bond validation (PM-EC-001)
    /// @return receiptId Unique receipt identifier
    function postReceipt(Types.IntentReceipt calldata receipt, uint256 declaredVolume)
        external
        returns (bytes32 receiptId);

    /// @notice Open a dispute against a receipt
    /// @param receiptId Receipt to dispute
    /// @param reason Dispute reason code
    /// @param evidenceHash Evidence bundle hash
    function openDispute(bytes32 receiptId, Types.DisputeReason reason, bytes32 evidenceHash) external payable;

    /// @notice Resolve a deterministic dispute
    /// @param receiptId Receipt under dispute
    /// @dev Called by DisputeModule after verification
    function resolveDeterministic(bytes32 receiptId) external;

    /// @notice Finalize a receipt after challenge window
    /// @param receiptId Receipt to finalize
    function finalize(bytes32 receiptId) external;

    /// @notice Submit settlement proof for a receipt
    /// @param receiptId Receipt to update
    /// @param proofHash Hash of settlement proof
    function submitSettlementProof(bytes32 receiptId, bytes32 proofHash) external;

    /// @notice Batch post multiple receipts with declared volumes
    /// @param receipts Array of receipts to post
    /// @param declaredVolumes Array of declared volumes per receipt (PM-EC-001)
    /// @return receiptIds Array of receipt IDs
    function batchPostReceipts(Types.IntentReceipt[] calldata receipts, uint256[] calldata declaredVolumes)
        external
        returns (bytes32[] memory receiptIds);

    // ============ View Functions ============

    /// @notice Get receipt details
    /// @param receiptId Receipt to query
    /// @return receipt Receipt struct
    /// @return status Receipt status
    function getReceipt(bytes32 receiptId)
        external
        view
        returns (Types.IntentReceipt memory receipt, Types.ReceiptStatus status);

    /// @notice Get dispute details
    /// @param receiptId Receipt under dispute
    /// @return dispute Dispute struct
    function getDispute(bytes32 receiptId) external view returns (Types.Dispute memory dispute);

    /// @notice Check if receipt can be finalized
    /// @param receiptId Receipt to check
    /// @return canFinalize Whether receipt can be finalized
    function canFinalize(bytes32 receiptId) external view returns (bool canFinalize);

    /// @notice Get receipts by solver
    /// @param solverId Solver to query
    /// @param offset Pagination offset
    /// @param limit Max results
    /// @return receiptIds Array of receipt IDs
    function getReceiptsBySolver(bytes32 solverId, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory receiptIds);

    /// @notice Get receipts by intent hash
    /// @param intentHash Intent to query
    /// @return receiptIds Array of receipt IDs
    function getReceiptsByIntent(bytes32 intentHash) external view returns (bytes32[] memory receiptIds);

    /// @notice Get challenge window duration
    /// @return duration Challenge window in seconds
    function getChallengeWindow() external view returns (uint64 duration);

    /// @notice Compute receipt ID from receipt data
    /// @param receipt Receipt to hash
    /// @return receiptId Computed receipt ID
    function computeReceiptId(Types.IntentReceipt calldata receipt) external pure returns (bytes32 receiptId);

    /// @notice Resolve an escalated dispute (DisputeModule only)
    /// @param receiptId Receipt under dispute
    /// @param solverFault Whether solver was at fault
    function resolveEscalatedDispute(bytes32 receiptId, bool solverFault) external;
}
