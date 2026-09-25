// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IAgenticCommerce } from "./interfaces/IAgenticCommerce.sol";
import { IACPHook } from "./interfaces/IACPHook.sol";
import { TypesACP } from "./libraries/TypesACP.sol";

/// @title AgenticCommerce
/// @notice EIP-8183 Agentic Commerce Protocol — standalone job lifecycle with ERC-20 escrow
/// @dev Implements three-role model (Client, Provider, Evaluator) with hook system for composability
contract AgenticCommerce is IAgenticCommerce, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State ============

    /// @notice Next job ID counter
    uint256 public nextJobId;

    /// @notice Job storage by ID
    mapping(uint256 => TypesACP.Job) private _jobs;

    /// @notice Jobs by client address
    mapping(address => uint256[]) private _clientJobs;

    /// @notice Jobs by provider address
    mapping(address => uint256[]) private _providerJobs;

    /// @notice Optional hook for lifecycle callbacks
    IACPHook public hook;

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        nextJobId = 1;
    }

    // ============ Modifiers ============

    modifier jobExists(uint256 jobId) {
        if (_jobs[jobId].createdAt == 0) revert JobNotFound();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IAgenticCommerce
    function createJob(address paymentToken, uint256 amount, bytes32 specHash, uint256 deadline, address evaluator)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 jobId)
    {
        if (amount == 0) revert ZeroPaymentAmount();
        if (deadline == 0) revert ZeroDeadline();

        jobId = nextJobId++;

        _jobs[jobId] = TypesACP.Job({
            id: jobId,
            client: msg.sender,
            provider: address(0),
            evaluator: evaluator,
            paymentToken: paymentToken,
            paymentAmount: amount,
            deadline: deadline,
            specHash: specHash,
            resultHash: bytes32(0),
            status: TypesACP.JobStatus.Open,
            createdAt: block.timestamp
        });

        _clientJobs[msg.sender].push(jobId);

        _callBeforeHook(jobId, TypesACP.Action.CreateJob, msg.sender);

        emit JobCreated(jobId, msg.sender, specHash, amount);

        _callAfterHook(jobId, TypesACP.Action.CreateJob, msg.sender);
    }

    /// @inheritdoc IAgenticCommerce
    function fundJob(uint256 jobId) external jobExists(jobId) whenNotPaused nonReentrant {
        TypesACP.Job storage job = _jobs[jobId];
        if (msg.sender != job.client) revert NotJobClient();
        if (job.status != TypesACP.JobStatus.Open) {
            revert InvalidJobStatus(job.status, TypesACP.JobStatus.Open);
        }

        _callBeforeHook(jobId, TypesACP.Action.FundJob, msg.sender);

        // Transfer ERC-20 payment into this contract
        IERC20(job.paymentToken).safeTransferFrom(msg.sender, address(this), job.paymentAmount);
        job.status = TypesACP.JobStatus.Funded;

        emit JobFunded(jobId, msg.sender, job.paymentAmount);

        _callAfterHook(jobId, TypesACP.Action.FundJob, msg.sender);
    }

    /// @inheritdoc IAgenticCommerce
    function acceptJob(uint256 jobId) external jobExists(jobId) whenNotPaused nonReentrant {
        TypesACP.Job storage job = _jobs[jobId];
        if (job.status != TypesACP.JobStatus.Funded) {
            revert InvalidJobStatus(job.status, TypesACP.JobStatus.Funded);
        }
        if (job.provider != address(0)) revert AlreadyAccepted();

        _callBeforeHook(jobId, TypesACP.Action.AcceptJob, msg.sender);

        job.provider = msg.sender;
        _providerJobs[msg.sender].push(jobId);

        emit JobAccepted(jobId, msg.sender);

        _callAfterHook(jobId, TypesACP.Action.AcceptJob, msg.sender);
    }

    /// @inheritdoc IAgenticCommerce
    function submitResult(uint256 jobId, bytes32 resultHash) external jobExists(jobId) whenNotPaused nonReentrant {
        TypesACP.Job storage job = _jobs[jobId];
        if (msg.sender != job.provider) revert NotJobProvider();
        if (job.status != TypesACP.JobStatus.Funded) {
            revert InvalidJobStatus(job.status, TypesACP.JobStatus.Funded);
        }

        _callBeforeHook(jobId, TypesACP.Action.SubmitResult, msg.sender);

        job.resultHash = resultHash;
        job.status = TypesACP.JobStatus.Submitted;

        emit ResultSubmitted(jobId, msg.sender, resultHash);

        _callAfterHook(jobId, TypesACP.Action.SubmitResult, msg.sender);
    }

    /// @inheritdoc IAgenticCommerce
    function completeJob(uint256 jobId) external jobExists(jobId) whenNotPaused nonReentrant {
        TypesACP.Job storage job = _jobs[jobId];
        if (job.status != TypesACP.JobStatus.Submitted) {
            revert InvalidJobStatus(job.status, TypesACP.JobStatus.Submitted);
        }

        // Evaluator or client (if no evaluator set) can complete
        address evaluator = job.evaluator == address(0) ? job.client : job.evaluator;
        if (msg.sender != evaluator) revert NotJobEvaluator();

        _callBeforeHook(jobId, TypesACP.Action.CompleteJob, msg.sender);

        job.status = TypesACP.JobStatus.Completed;

        // Release funds to provider
        IERC20(job.paymentToken).safeTransfer(job.provider, job.paymentAmount);

        emit JobCompleted(jobId, job.provider, job.paymentAmount);

        _callAfterHook(jobId, TypesACP.Action.CompleteJob, msg.sender);
    }

    /// @inheritdoc IAgenticCommerce
    function rejectJob(uint256 jobId, string calldata reason) external jobExists(jobId) whenNotPaused nonReentrant {
        TypesACP.Job storage job = _jobs[jobId];
        if (job.status != TypesACP.JobStatus.Submitted) {
            revert InvalidJobStatus(job.status, TypesACP.JobStatus.Submitted);
        }

        // Evaluator or client (if no evaluator set) can reject
        address evaluator = job.evaluator == address(0) ? job.client : job.evaluator;
        if (msg.sender != evaluator) revert NotJobEvaluator();

        _callBeforeHook(jobId, TypesACP.Action.RejectJob, msg.sender);

        job.status = TypesACP.JobStatus.Rejected;

        emit JobRejected(jobId, reason);

        _callAfterHook(jobId, TypesACP.Action.RejectJob, msg.sender);
    }

    /// @inheritdoc IAgenticCommerce
    /// @dev Per EIP-8183: claimRefund is unhookable — hooks are NOT called
    function claimRefund(uint256 jobId) external jobExists(jobId) nonReentrant {
        TypesACP.Job storage job = _jobs[jobId];
        if (msg.sender != job.client) revert NotJobClient();

        // Can only refund funded or rejected jobs past deadline
        if (job.status != TypesACP.JobStatus.Funded && job.status != TypesACP.JobStatus.Rejected) {
            revert InvalidJobStatus(job.status, TypesACP.JobStatus.Funded);
        }
        if (block.timestamp <= job.deadline) revert JobNotExpired();

        job.status = TypesACP.JobStatus.Expired;

        // Return funds to client — NO hooks called (unhookable per spec)
        IERC20(job.paymentToken).safeTransfer(job.client, job.paymentAmount);

        emit RefundClaimed(jobId, msg.sender, job.paymentAmount);
    }

    // ============ View Functions ============

    /// @inheritdoc IAgenticCommerce
    function getJob(uint256 jobId) external view returns (TypesACP.Job memory) {
        return _jobs[jobId];
    }

    /// @inheritdoc IAgenticCommerce
    function getJobsByClient(address client) external view returns (uint256[] memory) {
        return _clientJobs[client];
    }

    /// @inheritdoc IAgenticCommerce
    function getJobsByProvider(address provider) external view returns (uint256[] memory) {
        return _providerJobs[provider];
    }

    // ============ Admin Functions ============

    /// @notice Set the hook contract for lifecycle callbacks
    /// @param _hook New hook address (address(0) to disable)
    function setHook(address _hook) external onlyOwner {
        address oldHook = address(hook);
        hook = IACPHook(_hook);
        emit HookUpdated(oldHook, _hook);
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    /// @dev Call beforeAction hook if set; revert if hook returns false
    function _callBeforeHook(uint256 jobId, TypesACP.Action action, address caller) internal {
        if (address(hook) != address(0)) {
            if (!hook.beforeAction(jobId, action, caller)) {
                revert HookRejected();
            }
        }
    }

    /// @dev Call afterAction hook if set
    function _callAfterHook(uint256 jobId, TypesACP.Action action, address caller) internal {
        if (address(hook) != address(0)) {
            hook.afterAction(jobId, action, caller);
        }
    }
}
