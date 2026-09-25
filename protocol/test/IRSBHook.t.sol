// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { AgenticCommerce } from "../src/AgenticCommerce.sol";
import { IRSBHook } from "../src/hooks/IRSBHook.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { TypesACP } from "../src/libraries/TypesACP.sol";
import { Types } from "../src/libraries/Types.sol";
import { MockERC20 } from "../src/mocks/MockERC20.sol";

contract IRSBHookTest is Test {
    AgenticCommerce public commerce;
    IRSBHook public hook;
    IntentReceiptHub public hub;
    SolverRegistry public registry;
    MockERC20 public token;

    address public client = address(0x1);
    address public provider = address(0x2);
    address public evaluator = address(0x3);
    address public unregistered = address(0x4);

    uint256 public constant PAYMENT_AMOUNT = 100e18;
    uint256 public constant MINIMUM_BOND = 0.1 ether;
    uint256 public constant BOND_LOCK_BPS = 1000; // 10%

    bytes32 public solverId;

    function setUp() public {
        // Fund accounts
        vm.deal(address(this), 10 ether);

        // Deploy IRSB core
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        registry.setAuthorizedCaller(address(hub), true);

        // Register solver with provider as operator
        solverId = registry.registerSolver("ipfs://solver-metadata", provider);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Deploy AgenticCommerce
        commerce = new AgenticCommerce();

        // Deploy IRSBHook
        hook = new IRSBHook(address(registry), address(hub), address(commerce), BOND_LOCK_BPS);

        // Configure: set hook on commerce, authorize hook on registry, trust hook on hub
        commerce.setHook(address(hook));
        registry.setAuthorizedCaller(address(hook), true);
        hub.setTrustedHook(address(hook), true);

        // Deploy token and fund client
        token = new MockERC20("Test Token", "TST", 18);
        token.mint(client, 1000e18);

        vm.prank(client);
        token.approve(address(commerce), type(uint256).max);
    }

    // Allow test contract to receive ETH
    receive() external payable { }

    // ============ Helpers ============

    function _createAndFundJob() internal returns (uint256 jobId) {
        vm.prank(client);
        jobId = commerce.createJob(
            address(token), PAYMENT_AMOUNT, keccak256("spec"), uint256(block.timestamp + 1 days), evaluator
        );

        vm.prank(client);
        commerce.fundJob(jobId);
    }

    // ============ Accept Job Tests ============

    function test_AcceptJobLocksBond() public {
        // Use a realistic scenario: payment = 1 token, lock = 10% = 0.1 token
        // But bond is in ETH... The lock amount must be <= bond balance
        // Deposit enough bond to cover the lock
        registry.depositBond{ value: 9.9 ether }(solverId); // 10 ETH total

        // Create job with payment that results in lockable amount
        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), 10e18, keccak256("spec"), uint256(block.timestamp + 1 days), evaluator
        );

        vm.prank(client);
        commerce.fundJob(jobId);

        Types.Solver memory solverBefore = registry.getSolver(solverId);

        vm.prank(provider);
        commerce.acceptJob(jobId);

        Types.Solver memory solverAfter = registry.getSolver(solverId);
        uint256 expectedLock = (10e18 * BOND_LOCK_BPS) / 10000; // 1e18

        assertEq(solverAfter.lockedBalance, solverBefore.lockedBalance + expectedLock);
        assertEq(hook.lockedAmounts(jobId), expectedLock);
    }

    function test_UnregisteredProviderBlocked() public {
        uint256 jobId = _createAndFundJob();

        vm.prank(unregistered);
        vm.expectRevert(abi.encodeWithSignature("UnregisteredProvider()"));
        commerce.acceptJob(jobId);
    }

    function test_InactiveSolverBlocked() public {
        // Create a solver that's registered but inactive (no bond)
        registry.registerSolver("ipfs://inactive", address(0x88));

        uint256 jobId = _createAndFundJob();

        vm.prank(address(0x88));
        vm.expectRevert(abi.encodeWithSignature("InactiveSolver()"));
        commerce.acceptJob(jobId);
    }

    // ============ Submit Result Tests ============

    function test_SubmitResultPostsReceipt() public {
        // Deposit enough bond
        registry.depositBond{ value: 9.9 ether }(solverId);

        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), 10e18, keccak256("spec"), uint256(block.timestamp + 1 days), evaluator
        );

        vm.prank(client);
        commerce.fundJob(jobId);

        vm.prank(provider);
        commerce.acceptJob(jobId);

        uint256 receiptsBefore = hub.totalReceipts();

        vm.prank(provider);
        commerce.submitResult(jobId, keccak256("result-data"));

        // Verify receipt was posted
        assertEq(hub.totalReceipts(), receiptsBefore + 1);

        // Verify receipt is stored in hook
        bytes32 receiptId = hook.jobReceipts(jobId);
        assertTrue(receiptId != bytes32(0));

        // Verify receipt data
        (Types.IntentReceipt memory receipt, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Pending));
        assertEq(receipt.solverId, solverId);
        assertEq(receipt.intentHash, keccak256(abi.encode(jobId, keccak256("spec"))));
    }

    // ============ Complete Job Tests ============

    function test_CompleteJobUnlocksBond() public {
        registry.depositBond{ value: 9.9 ether }(solverId);

        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), 10e18, keccak256("spec"), uint256(block.timestamp + 1 days), evaluator
        );

        vm.prank(client);
        commerce.fundJob(jobId);

        vm.prank(provider);
        commerce.acceptJob(jobId);

        vm.prank(provider);
        commerce.submitResult(jobId, keccak256("result"));

        Types.Solver memory solverBefore = registry.getSolver(solverId);
        uint256 lockAmount = hook.lockedAmounts(jobId);
        assertTrue(lockAmount > 0);

        vm.prank(evaluator);
        commerce.completeJob(jobId);

        Types.Solver memory solverAfter = registry.getSolver(solverId);
        assertEq(solverAfter.lockedBalance, solverBefore.lockedBalance - lockAmount);
        assertEq(hook.lockedAmounts(jobId), 0);
    }

    // ============ Reject Job Tests ============

    function test_RejectJobOpensDispute() public {
        registry.depositBond{ value: 9.9 ether }(solverId);

        vm.prank(client);
        uint256 jobId = commerce.createJob(
            address(token), 10e18, keccak256("spec"), uint256(block.timestamp + 1 days), evaluator
        );

        vm.prank(client);
        commerce.fundJob(jobId);

        vm.prank(provider);
        commerce.acceptJob(jobId);

        vm.prank(provider);
        commerce.submitResult(jobId, keccak256("result"));

        uint256 disputesBefore = hub.totalDisputes();
        bytes32 receiptId = hook.jobReceipts(jobId);
        assertTrue(receiptId != bytes32(0));

        vm.prank(evaluator);
        commerce.rejectJob(jobId, "Quality insufficient");

        // Verify dispute was opened
        assertEq(hub.totalDisputes(), disputesBefore + 1);

        // Verify receipt is now disputed
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Disputed));
    }
}
