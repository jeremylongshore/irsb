// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { AgenticCommerce } from "../src/AgenticCommerce.sol";
import { IAgenticCommerce } from "../src/interfaces/IAgenticCommerce.sol";
import { IACPHook } from "../src/interfaces/IACPHook.sol";
import { TypesACP } from "../src/libraries/TypesACP.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

/// @notice Mock hook that tracks calls and can optionally reject actions
contract MockACPHook is IACPHook {
    uint256 public beforeCalls;
    uint256 public afterCalls;
    bool public shouldReject;

    TypesACP.Action public lastBeforeAction;
    TypesACP.Action public lastAfterAction;
    uint256 public lastJobId;

    function setReject(bool _reject) external {
        shouldReject = _reject;
    }

    function beforeAction(uint256 jobId, TypesACP.Action action, address) external override returns (bool) {
        beforeCalls++;
        lastBeforeAction = action;
        lastJobId = jobId;
        return !shouldReject;
    }

    function afterAction(uint256 jobId, TypesACP.Action action, address) external override {
        afterCalls++;
        lastAfterAction = action;
        lastJobId = jobId;
    }
}

contract AgenticCommerceTest is Test {
    AgenticCommerce public commerce;
    MockERC20 public token;
    MockACPHook public mockHook;

    address public client = address(0x1);
    address public provider = address(0x2);
    address public evaluator = address(0x3);
    address public owner;

    uint256 public constant PAYMENT_AMOUNT = 100e18;
    uint256 public constant DEADLINE = 1 days;

    function setUp() public {
        owner = address(this);

        commerce = new AgenticCommerce();
        token = new MockERC20("Test Token", "TST", 18);
        mockHook = new MockACPHook();

        // Fund client with tokens
        token.mint(client, 1000e18);

        // Client approves commerce contract
        vm.prank(client);
        token.approve(address(commerce), type(uint256).max);
    }

    // ============ Helpers ============

    function _createAndFundJob() internal returns (uint256 jobId) {
        vm.prank(client);
        jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        vm.prank(client);
        commerce.fundJob(jobId);
    }

    function _createFundAndAcceptJob() internal returns (uint256 jobId) {
        jobId = _createAndFundJob();

        vm.prank(provider);
        commerce.acceptJob(jobId);
    }

    function _fullLifecycle() internal returns (uint256 jobId) {
        jobId = _createFundAndAcceptJob();

        vm.prank(provider);
        commerce.submitResult(jobId, keccak256("result"));
    }

    // ============ Create Job Tests ============

    function test_CreateJob() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        assertEq(jobId, 1);
        assertEq(commerce.nextJobId(), 2);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(job.client, client);
        assertEq(job.provider, address(0));
        assertEq(job.evaluator, evaluator);
        assertEq(job.paymentToken, address(token));
        assertEq(job.paymentAmount, PAYMENT_AMOUNT);
        assertEq(job.specHash, keccak256("spec"));
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Open));
    }

    function test_CreateJob_RevertZeroAmount() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSignature("ZeroPaymentAmount()"));
        commerce.createJob(address(token), 0, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator);
    }

    function test_CreateJob_RevertZeroDeadline() public {
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSignature("ZeroDeadline()"));
        commerce.createJob(address(token), PAYMENT_AMOUNT, keccak256("spec"), 0, evaluator);
    }

    // ============ Fund Job Tests ============

    function test_FundJob() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        uint256 balanceBefore = token.balanceOf(client);

        vm.prank(client);
        commerce.fundJob(jobId);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Funded));
        assertEq(token.balanceOf(address(commerce)), PAYMENT_AMOUNT);
        assertEq(token.balanceOf(client), balanceBefore - PAYMENT_AMOUNT);
    }

    function test_FundJob_RevertNotClient() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSignature("NotJobClient()"));
        commerce.fundJob(jobId);
    }

    function test_FundJob_RevertWrongStatus() public {
        uint256 jobId = _createAndFundJob();

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgenticCommerce.InvalidJobStatus.selector, TypesACP.JobStatus.Funded, TypesACP.JobStatus.Open
            )
        );
        commerce.fundJob(jobId);
    }

    // ============ Accept Job Tests ============

    function test_AcceptJob() public {
        uint256 jobId = _createAndFundJob();

        vm.prank(provider);
        commerce.acceptJob(jobId);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(job.provider, provider);
    }

    function test_AcceptJob_RevertWrongStatus() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAgenticCommerce.InvalidJobStatus.selector, TypesACP.JobStatus.Open, TypesACP.JobStatus.Funded
            )
        );
        commerce.acceptJob(jobId);
    }

    function test_AcceptJob_RevertAlreadyAccepted() public {
        uint256 jobId = _createAndFundJob();

        vm.prank(provider);
        commerce.acceptJob(jobId);

        vm.prank(address(0x99));
        vm.expectRevert(abi.encodeWithSignature("AlreadyAccepted()"));
        commerce.acceptJob(jobId);
    }

    // ============ Submit Result Tests ============

    function test_SubmitResult() public {
        uint256 jobId = _createFundAndAcceptJob();

        bytes32 resultHash = keccak256("result-data");

        vm.prank(provider);
        commerce.submitResult(jobId, resultHash);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(job.resultHash, resultHash);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Submitted));
    }

    function test_SubmitResult_RevertNotProvider() public {
        uint256 jobId = _createFundAndAcceptJob();

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSignature("NotJobProvider()"));
        commerce.submitResult(jobId, keccak256("result"));
    }

    // ============ Complete Job Tests ============

    function test_CompleteJob() public {
        uint256 jobId = _fullLifecycle();

        uint256 providerBalanceBefore = token.balanceOf(provider);

        vm.prank(evaluator);
        commerce.completeJob(jobId);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Completed));
        assertEq(token.balanceOf(provider), providerBalanceBefore + PAYMENT_AMOUNT);
        assertEq(token.balanceOf(address(commerce)), 0);
    }

    function test_CompleteJob_ClientAsEvaluator() public {
        // Create job with no evaluator
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), address(0)
        );

        vm.prank(client);
        commerce.fundJob(jobId);

        vm.prank(provider);
        commerce.acceptJob(jobId);

        vm.prank(provider);
        commerce.submitResult(jobId, keccak256("result"));

        // Client can complete when no evaluator is set
        vm.prank(client);
        commerce.completeJob(jobId);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Completed));
    }

    function test_CompleteJob_RevertNotEvaluator() public {
        uint256 jobId = _fullLifecycle();

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSignature("NotJobEvaluator()"));
        commerce.completeJob(jobId);
    }

    // ============ Reject Job Tests ============

    function test_RejectJob() public {
        uint256 jobId = _fullLifecycle();

        vm.prank(evaluator);
        commerce.rejectJob(jobId, "Quality too low");

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Rejected));
    }

    function test_RejectJob_RevertNotEvaluator() public {
        uint256 jobId = _fullLifecycle();

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSignature("NotJobEvaluator()"));
        commerce.rejectJob(jobId, "bad");
    }

    // ============ Claim Refund Tests ============

    function test_ClaimRefund() public {
        uint256 jobId = _createAndFundJob();

        // Fast forward past deadline
        vm.warp(block.timestamp + DEADLINE + 1);

        uint256 clientBalanceBefore = token.balanceOf(client);

        vm.prank(client);
        commerce.claimRefund(jobId);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Expired));
        assertEq(token.balanceOf(client), clientBalanceBefore + PAYMENT_AMOUNT);
    }

    function test_ClaimRefund_AfterRejection() public {
        uint256 jobId = _fullLifecycle();

        vm.prank(evaluator);
        commerce.rejectJob(jobId, "bad");

        // Fast forward past deadline
        vm.warp(block.timestamp + DEADLINE + 1);

        vm.prank(client);
        commerce.claimRefund(jobId);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Expired));
    }

    function test_ClaimRefund_RevertNotExpired() public {
        uint256 jobId = _createAndFundJob();

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSignature("JobNotExpired()"));
        commerce.claimRefund(jobId);
    }

    function test_ClaimRefund_RevertNotClient() public {
        uint256 jobId = _createAndFundJob();

        vm.warp(block.timestamp + DEADLINE + 1);

        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSignature("NotJobClient()"));
        commerce.claimRefund(jobId);
    }

    function test_ClaimRefundUnhookable() public {
        // Set up a hook that rejects everything
        commerce.setHook(address(mockHook));
        mockHook.setReject(true);

        // Create and fund job (must be done before hook rejects)
        mockHook.setReject(false);
        uint256 jobId = _createAndFundJob();
        mockHook.setReject(true);

        // Fast forward past deadline
        vm.warp(block.timestamp + DEADLINE + 1);

        uint256 hookCallsBefore = mockHook.beforeCalls();

        // claimRefund should succeed even though hook rejects — it's unhookable
        vm.prank(client);
        commerce.claimRefund(jobId);

        // Verify hook was NOT called for claimRefund
        assertEq(mockHook.beforeCalls(), hookCallsBefore);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(uint256(job.status), uint256(TypesACP.JobStatus.Expired));
    }

    // ============ Hook Tests ============

    function test_HookCalledOnActions() public {
        commerce.setHook(address(mockHook));

        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        assertEq(mockHook.beforeCalls(), 1);
        assertEq(mockHook.afterCalls(), 1);
        assertEq(uint256(mockHook.lastBeforeAction()), uint256(TypesACP.Action.CreateJob));

        vm.prank(client);
        commerce.fundJob(jobId);

        assertEq(mockHook.beforeCalls(), 2);
        assertEq(mockHook.afterCalls(), 2);
        assertEq(uint256(mockHook.lastBeforeAction()), uint256(TypesACP.Action.FundJob));
    }

    function test_HookRejectsAction() public {
        commerce.setHook(address(mockHook));
        mockHook.setReject(true);

        vm.prank(client);
        vm.expectRevert(abi.encodeWithSignature("HookRejected()"));
        commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );
    }

    // ============ View Function Tests ============

    function test_GetJobsByClient() public {
        vm.startPrank(client);
        commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec1"), uint256(block.timestamp + DEADLINE), evaluator
        );
        commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec2"), uint256(block.timestamp + DEADLINE), evaluator
        );
        vm.stopPrank();

        uint256[] memory jobs = commerce.getJobsByClient(client);
        assertEq(jobs.length, 2);
        assertEq(jobs[0], 1);
        assertEq(jobs[1], 2);
    }

    function test_GetJobsByProvider() public {
        uint256 jobId = _createFundAndAcceptJob();

        uint256[] memory jobs = commerce.getJobsByProvider(provider);
        assertEq(jobs.length, 1);
        assertEq(jobs[0], jobId);
    }

    function test_GetJob_NonExistent() public view {
        TypesACP.Job memory job = commerce.getJob(999);
        assertEq(job.createdAt, 0);
    }

    // ============ Access Control Tests ============

    function test_OnlyClientCanFund() public {
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        vm.prank(evaluator);
        vm.expectRevert(abi.encodeWithSignature("NotJobClient()"));
        commerce.fundJob(jobId);
    }

    function test_OnlyProviderCanSubmit() public {
        uint256 jobId = _createFundAndAcceptJob();

        vm.prank(evaluator);
        vm.expectRevert(abi.encodeWithSignature("NotJobProvider()"));
        commerce.submitResult(jobId, keccak256("result"));
    }

    function test_CannotAcceptFundedJobTwice() public {
        uint256 jobId = _createAndFundJob();

        vm.prank(provider);
        commerce.acceptJob(jobId);

        vm.prank(address(0x99));
        vm.expectRevert(abi.encodeWithSignature("AlreadyAccepted()"));
        commerce.acceptJob(jobId);
    }

    // ============ Admin Tests ============

    function test_SetHook() public {
        commerce.setHook(address(mockHook));
        assertEq(address(commerce.hook()), address(mockHook));
    }

    function test_SetHook_RevertNonOwner() public {
        vm.prank(client);
        vm.expectRevert();
        commerce.setHook(address(mockHook));
    }

    function test_PauseUnpause() public {
        commerce.pause();

        vm.prank(client);
        vm.expectRevert();
        commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        commerce.unpause();

        vm.prank(client);
        commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );
    }

    // ============ Fuzz Tests ============

    function testFuzz_CreateJobAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 1e30);

        token.mint(client, amount);
        vm.prank(client);
        token.approve(address(commerce), amount);

        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), amount, keccak256("spec"), uint256(block.timestamp + DEADLINE), evaluator
        );

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(job.paymentAmount, amount);
    }

    function testFuzz_CreateJobDeadlines(uint256 deadline) public {
        vm.assume(deadline > 0);

        vm.prank(client);
        uint256 jobId = commerce.createJob(address(token), PAYMENT_AMOUNT, keccak256("spec"), deadline, evaluator);

        TypesACP.Job memory job = commerce.getJob(jobId);
        assertEq(job.deadline, deadline);
    }
}
