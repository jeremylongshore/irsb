// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IRSB V2 Types Library
/// @notice Extended data structures for V2 receipts with dual attestation
library TypesV2 {
    // ============ Enums ============

    /// @notice Privacy levels for receipt metadata
    enum PrivacyLevel {
        Public, // Full receipt visible to all
        SemiPublic, // Commitment visible, payload gated via Lit
        Private // Commitment only, encrypted payload
    }

    /// @notice V2 receipt lifecycle states
    enum ReceiptV2Status {
        Pending, // Posted, in challenge window
        Disputed, // Under active dispute
        Finalized, // Settled successfully
        Slashed // Violation confirmed, solver penalized
    }

    // ============ Structs ============

    /// @notice V2 Intent Receipt with dual attestation and commitments
    /// @dev Extends V1 with client signature, metadata commitment, and escrow link
    struct IntentReceiptV2 {
        // === Core Identity (from V1) ===
        bytes32 intentHash; // Hash of original intent/order
        bytes32 constraintsHash; // Hash of ConstraintEnvelope
        bytes32 routeHash; // Hash of execution route
        bytes32 outcomeHash; // Hash of OutcomeEnvelope
        bytes32 evidenceHash; // IPFS/Arweave CID of evidence bundle
        // === Timing ===
        uint64 createdAt; // Receipt creation timestamp
        uint64 expiry; // Deadline for settlement proof
        // === Parties ===
        bytes32 solverId; // Unique solver identifier
        address client; // Client/counterparty address (for clientSig validation)
        // === V2 Extensions ===
        bytes32 metadataCommitment; // keccak256 of arbitrary metadata (privacy-safe)
        string ciphertextPointer; // IPFS CID or digest for encrypted payload
        PrivacyLevel privacyLevel; // Privacy classification
        bytes32 escrowId; // Optional link to EscrowVault (bytes32(0) if none)
        // === Dual Attestation ===
        bytes solverSig; // Solver's EIP-712 signature
        bytes clientSig; // Client's EIP-712 signature
    }

    /// @notice Stored V2 receipt with dispute state
    struct StoredReceiptV2 {
        IntentReceiptV2 receipt; // The original V2 receipt
        ReceiptV2Status status; // Current status
        address challenger; // Who opened dispute (if any)
        uint256 challengerBond; // Bond posted by challenger
        bytes32 disputeReason; // Reason hash if disputed
    }

    // ============ Constants ============

    /// @notice Maximum length for ciphertext pointer (CID)
    uint256 constant MAX_POINTER_LENGTH = 64;

    /// @notice EIP-712 type hash for IntentReceiptV2
    bytes32 constant RECEIPT_V2_TYPEHASH = keccak256(
        "IntentReceiptV2(" "bytes32 intentHash," "bytes32 constraintsHash," "bytes32 routeHash," "bytes32 outcomeHash,"
        "bytes32 evidenceHash," "uint64 createdAt," "uint64 expiry," "bytes32 solverId," "address client,"
        "bytes32 metadataCommitment," "string ciphertextPointer," "uint8 privacyLevel," "bytes32 escrowId" ")"
    );

    // ============ Helper Functions ============

    /// @notice Compute V2 receipt ID (unique identifier)
    /// @param receipt The V2 receipt
    /// @return receiptId Unique receipt identifier
    function computeReceiptV2Id(IntentReceiptV2 memory receipt) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                receipt.intentHash, receipt.solverId, receipt.client, receipt.createdAt, receipt.metadataCommitment
            )
        );
    }

    /// @notice Compute EIP-712 struct hash for V2 receipt
    /// @param receipt The V2 receipt to hash
    /// @return structHash The EIP-712 struct hash
    function hashReceiptV2(IntentReceiptV2 memory receipt) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RECEIPT_V2_TYPEHASH,
                receipt.intentHash,
                receipt.constraintsHash,
                receipt.routeHash,
                receipt.outcomeHash,
                receipt.evidenceHash,
                receipt.createdAt,
                receipt.expiry,
                receipt.solverId,
                receipt.client,
                receipt.metadataCommitment,
                keccak256(bytes(receipt.ciphertextPointer)),
                uint8(receipt.privacyLevel),
                receipt.escrowId
            )
        );
    }

    /// @notice Validate ciphertext pointer format
    /// @param pointer The pointer to validate
    /// @return valid Whether the pointer is valid
    function isValidPointer(string memory pointer) internal pure returns (bool) {
        bytes memory b = bytes(pointer);

        // Check length
        if (b.length == 0 || b.length > MAX_POINTER_LENGTH) {
            return false;
        }

        // Check characters (alphanumeric + base58 safe chars)
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            bool isAlphanumeric = (char >= 0x30 && char <= 0x39) // 0-9
                || (char >= 0x41 && char <= 0x5A) // A-Z
                || (char >= 0x61 && char <= 0x7A); // a-z

            if (!isAlphanumeric) {
                return false;
            }
        }

        return true;
    }
}
