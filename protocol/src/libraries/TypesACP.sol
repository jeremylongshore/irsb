// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title TypesACP - Agentic Commerce Protocol Types
/// @notice Shared data structures for EIP-8183 Agentic Commerce
library TypesACP {
    // ============ Enums ============

    /// @notice Job lifecycle states per EIP-8183
    enum JobStatus {
        Open, // Created, awaiting funding
        Funded, // Client deposited payment
        Submitted, // Provider submitted result
        Completed, // Evaluator/client approved, funds released
        Rejected, // Evaluator/client rejected
        Expired // Deadline passed without completion
    }

    /// @notice Action identifiers for hook callbacks
    enum Action {
        CreateJob,
        FundJob,
        AcceptJob,
        SubmitResult,
        CompleteJob,
        RejectJob
    }

    // ============ Structs ============

    /// @notice Job record per EIP-8183
    struct Job {
        uint256 id;
        address client;
        address provider; // address(0) until accepted
        address evaluator; // optional third-party judge
        address paymentToken; // ERC-20 address
        uint256 paymentAmount;
        uint256 deadline;
        bytes32 specHash; // IPFS CID or content hash of job spec
        bytes32 resultHash; // filled on submission
        JobStatus status;
        uint256 createdAt;
    }
}
