// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IACPHook } from "../interfaces/IACPHook.sol";
import { IAgenticCommerce } from "../interfaces/IAgenticCommerce.sol";
import { ISolverRegistry } from "../interfaces/ISolverRegistry.sol";
import { IIntentReceiptHub } from "../interfaces/IIntentReceiptHub.sol";
import { TypesACP } from "../libraries/TypesACP.sol";
import { Types } from "../libraries/Types.sol";

/// @title IRSBHook
/// @notice Bridges EIP-8183 Agentic Commerce jobs into the IRSB accountability pipeline
/// @dev Implements IACPHook to auto-lock bonds, post receipts, and open disputes
contract IRSBHook is IACPHook {
    // ============ State ============

    /// @notice Reference to SolverRegistry for bond operations
    ISolverRegistry public immutable solverRegistry;

    /// @notice Reference to IntentReceiptHub for receipt posting
    IIntentReceiptHub public immutable receiptHub;

    /// @notice Reference to AgenticCommerce for reading job data
    IAgenticCommerce public immutable commerce;

    /// @notice Bond lock percentage in basis points (e.g., 1000 = 10%)
    uint256 public immutable bondLockBps;

    /// @notice Basis points denominator
    uint256 public constant BPS = 10000;

    /// @notice Mapping from jobId to locked bond amount (for unlock on completion)
    mapping(uint256 => uint256) public lockedAmounts;

    /// @notice Mapping from jobId to receipt ID (for dispute on rejection)
    mapping(uint256 => bytes32) public jobReceipts;

    // ============ Errors ============

    error UnregisteredProvider();
    error InactiveSolver();

    // ============ Constructor ============

    /// @param _solverRegistry Address of IRSB SolverRegistry
    /// @param _receiptHub Address of IRSB IntentReceiptHub
    /// @param _commerce Address of AgenticCommerce contract
    /// @param _bondLockBps Bond lock percentage in basis points
    constructor(address _solverRegistry, address _receiptHub, address _commerce, uint256 _bondLockBps) {
        solverRegistry = ISolverRegistry(_solverRegistry);
        receiptHub = IIntentReceiptHub(_receiptHub);
        commerce = IAgenticCommerce(_commerce);
        bondLockBps = _bondLockBps;
    }

    // ============ IACPHook Implementation ============

    /// @inheritdoc IACPHook
    function beforeAction(
        uint256,
        /* jobId */
        TypesACP.Action action,
        address caller
    )
        external
        view
        override
        returns (bool)
    {
        if (action == TypesACP.Action.AcceptJob) {
            return _beforeAcceptJob(caller);
        }

        // All other actions pass through
        return true;
    }

    /// @inheritdoc IACPHook
    function afterAction(uint256 jobId, TypesACP.Action action, address caller) external override {
        if (action == TypesACP.Action.AcceptJob) {
            _afterAcceptJob(jobId, caller);
        } else if (action == TypesACP.Action.SubmitResult) {
            _afterSubmitResult(jobId, caller);
        } else if (action == TypesACP.Action.CompleteJob) {
            _afterCompleteJob(jobId);
        } else if (action == TypesACP.Action.RejectJob) {
            _afterRejectJob(jobId);
        }
    }

    // ============ Internal Functions ============

    /// @dev Verify provider is a registered, active solver before accepting
    function _beforeAcceptJob(address provider) internal view returns (bool) {
        bytes32 solverId = solverRegistry.getSolverByOperator(provider);
        if (solverId == bytes32(0)) revert UnregisteredProvider();

        Types.SolverStatus status = solverRegistry.getSolverStatus(solverId);
        if (status != Types.SolverStatus.Active) revert InactiveSolver();

        return true;
    }

    /// @dev Lock a portion of the solver's bond when they accept a job
    function _afterAcceptJob(uint256 jobId, address provider) internal {
        bytes32 solverId = solverRegistry.getSolverByOperator(provider);
        TypesACP.Job memory job = commerce.getJob(jobId);

        // Lock bond proportional to payment amount
        uint256 lockAmount = (job.paymentAmount * bondLockBps) / BPS;
        if (lockAmount > 0) {
            solverRegistry.lockBond(solverId, lockAmount);
            lockedAmounts[jobId] = lockAmount;
        }
    }

    /// @dev Auto-post a V1 receipt when provider submits result
    function _afterSubmitResult(uint256 jobId, address provider) internal {
        TypesACP.Job memory job = commerce.getJob(jobId);

        // Build receipt mapping:
        // intentHash = keccak256(abi.encode(jobId, specHash))
        // constraintsHash = keccak256(abi.encode(paymentToken, paymentAmount, deadline))
        // outcomeHash = resultHash from the job
        bytes32 solverId = solverRegistry.getSolverByOperator(provider);

        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256(abi.encode(jobId, job.specHash)),
            constraintsHash: keccak256(abi.encode(job.paymentToken, job.paymentAmount, job.deadline)),
            routeHash: keccak256(abi.encode("acp-v1", address(commerce))),
            outcomeHash: job.resultHash,
            evidenceHash: bytes32(0),
            createdAt: uint64(block.timestamp),
            expiry: uint64(job.deadline),
            solverId: solverId,
            solverSig: "" // Hook-posted receipt — sig skipped via postReceiptFromHook
        });

        // Post receipt via trusted hook path (no signature required)
        bytes32 receiptId = receiptHub.postReceiptFromHook(receipt, job.paymentAmount);
        jobReceipts[jobId] = receiptId;
    }

    /// @dev Unlock solver's bond on job completion
    function _afterCompleteJob(uint256 jobId) internal {
        TypesACP.Job memory job = commerce.getJob(jobId);
        bytes32 solverId = solverRegistry.getSolverByOperator(job.provider);

        uint256 lockAmount = lockedAmounts[jobId];
        if (lockAmount > 0) {
            solverRegistry.unlockBond(solverId, lockAmount);
            lockedAmounts[jobId] = 0;
        }
    }

    /// @dev Open dispute on the receipt when job is rejected
    function _afterRejectJob(uint256 jobId) internal {
        bytes32 receiptId = jobReceipts[jobId];

        // Only open dispute if a receipt was posted for this job
        if (receiptId != bytes32(0)) {
            receiptHub.openDisputeFromHook(receiptId, Types.DisputeReason.Subjective, bytes32(0));
        }
    }
}
