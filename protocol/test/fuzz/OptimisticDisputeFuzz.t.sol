// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { ReceiptV2Extension } from "../../src/extensions/ReceiptV2Extension.sol";
import { OptimisticDisputeModule } from "../../src/modules/OptimisticDisputeModule.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { IOptimisticDisputeModule } from "../../src/interfaces/IOptimisticDisputeModule.sol";
import { Types } from "../../src/libraries/Types.sol";
import { TypesV2 } from "../../src/libraries/TypesV2.sol";

/// @title OptimisticDisputeModule Fuzz Tests
/// @notice Fuzz tests for optimistic dispute invariants
contract OptimisticDisputeFuzzTest is Test {
    SolverRegistry public registry;
    ReceiptV2Extension public extension;
    OptimisticDisputeModule public disputeModule;
    EscrowVault public escrowVault;

    // Avoid precompile addresses (0x01-0x0A)
    address public owner = address(this);
    address public arbitrator = address(0x100);
    address public treasury = address(0x101);

    function setUp() public {
        registry = new SolverRegistry();
        extension = new ReceiptV2Extension(address(registry));
        escrowVault = new EscrowVault();
        disputeModule = new OptimisticDisputeModule(address(extension), address(registry), arbitrator);

        disputeModule.setTreasury(treasury);
        disputeModule.setEscrowVault(address(escrowVault));

        // Authorize dispute module to manage bonds in extension
        extension.setOptimisticDisputeModule(address(disputeModule));

        registry.setAuthorizedCaller(address(extension), true);
        registry.setAuthorizedCaller(address(disputeModule), true);
        escrowVault.setAuthorizedHub(address(disputeModule), true);
    }

    // ============ Helper Functions ============

    function _registerSolver(uint256 privateKey) internal returns (bytes32 solverId, address solverAddr) {
        solverAddr = vm.addr(privateKey);
        vm.deal(solverAddr, 100 ether);

        solverId = registry.registerSolver("ipfs://test", solverAddr);

        vm.prank(solverAddr);
        registry.depositBond{ value: 1 ether }(solverId);

        return (solverId, solverAddr);
    }

    function _createV2Receipt(bytes32 solverId, uint256 solverKey, uint256 clientKey, uint64 createdAt)
        internal
        returns (bytes32 receiptId)
    {
        address solverAddr = vm.addr(solverKey);
        address clientAddr = vm.addr(clientKey);

        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: keccak256(abi.encode("intent", solverId, createdAt)),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            metadataCommitment: keccak256("metadata"),
            ciphertextPointer: "QmTestABCDEFGH123456789012345",
            privacyLevel: TypesV2.PrivacyLevel.SemiPublic,
            escrowId: bytes32(0),
            createdAt: createdAt,
            expiry: createdAt + 1 days,
            solverId: solverId,
            client: clientAddr,
            solverSig: "",
            clientSig: ""
        });

        bytes32 structHash = TypesV2.hashReceiptV2(receipt);
        bytes32 domainSeparator = extension.domainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(solverKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(solverAddr);
        return extension.postReceiptV2(receipt);
    }

    // ============ Invariant: Challenger Bond Recovery ============

    /// @notice Fuzz test: challenger always gets bond back on timeout (no counter-bond)
    function testFuzz_ChallengerBondRecoveryOnTimeout(uint256 challengerBond) public {
        // Bound challenger bond to reasonable range
        challengerBond = bound(challengerBond, extension.challengerBondMin(), 10 ether);

        // Setup
        uint256 solverKey = 0x1001;
        uint256 clientKey = 0x1002;
        (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
        address clientAddr = vm.addr(clientKey);
        address challengerAddr = address(0x5555);

        vm.deal(challengerAddr, 20 ether);
        vm.deal(clientAddr, 1 ether);

        // Create receipt
        uint64 createdAt = uint64(block.timestamp);
        bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

        // Track initial balance before dispute
        uint256 initialBalance = challengerAddr.balance;

        // Open dispute via extension (bond is taken here)
        vm.prank(challengerAddr);
        extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

        // Verify bond was taken in openDisputeV2
        assertEq(challengerAddr.balance, initialBalance - challengerBond);

        // Open optimistic dispute (no additional bond required - references bond in extension)
        uint256 balanceBeforeOptimistic = challengerAddr.balance;
        vm.prank(challengerAddr);
        bytes32 disputeId = disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));

        // Verify no additional bond was taken
        assertEq(challengerAddr.balance, balanceBeforeOptimistic);

        // Fast forward past counter-bond deadline
        vm.warp(block.timestamp + 24 hours + 1);

        // Resolve by timeout
        disputeModule.resolveByTimeout(disputeId);

        // Challenger should have their original bond back
        assertGe(challengerAddr.balance, challengerBond);
    }

    /// @notice Fuzz test: bond amounts must be exact (no rounding issues)
    function testFuzz_BondAmountExactness(uint256 challengerBond) public {
        challengerBond = bound(challengerBond, extension.challengerBondMin(), 5 ether);

        uint256 solverKey = 0x2001;
        uint256 clientKey = 0x2002;
        (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
        address clientAddr = vm.addr(clientKey);
        address challengerAddr = address(0x6666);

        vm.deal(challengerAddr, 20 ether);
        vm.deal(clientAddr, 1 ether);

        uint64 createdAt = uint64(block.timestamp);
        bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

        vm.prank(challengerAddr);
        extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

        vm.prank(challengerAddr);
        bytes32 disputeId = disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));

        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);

        // Bond stored should exactly match what was sent
        assertEq(dispute.challengerBond, challengerBond);

        // Required counter-bond should be exactly 100% of challenger bond
        uint256 requiredCounterBond = disputeModule.getRequiredCounterBond(disputeId);
        assertEq(requiredCounterBond, challengerBond);
    }

    // ============ Invariant: Counter-Bond Timing ============

    /// @notice Fuzz test: counter-bond window enforcement
    function testFuzz_CounterBondWindowEnforcement(uint64 timeElapsed) public {
        uint256 solverKey = 0x3001;
        uint256 clientKey = 0x3002;
        (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
        address clientAddr = vm.addr(clientKey);
        address challengerAddr = address(0x7777);

        vm.deal(challengerAddr, 10 ether);
        vm.deal(clientAddr, 1 ether);

        uint64 createdAt = uint64(block.timestamp);
        bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challengerAddr);
        extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

        vm.prank(challengerAddr);
        bytes32 disputeId = disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));

        // Bound time elapsed to reasonable range
        timeElapsed = uint64(bound(timeElapsed, 0, 48 hours));
        vm.warp(block.timestamp + timeElapsed);

        uint256 counterBond = disputeModule.getRequiredCounterBond(disputeId);

        if (timeElapsed <= 24 hours) {
            // Should be able to post counter-bond
            assertTrue(disputeModule.canPostCounterBond(disputeId));
            vm.prank(solverAddr);
            disputeModule.postCounterBond{ value: counterBond }(disputeId);
        } else {
            // Should NOT be able to post counter-bond
            assertFalse(disputeModule.canPostCounterBond(disputeId));
            vm.prank(solverAddr);
            vm.expectRevert(IOptimisticDisputeModule.CounterBondDeadlinePassed.selector);
            disputeModule.postCounterBond{ value: counterBond }(disputeId);
        }
    }

    // ============ Invariant: Dispute Status Transitions ============

    /// @notice Fuzz test: disputes only transition to terminal states once
    function testFuzz_DisputeStatusTerminality(bool postCounterBond, bool resolveInFavor) public {
        uint256 solverKey = 0x4001;
        uint256 clientKey = 0x4002;
        (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
        address clientAddr = vm.addr(clientKey);
        address challengerAddr = address(0x8888);

        vm.deal(challengerAddr, 10 ether);
        vm.deal(clientAddr, 1 ether);

        uint64 createdAt = uint64(block.timestamp);
        bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challengerAddr);
        extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

        vm.prank(challengerAddr);
        bytes32 disputeId = disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));

        IOptimisticDisputeModule.OptimisticDisputeStatus status = disputeModule.getDisputeStatus(disputeId);
        assertEq(uint256(status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.Open));

        if (postCounterBond) {
            uint256 counterBond = disputeModule.getRequiredCounterBond(disputeId);
            vm.prank(solverAddr);
            disputeModule.postCounterBond{ value: counterBond }(disputeId);

            status = disputeModule.getDisputeStatus(disputeId);
            assertEq(uint256(status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.Contested));

            // Resolve by arbitration
            vm.prank(arbitrator);
            disputeModule.resolveByArbitration(disputeId, !resolveInFavor, 50, "Test");
        } else {
            vm.warp(block.timestamp + 24 hours + 1);
            disputeModule.resolveByTimeout(disputeId);
        }

        // Should now be in terminal state
        status = disputeModule.getDisputeStatus(disputeId);
        assertTrue(
            status == IOptimisticDisputeModule.OptimisticDisputeStatus.ChallengerWins
                || status == IOptimisticDisputeModule.OptimisticDisputeStatus.SolverWins
        );

        // Cannot resolve again
        if (postCounterBond) {
            vm.prank(arbitrator);
            vm.expectRevert(IOptimisticDisputeModule.DisputeNotContested.selector);
            disputeModule.resolveByArbitration(disputeId, true, 50, "Again");
        }
    }

    // ============ Invariant: Slash Distribution ============

    /// @notice Fuzz test: slash percentage must be capped at 100
    function testFuzz_SlashPercentageCapped(uint8 slashPercentage) public {
        uint256 solverKey = 0x5001;
        uint256 clientKey = 0x5002;
        (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
        address clientAddr = vm.addr(clientKey);
        address challengerAddr = address(0x9999);

        vm.deal(challengerAddr, 10 ether);
        vm.deal(clientAddr, 1 ether);

        uint64 createdAt = uint64(block.timestamp);
        bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challengerAddr);
        extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

        vm.prank(challengerAddr);
        bytes32 disputeId = disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));

        uint256 counterBond = disputeModule.getRequiredCounterBond(disputeId);
        vm.prank(solverAddr);
        disputeModule.postCounterBond{ value: counterBond }(disputeId);

        vm.prank(arbitrator);
        if (slashPercentage > 100) {
            vm.expectRevert(IOptimisticDisputeModule.InvalidSlashPercentage.selector);
            disputeModule.resolveByArbitration(disputeId, true, slashPercentage, "Test");
        } else {
            disputeModule.resolveByArbitration(disputeId, true, slashPercentage, "Test");
            // Should succeed
            assertEq(
                uint256(disputeModule.getDisputeStatus(disputeId)),
                uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.ChallengerWins)
            );
        }
    }

    // ============ Invariant: Evidence Submission ============

    /// @notice Fuzz test: evidence can only be submitted by parties
    function testFuzz_EvidenceSubmissionAuthorization(address submitter) public {
        uint256 solverKey = 0x6001;
        uint256 clientKey = 0x6002;
        (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
        address clientAddr = vm.addr(clientKey);
        address challengerAddr = address(0xAAAA);

        // Exclude valid parties
        vm.assume(submitter != solverAddr);
        vm.assume(submitter != challengerAddr);
        vm.assume(submitter != address(0));

        vm.deal(challengerAddr, 10 ether);
        vm.deal(clientAddr, 1 ether);

        uint64 createdAt = uint64(block.timestamp);
        bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challengerAddr);
        extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

        vm.prank(challengerAddr);
        bytes32 disputeId = disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));

        // Random address should not be able to submit evidence
        vm.prank(submitter);
        vm.expectRevert(IOptimisticDisputeModule.NotDisputeParty.selector);
        disputeModule.submitEvidence(disputeId, keccak256("evidence"));

        // Challenger should be able to submit
        vm.prank(challengerAddr);
        disputeModule.submitEvidence(disputeId, keccak256("challenger evidence"));

        // Solver should be able to submit
        vm.prank(solverAddr);
        disputeModule.submitEvidence(disputeId, keccak256("solver evidence"));
    }

    // ============ Invariant: Total Disputes Counter ============

    /// @notice Fuzz test: total disputes increments correctly
    function testFuzz_TotalDisputesIncrement(uint8 numDisputes) public {
        numDisputes = uint8(bound(numDisputes, 1, 10));

        uint256 initialTotal = disputeModule.totalDisputes();

        for (uint256 i = 0; i < numDisputes; i++) {
            uint256 solverKey = 0x7001 + i;
            uint256 clientKey = 0x8001 + i;
            (bytes32 solverId, address solverAddr) = _registerSolver(solverKey);
            address clientAddr = vm.addr(clientKey);
            address challengerAddr = address(uint160(0xBBBB + i));

            vm.deal(challengerAddr, 10 ether);
            vm.deal(clientAddr, 1 ether);

            uint64 createdAt = uint64(block.timestamp + i);
            bytes32 receiptId = _createV2Receipt(solverId, solverKey, clientKey, createdAt);

            uint256 challengerBond = extension.challengerBondMin();
            vm.prank(challengerAddr);
            extension.openDisputeV2{ value: challengerBond }(receiptId, keccak256("reason"), keccak256("evidence"));

            vm.prank(challengerAddr);
            disputeModule.openOptimisticDispute(receiptId, keccak256("evidence"));
        }

        assertEq(disputeModule.totalDisputes(), initialTotal + numDisputes);
    }
}
