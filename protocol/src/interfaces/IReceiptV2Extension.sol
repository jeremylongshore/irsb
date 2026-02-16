// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TypesV2 } from "../libraries/TypesV2.sol";

/// @title IReceiptV2Extension
/// @notice Interface for V2 receipt extension with dual attestation
interface IReceiptV2Extension {
    // ============ Events ============

    /// @notice Emitted when a V2 receipt is posted
    /// @dev Only emits commitments, never plaintext metadata
    event ReceiptV2Posted(
        bytes32 indexed receiptId,
        bytes32 indexed intentHash,
        bytes32 indexed solverId,
        address client,
        bytes32 metadataCommitment,
        TypesV2.PrivacyLevel privacyLevel,
        bytes32 escrowId,
        uint64 expiry
    );

    /// @notice Emitted when a V2 receipt is finalized
    event ReceiptV2Finalized(bytes32 indexed receiptId, bytes32 indexed solverId, bytes32 escrowId);

    /// @notice Emitted when a V2 receipt is disputed
    event ReceiptV2Disputed(
        bytes32 indexed receiptId, bytes32 indexed solverId, address indexed challenger, bytes32 reasonHash
    );

    /// @notice Emitted when a V2 dispute is resolved
    event ReceiptV2DisputeResolved(bytes32 indexed receiptId, bytes32 indexed solverId, bool solverFault);

    /// @notice Emitted when a challenger bond is forfeited
    event ChallengerBondForfeited(bytes32 indexed receiptId, uint256 amount);

    /// @notice Emitted when a challenger bond is returned
    event ChallengerBondReturned(bytes32 indexed receiptId, address indexed challenger, uint256 amount);

    // ============ Errors ============

    error ReceiptV2AlreadyExists();
    error ReceiptV2NotFound();
    error ReceiptV2NotPending();
    error InvalidSolverSignature();
    error InvalidClientSignature();
    error InvalidMetadataCommitment();
    error InvalidCiphertextPointer();
    error SolverNotActive();
    error NotSolverOperator();
    error ChallengeWindowActive();
    error ChallengeWindowExpired();
    error InsufficientBond();
    error UnauthorizedCaller();

    // ============ External Functions ============

    /// @notice Post a new V2 receipt with dual attestation
    /// @param receipt The V2 receipt with both signatures
    /// @return receiptId Unique receipt identifier
    function postReceiptV2(TypesV2.IntentReceiptV2 calldata receipt) external returns (bytes32 receiptId);

    /// @notice Finalize a V2 receipt after challenge window
    /// @param receiptId Receipt to finalize
    function finalizeV2(bytes32 receiptId) external;

    /// @notice Open a dispute against a V2 receipt
    /// @param receiptId Receipt to dispute
    /// @param reasonHash Hash of dispute reason
    /// @param evidenceHash Evidence bundle hash
    function openDisputeV2(bytes32 receiptId, bytes32 reasonHash, bytes32 evidenceHash) external payable;

    // ============ View Functions ============

    /// @notice Get V2 receipt details
    /// @param receiptId Receipt to query
    /// @return receipt V2 receipt struct
    /// @return status Receipt status
    function getReceiptV2(bytes32 receiptId)
        external
        view
        returns (TypesV2.IntentReceiptV2 memory receipt, TypesV2.ReceiptV2Status status);

    /// @notice Check if a V2 receipt can be finalized
    /// @param receiptId Receipt to check
    /// @return canFinalize Whether receipt can be finalized
    function canFinalizeV2(bytes32 receiptId) external view returns (bool canFinalize);

    /// @notice Compute receipt ID from V2 receipt data
    /// @param receipt V2 receipt to hash
    /// @return receiptId Computed receipt ID
    function computeReceiptV2Id(TypesV2.IntentReceiptV2 calldata receipt) external pure returns (bytes32 receiptId);

    /// @notice Get the EIP-712 domain separator
    /// @return domainSeparator The domain separator
    function domainSeparator() external view returns (bytes32);

    /// @notice Get challenge window duration
    /// @return duration Challenge window in seconds
    function challengeWindow() external view returns (uint64);

    /// @notice Get minimum challenger bond
    /// @return minBond Minimum bond in wei
    function challengerBondMin() external view returns (uint256);

    /// @notice Get challenger address for a disputed receipt
    /// @param receiptId Receipt to query
    /// @return challenger Challenger address
    function getChallenger(bytes32 receiptId) external view returns (address challenger);

    /// @notice Get challenger bond for a disputed receipt
    /// @param receiptId Receipt to query
    /// @return bond Bond amount in wei
    function getChallengerBondV2(bytes32 receiptId) external view returns (uint256 bond);

    /// @notice Mark a challenger bond as forfeited
    /// @param receiptId Receipt whose challenger bond is forfeited
    function forfeitChallengerBond(bytes32 receiptId) external;

    /// @notice Return challenger bond to challenger
    /// @param receiptId Receipt whose challenger bond should be returned
    function returnChallengerBond(bytes32 receiptId) external;

    /// @notice Transfer challenger bond to a specific recipient
    /// @param receiptId Receipt whose challenger bond should be transferred
    /// @param recipient Address to receive the bond
    function transferChallengerBondTo(bytes32 receiptId, address recipient) external;
}
