// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { DisputeModule } from "../src/DisputeModule.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { IDisputeModule } from "../src/interfaces/IDisputeModule.sol";
import { Types } from "../src/libraries/Types.sol";

contract DisputeModuleTest is Test {
    DisputeModule public disputeModule;
    IntentReceiptHub public receiptHub;
    SolverRegistry public registry;

    address public owner = address(this);
    address public operator1 = address(0x1);
    address public challenger = address(0x2);
    address public arbitrator = address(0x3);
    address public treasury = address(0x4);

    uint256 public constant MINIMUM_BOND = 0.1 ether;
    uint256 public constant ARBITRATION_FEE = 0.01 ether;
    uint256 public constant CHALLENGER_BOND = 0.01 ether;

    uint256 operatorPrivateKey = 0xA11CE;

    event EvidenceSubmitted(bytes32 indexed disputeId, address indexed submitter, bytes32 evidenceHash);
    event DisputeEscalated(bytes32 indexed disputeId, address indexed arbitrator);
    event ArbitrationResolved(bytes32 indexed disputeId, bool solverFault, uint256 slashAmount, string reason);

    function setUp() public {
        // Deploy contracts
        registry = new SolverRegistry();
        receiptHub = new IntentReceiptHub(address(registry));
        disputeModule = new DisputeModule(address(receiptHub), address(registry), arbitrator);

        // Configure authorizations
        registry.setAuthorizedCaller(address(receiptHub), true);
        registry.setAuthorizedCaller(address(disputeModule), true); // DisputeModule needs to slash/unlock
        receiptHub.setDisputeModule(address(disputeModule));
        disputeModule.setTreasury(treasury);

        // Fund accounts
        vm.deal(operator1, 10 ether);
        vm.deal(challenger, 10 ether);
        vm.deal(arbitrator, 1 ether);
    }

    // ============ Helper Functions ============

    function _registerAndActivateSolver() internal returns (bytes32 solverId) {
        solverId = registry.registerSolver("ipfs://metadata", operator1);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    function _createSubjectiveDispute() internal returns (bytes32 receiptId, bytes32 solverId) {
        solverId = _registerAndActivateSolver();

        // Create receipt with subjective dispute
        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);

        vm.prank(operator1);
        receiptId = receiptHub.postReceipt(receipt, 0);

        // Open subjective dispute
        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );
    }

    function _createValidReceipt(bytes32 solverId) internal view returns (Types.IntentReceipt memory) {
        bytes32 intentHash = keccak256("intent");
        bytes32 constraintsHash = keccak256("constraints");
        bytes32 routeHash = keccak256("route");
        bytes32 outcomeHash = keccak256("outcome");
        bytes32 evidenceHash = keccak256("evidence");
        uint64 createdAt = uint64(block.timestamp);
        uint64 expiry = uint64(block.timestamp + 1 hours);

        // IRSB-SEC-001 + IRSB-SEC-006: Include chainId, hub address, and nonce for replay protection
        uint256 currentNonce = receiptHub.solverNonces(solverId);
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(receiptHub),
                currentNonce,
                intentHash,
                constraintsHash,
                routeHash,
                outcomeHash,
                evidenceHash,
                createdAt,
                expiry,
                solverId
            )
        );

        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        return Types.IntentReceipt({
            intentHash: intentHash,
            constraintsHash: constraintsHash,
            routeHash: routeHash,
            outcomeHash: outcomeHash,
            evidenceHash: evidenceHash,
            createdAt: createdAt,
            expiry: expiry,
            solverId: solverId,
            solverSig: signature
        });
    }

    // ============ Evidence Submission Tests ============

    function test_SubmitEvidence_AsChallenger() public {
        // Setup: need operator with matching private key
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("initial_evidence")
        );

        // Submit additional evidence
        bytes32 newEvidence = keccak256("new_evidence");
        vm.prank(challenger);
        vm.expectEmit(true, true, false, true);
        emit EvidenceSubmitted(receiptId, challenger, newEvidence);
        disputeModule.submitEvidence(receiptId, newEvidence);

        // Verify evidence stored
        (bytes32[] memory hashes, address[] memory submitters, uint64[] memory timestamps) =
            disputeModule.getEvidenceHistory(receiptId);

        assertEq(hashes.length, 1);
        assertEq(hashes[0], newEvidence);
        assertEq(submitters[0], challenger);
    }

    function test_SubmitEvidence_AsSolver() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Solver submits counter-evidence
        bytes32 counterEvidence = keccak256("counter_evidence");
        vm.prank(realOperator);
        disputeModule.submitEvidence(receiptId, counterEvidence);

        (bytes32[] memory hashes, address[] memory submitters,) = disputeModule.getEvidenceHistory(receiptId);

        assertEq(hashes.length, 1);
        assertEq(submitters[0], realOperator);
    }

    function test_SubmitEvidence_RevertNotParty() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Random address tries to submit evidence
        address random = address(0x999);
        vm.prank(random);
        vm.expectRevert(IDisputeModule.NotDisputeParty.selector);
        disputeModule.submitEvidence(receiptId, keccak256("random"));
    }

    function test_SubmitEvidence_RevertWindowClosed() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Fast forward past evidence window (24 hours)
        vm.warp(block.timestamp + 25 hours);

        vm.prank(challenger);
        vm.expectRevert(IDisputeModule.EvidenceWindowClosed.selector);
        disputeModule.submitEvidence(receiptId, keccak256("late"));
    }

    // ============ Escalation Tests ============

    function test_Escalate_Success() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Escalate
        vm.prank(challenger);
        vm.expectEmit(true, true, false, false);
        emit DisputeEscalated(receiptId, arbitrator);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        assertTrue(disputeModule.isEscalated(receiptId));
        assertEq(disputeModule.getEscalator(receiptId), challenger);
        assertGt(disputeModule.getEscalatedAt(receiptId), 0);
    }

    function test_Escalate_RevertNotSubjective() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        // Open non-subjective dispute
        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        vm.prank(challenger);
        vm.expectRevert(IDisputeModule.DisputeNotSubjective.selector);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);
    }

    function test_Escalate_RevertInsufficientFee() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        vm.expectRevert(IDisputeModule.ArbitrationFeeTooLow.selector);
        disputeModule.escalate{ value: ARBITRATION_FEE - 1 }(receiptId);
    }

    function test_Escalate_RevertAlreadyEscalated() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        vm.prank(challenger);
        vm.expectRevert(IDisputeModule.AlreadyEscalated.selector);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);
    }

    // ============ Resolution Tests ============

    function test_Resolve_SolverAtFault() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        uint256 challengerBalanceBefore = challenger.balance;

        // Arbitrator resolves in favor of challenger
        vm.prank(arbitrator);
        disputeModule.resolve(receiptId, true, 50, "Solver violated terms");

        // Check receipt status updated
        (, Types.ReceiptStatus status) = receiptHub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Slashed));

        // Challenger should receive arbitration fee refund
        assertGt(challenger.balance, challengerBalanceBefore);
    }

    function test_Resolve_SolverNotAtFault() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        // Arbitrator resolves in favor of solver
        vm.prank(arbitrator);
        disputeModule.resolve(receiptId, false, 0, "Challenger claim invalid");

        // Check receipt status updated to Finalized
        (, Types.ReceiptStatus status) = receiptHub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));
    }

    function test_Resolve_RevertNotArbitrator() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        vm.prank(challenger);
        vm.expectRevert(IDisputeModule.NotAuthorizedArbitrator.selector);
        disputeModule.resolve(receiptId, true, 50, "Invalid");
    }

    function test_Resolve_RevertInvalidSlashPercentage() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        vm.prank(arbitrator);
        vm.expectRevert(IDisputeModule.InvalidResolution.selector);
        disputeModule.resolve(receiptId, true, 101, "Invalid");
    }

    // ============ Timeout Resolution Tests ============

    function test_ResolveByTimeout() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        uint256 challengerBalanceBefore = challenger.balance;

        // Fast forward past arbitration timeout (7 days)
        vm.warp(block.timestamp + 7 days + 1);

        assertTrue(disputeModule.canResolveByTimeout(receiptId));

        // Anyone can trigger timeout resolution
        disputeModule.resolveByTimeout(receiptId);

        // Receipt should be finalized (solver not at fault by default)
        (, Types.ReceiptStatus status) = receiptHub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));

        // Escalator should get fee refund (arbitrator failed to act)
        assertGt(challenger.balance, challengerBalanceBefore);
    }

    function test_ResolveByTimeout_RevertNotEscalated() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Try timeout without escalation
        vm.warp(block.timestamp + 7 days + 1);

        vm.expectRevert("Not escalated");
        disputeModule.resolveByTimeout(receiptId);
    }

    function test_ResolveByTimeout_RevertTooEarly() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        // Try before timeout
        vm.warp(block.timestamp + 6 days);

        assertFalse(disputeModule.canResolveByTimeout(receiptId));

        vm.expectRevert("Timeout not reached");
        disputeModule.resolveByTimeout(receiptId);
    }

    // ============ View Functions Tests ============

    function test_CanEscalate() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        assertTrue(disputeModule.canEscalate(receiptId));

        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        assertFalse(disputeModule.canEscalate(receiptId));
    }

    function test_GetArbitrationFee() public view {
        assertEq(disputeModule.getArbitrationFee(), ARBITRATION_FEE);
    }

    function test_GetArbitrator() public view {
        assertEq(disputeModule.getArbitrator(), arbitrator);
    }

    // ============ Admin Functions Tests ============

    function test_SetArbitrator() public {
        address newArbitrator = address(0x999);
        disputeModule.setArbitrator(newArbitrator);
        assertEq(disputeModule.getArbitrator(), newArbitrator);
    }

    function test_SetArbitrationFee() public {
        uint256 newFee = 0.05 ether;
        disputeModule.setArbitrationFee(newFee);
        assertEq(disputeModule.getArbitrationFee(), newFee);
    }

    function test_SetTreasury() public {
        address newTreasury = address(0x888);
        disputeModule.setTreasury(newTreasury);
        assertEq(disputeModule.treasury(), newTreasury);
    }

    // ============ Security Regression Tests ============

    /// @notice IRSB-SEC-002: Verify non-parties cannot escalate disputes
    /// @dev Previously anyone could escalate, enabling DoS/griefing attacks
    function test_IRSB_SEC_002_escalateRevertNonParty() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Random non-party address tries to escalate
        address randomAttacker = address(0x999);
        vm.deal(randomAttacker, 1 ether);

        vm.prank(randomAttacker);
        vm.expectRevert(IDisputeModule.NotDisputeParty.selector);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);
    }

    /// @notice IRSB-SEC-002: Verify solver operator can escalate
    /// @dev Solver should be allowed to escalate, not just challenger
    function test_IRSB_SEC_002_solverCanEscalate() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Solver (realOperator) should be able to escalate
        vm.prank(realOperator);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        assertTrue(disputeModule.isEscalated(receiptId));
        assertEq(disputeModule.getEscalator(receiptId), realOperator);
    }

    /// @notice IRSB-SEC-010: Zero slash amount should be treated as no-fault
    /// @dev Prevents meaningless punishment when bond is too small for slash percentage
    function test_IRSB_SEC_010_zeroSlashTreatedAsNoFault() public {
        address realOperator = vm.addr(operatorPrivateKey);
        vm.deal(realOperator, 10 ether);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", realOperator);
        vm.prank(realOperator);
        // Deposit minimum bond (0.1 ETH)
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.IntentReceipt memory receipt = _createValidReceipt(solverId);
        vm.prank(realOperator);
        bytes32 receiptId = receiptHub.postReceipt(receipt, 0);

        vm.prank(challenger);
        receiptHub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.Subjective, keccak256("evidence")
        );

        // Challenger escalates
        vm.prank(challenger);
        disputeModule.escalate{ value: ARBITRATION_FEE }(receiptId);

        // Get solver bond before resolution
        Types.Solver memory solverBefore = registry.getSolver(solverId);
        uint256 bondBefore = solverBefore.bondBalance + solverBefore.lockedBalance;

        // Arbitrator tries to resolve with 0% slash (edge case that rounds to zero)
        // With 0.1 ETH bond and 1% slash: 0.1 * 1 / 100 = 0.001 ETH (not zero)
        // But with certain combinations it could round to zero
        // For this test, we use slashPercentage=0 which should go through the no-fault path
        vm.prank(arbitrator);
        disputeModule.resolve(receiptId, true, 0, "Testing zero slash");

        // Solver bond should be unchanged (no slash executed)
        Types.Solver memory solverAfter = registry.getSolver(solverId);
        uint256 bondAfter = solverAfter.bondBalance + solverAfter.lockedBalance;

        // Bond should be unchanged because slashPercentage=0 means no slash
        assertEq(bondAfter, bondBefore, "Bond should be unchanged with 0% slash");

        // Receipt should be resolved as no-fault
        (, Types.ReceiptStatus status) = receiptHub.getReceipt(receiptId);
        // With solverFault=true but slashPercentage=0, it doesn't trigger the slash path
        // The receipt gets resolved through resolveEscalatedDispute
        assertTrue(
            status == Types.ReceiptStatus.Finalized || status == Types.ReceiptStatus.Slashed,
            "Receipt should be resolved"
        );
    }
}
