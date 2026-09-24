// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TypesACP } from "../libraries/TypesACP.sol";

/// @title IAgenticCommerce
/// @notice Interface for EIP-8183 Agentic Commerce Protocol
interface IAgenticCommerce {
    // ============ Events ============

    event JobCreated(uint256 indexed jobId, address indexed client, bytes32 specHash, uint256 paymentAmount);
    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event JobAccepted(uint256 indexed jobId, address indexed provider);
    event ResultSubmitted(uint256 indexed jobId, address indexed provider, bytes32 resultHash);
    event JobCompleted(uint256 indexed jobId, address indexed provider, uint256 paymentAmount);
    event JobRejected(uint256 indexed jobId, string reason);
    event RefundClaimed(uint256 indexed jobId, address indexed client, uint256 amount);
    event HookUpdated(address indexed oldHook, address indexed newHook);

    // ============ Errors ============

    error JobNotFound();
    error InvalidJobStatus(TypesACP.JobStatus current, TypesACP.JobStatus expected);
    error NotJobClient();
    error NotJobProvider();
    error NotJobEvaluator();
    error JobNotExpired();
    error ZeroPaymentAmount();
    error ZeroDeadline();
    error HookRejected();
    error AlreadyAccepted();

    // ============ External Functions ============

    /// @notice Create a new job
    /// @param paymentToken ERC-20 token for payment
    /// @param amount Payment amount
    /// @param specHash Content hash of job specification
    /// @param deadline Job completion deadline (unix timestamp)
    /// @param evaluator Optional evaluator address (address(0) = client evaluates)
    /// @return jobId Unique job identifier
    function createJob(address paymentToken, uint256 amount, bytes32 specHash, uint256 deadline, address evaluator)
        external
        returns (uint256 jobId);

    /// @notice Fund a job with ERC-20 payment
    /// @param jobId Job to fund
    function fundJob(uint256 jobId) external;

    /// @notice Accept a funded job as provider
    /// @param jobId Job to accept
    function acceptJob(uint256 jobId) external;

    /// @notice Submit result for an accepted job
    /// @param jobId Job to submit result for
    /// @param resultHash Content hash of result
    function submitResult(uint256 jobId, bytes32 resultHash) external;

    /// @notice Approve and complete a job, releasing funds to provider
    /// @param jobId Job to complete
    function completeJob(uint256 jobId) external;

    /// @notice Reject a submitted result
    /// @param jobId Job to reject
    /// @param reason Human-readable rejection reason
    function rejectJob(uint256 jobId, string calldata reason) external;

    /// @notice Claim refund for an expired job (unhookable per EIP-8183)
    /// @param jobId Job to refund
    function claimRefund(uint256 jobId) external;

    // ============ View Functions ============

    /// @notice Get job details
    /// @param jobId Job to query
    /// @return job Job struct
    function getJob(uint256 jobId) external view returns (TypesACP.Job memory job);

    /// @notice Get all jobs created by a client
    /// @param client Client address
    /// @return jobIds Array of job IDs
    function getJobsByClient(address client) external view returns (uint256[] memory jobIds);

    /// @notice Get all jobs accepted by a provider
    /// @param provider Provider address
    /// @return jobIds Array of job IDs
    function getJobsByProvider(address provider) external view returns (uint256[] memory jobIds);
}
