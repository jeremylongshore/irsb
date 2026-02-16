// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IRSB Types Library
/// @notice Shared data structures for Intent Receipts & Solver Bonds protocol
library Types {
    // ============ Enums ============

    /// @notice Solver lifecycle states
    enum SolverStatus {
        Inactive, // Registered but not bonded
        Active, // Bonded and operational
        Jailed, // Temporarily suspended (can recover)
        Banned // Permanently banned
    }

    /// @notice Receipt lifecycle states
    enum ReceiptStatus {
        Pending, // Posted, in challenge window
        Disputed, // Under active dispute
        Finalized, // Settled successfully
        Slashed // Violation confirmed, solver penalized
    }

    /// @notice Deterministic dispute reason codes
    enum DisputeReason {
        None, // 0x00 - No dispute
        Timeout, // 0x01 - Expiry passed without settlement
        MinOutViolation, // 0x02 - amountOut < minOut
        WrongToken, // 0x03 - Incorrect token delivered
        WrongChain, // 0x04 - Settled on wrong chain
        WrongRecipient, // 0x05 - Delivered to wrong address
        ReceiptMismatch, // 0x06 - Receipt hash mismatch
        InvalidSignature, // 0x07 - Solver signature invalid
        Subjective // 0x08 - Requires arbitration (v0.2)
    }

    // ============ Structs ============

    /// @notice Canonical intent receipt structure
    /// @dev Posted by solver after executing an intent
    struct IntentReceipt {
        bytes32 intentHash; // Hash of original intent/order
        bytes32 constraintsHash; // Hash of ConstraintEnvelope
        bytes32 routeHash; // Hash of execution route
        bytes32 outcomeHash; // Hash of OutcomeEnvelope
        bytes32 evidenceHash; // IPFS/Arweave CID of evidence bundle
        uint64 createdAt; // Receipt creation timestamp
        uint64 expiry; // Deadline for settlement proof
        bytes32 solverId; // Unique solver identifier
        bytes solverSig; // Solver's signature over receipt
    }

    /// @notice Off-chain constraint envelope (hashes to constraintsHash)
    /// @dev Canonical encoding for verification
    struct ConstraintEnvelope {
        uint256[] chainIds; // Allowed execution chains
        address[] tokensIn; // Input tokens
        address[] tokensOut; // Output tokens
        uint256[] minOut; // Minimum output amounts
        uint256 maxSlippageBps; // Max slippage in basis points
        uint64 deadline; // Intent expiration
        address[] allowedVenues; // Optional: allowed DEXs/bridges
        bytes32[] requiredProofs; // Optional: required attestations
    }

    /// @notice Off-chain outcome envelope (hashes to outcomeHash)
    /// @dev Canonical encoding of execution result
    struct OutcomeEnvelope {
        uint256 finalChainId; // Chain where settlement occurred
        address tokenOut; // Actual output token
        uint256 amountOut; // Actual output amount
        address recipient; // Recipient address
        bytes32[] txHashes; // Settlement transaction hashes
    }

    /// @notice Solver reputation metrics
    struct IntentScore {
        uint64 totalFills; // Total receipts posted
        uint64 successfulFills; // Finalized without dispute
        uint64 disputesOpened; // Disputes against solver
        uint64 disputesLost; // Disputes resulting in slash
        uint256 volumeProcessed; // Total value processed (USD)
        uint256 totalSlashed; // Total amount slashed
    }

    /// @notice Solver registration and state
    struct Solver {
        address operator; // Authorized signing address
        string metadataURI; // Off-chain metadata (IPFS)
        uint256 bondBalance; // Available bond balance
        uint256 lockedBalance; // Locked during disputes
        SolverStatus status; // Current lifecycle state
        IntentScore score; // Reputation metrics
        uint64 registeredAt; // Registration timestamp
        uint64 lastActivityAt; // Last receipt timestamp
    }

    /// @notice Stored receipt with dispute state
    struct StoredReceipt {
        IntentReceipt receipt; // The original receipt
        ReceiptStatus status; // Current status
        address challenger; // Who opened dispute (if any)
        uint256 challengerBond; // Bond posted by challenger
        DisputeReason disputeReason; // Reason if disputed
    }

    /// @notice Active dispute record
    struct Dispute {
        bytes32 receiptId; // Receipt being disputed
        bytes32 solverId; // Solver under dispute
        address challenger; // Who opened the dispute
        DisputeReason reason; // Dispute category
        bytes32 evidenceHash; // Challenger's evidence
        uint64 openedAt; // Dispute start time
        uint64 deadline; // Resolution deadline
        bool resolved; // Whether resolved
    }

    // ============ Constants ============

    /// @notice Minimum bond to register as solver (0.1 ETH)
    uint256 constant MIN_BOND = 0.1 ether;

    /// @notice Dispute window duration (1 hour)
    uint64 constant DISPUTE_WINDOW = 1 hours;

    /// @notice Bond withdrawal cooldown (7 days)
    uint64 constant WITHDRAWAL_COOLDOWN = 7 days;

    /// @notice Challenger bond minimum (10% of solver bond)
    uint16 constant CHALLENGER_BOND_BPS = 1000;

    /// @notice Slash to user (80%)
    uint16 constant SLASH_USER_BPS = 8000;

    /// @notice Slash to challenger (15%)
    uint16 constant SLASH_CHALLENGER_BPS = 1500;

    /// @notice Slash to treasury (5%)
    uint16 constant SLASH_TREASURY_BPS = 500;

    /// @notice Basis points denominator
    uint16 constant BPS = 10000;

    // ============ Helper Functions ============

    /// @notice Compute receipt ID from receipt data
    function computeReceiptId(IntentReceipt memory receipt) internal pure returns (bytes32) {
        return keccak256(abi.encode(receipt.intentHash, receipt.solverId, receipt.createdAt));
    }

    /// @notice Compute hash of constraint envelope
    function hashConstraints(ConstraintEnvelope memory c) internal pure returns (bytes32) {
        return keccak256(abi.encode(c));
    }

    /// @notice Compute hash of outcome envelope
    function hashOutcome(OutcomeEnvelope memory o) internal pure returns (bytes32) {
        return keccak256(abi.encode(o));
    }
}
