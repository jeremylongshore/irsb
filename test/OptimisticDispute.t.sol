// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { ReceiptV2Extension } from "../src/extensions/ReceiptV2Extension.sol";
import { OptimisticDisputeModule } from "../src/modules/OptimisticDisputeModule.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { IOptimisticDisputeModule } from "../src/interfaces/IOptimisticDisputeModule.sol";
import { Types } from "../src/libraries/Types.sol";
import { TypesV2 } from "../src/libraries/TypesV2.sol";

/// @title OptimisticDisputeModule Tests
/// @notice Tests for optimistic dispute resolution with counter-bond mechanism
contract OptimisticDisputeTest is Test {
    SolverRegistry public registry;
    ReceiptV2Extension public extension;
    OptimisticDisputeModule public disputeModule;
    EscrowVault public escrowVault;

    // Test accounts (avoid precompile addresses 0x01-0x0A)
    address public owner = address(this);
    address public arbitrator = address(0x100);
    address public treasury = address(0x101);
    uint256 public solverKey = 0x1;
    address public solver = vm.addr(solverKey);
    uint256 public clientKey = 0x2;
    address public client = vm.addr(clientKey);
    address public challenger = address(0x105);

    bytes32 public solverId;
    bytes32 public receiptId;

    // Events to test
    event OptimisticDisputeOpened(
        bytes32 indexed disputeId,
        bytes32 indexed receiptId,
        bytes32 indexed solverId,
        address challenger,
        uint256 challengerBond,
        uint64 counterBondDeadline
    );
    event CounterBondPosted(
        bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, uint256 counterBond
    );
    event ResolvedByTimeout(
        bytes32 indexed disputeId, bytes32 indexed receiptId, bytes32 indexed solverId, address challenger
    );
    event ResolvedByArbitration(
        bytes32 indexed disputeId, bytes32 indexed receiptId, bool solverFault, uint256 slashAmount, string reason
    );

    function setUp() public {
        // Deploy registry
        registry = new SolverRegistry();

        // Deploy extension
        extension = new ReceiptV2Extension(address(registry));

        // Deploy escrow vault
        escrowVault = new EscrowVault();

        // Deploy optimistic dispute module
        disputeModule = new OptimisticDisputeModule(address(extension), address(registry), arbitrator);
        disputeModule.setTreasury(treasury);
        disputeModule.setEscrowVault(address(escrowVault));

        // Authorize dispute module to manage bonds in extension
        extension.setOptimisticDisputeModule(address(disputeModule));

        // Authorize extension to interact with registry
        registry.setAuthorizedCaller(address(extension), true);
        registry.setAuthorizedCaller(address(disputeModule), true);

        // Authorize dispute module as hub in escrow vault
        escrowVault.setAuthorizedHub(address(disputeModule), true);

        // Register solver
        solverId = registry.registerSolver("ipfs://solver-metadata", solver);

        // Deposit bond
        vm.deal(solver, 10 ether);
        vm.prank(solver);
        registry.depositBond{ value: 1 ether }(solverId);

        // Fund accounts
        vm.deal(challenger, 10 ether);
        vm.deal(client, 10 ether);
    }

    // ============ Helper Functions ============

    function _createV2Receipt() internal returns (bytes32) {
        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            metadataCommitment: keccak256("metadata"),
            ciphertextPointer: "QmTestABCDEFGH123456789012345",
            privacyLevel: TypesV2.PrivacyLevel.SemiPublic,
            escrowId: bytes32(0),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 days),
            solverId: solverId,
            client: client,
            solverSig: "",
            clientSig: ""
        });

        // Sign with EIP-712
        bytes32 structHash = TypesV2.hashReceiptV2(receipt);
        bytes32 domainSeparator = extension.domainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(solverKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(solver);
        return extension.postReceiptV2(receipt);
    }

    function _createDisputedReceipt() internal returns (bytes32 _receiptId, bytes32 _disputeId) {
        _receiptId = _createV2Receipt();

        // Open dispute via extension first (which sets status to Disputed)
        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challenger);
        extension.openDisputeV2{ value: challengerBond }(_receiptId, keccak256("reason"), keccak256("evidence"));

        // Then open optimistic dispute
        vm.prank(challenger);
        _disputeId = disputeModule.openOptimisticDispute(_receiptId, keccak256("evidence"));
    }

    // ============ Open Dispute Tests ============

    function test_OpenOptimisticDispute() public {
        bytes32 _receiptId = _createV2Receipt();

        // First open dispute via extension
        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challenger);
        extension.openDisputeV2{ value: challengerBond }(_receiptId, keccak256("reason"), keccak256("evidence"));

        // Then open optimistic dispute
        vm.prank(challenger);
        bytes32 disputeId = disputeModule.openOptimisticDispute(_receiptId, keccak256("evidence"));

        // Verify dispute state
        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        assertEq(dispute.receiptId, _receiptId);
        assertEq(dispute.solverId, solverId);
        assertEq(dispute.challenger, challenger);
        assertEq(dispute.challengerBond, challengerBond);
        assertEq(dispute.counterBond, 0);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.Open));
    }

    function test_OpenOptimisticDispute_EmitsEvent() public {
        bytes32 _receiptId = _createV2Receipt();
        uint256 challengerBond = extension.challengerBondMin();

        vm.prank(challenger);
        extension.openDisputeV2{ value: challengerBond }(_receiptId, keccak256("reason"), keccak256("evidence"));

        vm.expectEmit(false, true, true, false); // Don't check disputeId (generated)
        emit OptimisticDisputeOpened(
            bytes32(0), // disputeId - not checking
            _receiptId,
            solverId,
            challenger,
            challengerBond,
            uint64(block.timestamp + 24 hours)
        );

        vm.prank(challenger);
        disputeModule.openOptimisticDispute(_receiptId, keccak256("evidence"));
    }

    function test_OpenOptimisticDispute_RevertNotDisputed() public {
        bytes32 _receiptId = _createV2Receipt();
        uint256 challengerBond = extension.challengerBondMin();

        // Try to open optimistic dispute without first opening via extension
        vm.prank(challenger);
        vm.expectRevert(IOptimisticDisputeModule.ReceiptNotDisputed.selector);
        disputeModule.openOptimisticDispute(_receiptId, keccak256("evidence"));
    }

    // ============ Counter-Bond Tests ============

    function test_PostCounterBond() public {
        (bytes32 _receiptId, bytes32 disputeId) = _createDisputedReceipt();

        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        uint256 requiredBond = dispute.challengerBond; // 100% of challenger bond

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Verify state changed to Contested
        dispute = disputeModule.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.Contested));
        assertEq(dispute.counterBond, requiredBond);
        assertTrue(dispute.arbitrationDeadline > 0);
    }

    function test_PostCounterBond_EmitsEvent() public {
        (bytes32 _receiptId, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.expectEmit(true, true, true, true);
        emit CounterBondPosted(disputeId, _receiptId, solverId, requiredBond);

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);
    }

    function test_PostCounterBond_RevertInsufficientAmount() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(solver);
        vm.expectRevert(IOptimisticDisputeModule.InsufficientCounterBond.selector);
        disputeModule.postCounterBond{ value: requiredBond - 1 }(disputeId);
    }

    function test_PostCounterBond_RevertDeadlinePassed() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Fast forward past counter-bond deadline
        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(solver);
        vm.expectRevert(IOptimisticDisputeModule.CounterBondDeadlinePassed.selector);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);
    }

    function test_PostCounterBond_RevertNotSolverOperator() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(challenger); // Wrong caller
        vm.expectRevert(IOptimisticDisputeModule.UnauthorizedCaller.selector);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);
    }

    function test_PostCounterBond_RevertAlreadyPosted() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Try to post again
        vm.prank(solver);
        vm.expectRevert(IOptimisticDisputeModule.CounterBondAlreadyPosted.selector);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);
    }

    // ============ Resolve by Timeout Tests ============

    function test_ResolveByTimeout_NoCounterBond() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        uint256 challengerBalanceBefore = challenger.balance;

        // Fast forward past counter-bond deadline
        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(address(0x999)); // Anyone can call
        disputeModule.resolveByTimeout(disputeId);

        // Verify challenger wins
        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.ChallengerWins));

        // Verify challenger got bond back
        assertTrue(challenger.balance > challengerBalanceBefore);
    }

    function test_ResolveByTimeout_EmitsEvent() public {
        (bytes32 _receiptId, bytes32 disputeId) = _createDisputedReceipt();

        vm.warp(block.timestamp + 24 hours + 1);

        vm.expectEmit(true, true, true, true);
        emit ResolvedByTimeout(disputeId, _receiptId, solverId, challenger);

        disputeModule.resolveByTimeout(disputeId);
    }

    function test_ResolveByTimeout_RevertBeforeDeadline() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        // Don't fast forward - deadline not reached
        vm.expectRevert(IOptimisticDisputeModule.CounterBondDeadlineNotReached.selector);
        disputeModule.resolveByTimeout(disputeId);
    }

    function test_ResolveByTimeout_RevertIfContested() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        vm.warp(block.timestamp + 24 hours + 1);

        // This is now contested, so resolveByTimeout should fail
        vm.expectRevert(IOptimisticDisputeModule.InvalidDisputeStatus.selector);
        disputeModule.resolveByTimeout(disputeId);
    }

    // ============ Resolve by Arbitration Tests ============

    function test_ResolveByArbitration_ChallengerWins() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        uint256 challengerBalanceBefore = challenger.balance;

        // Arbitrator resolves in favor of challenger
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, true, 50, "Service not delivered");

        // Verify challenger wins
        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.ChallengerWins));

        // Challenger should get their bond + solver's counter-bond
        assertTrue(challenger.balance > challengerBalanceBefore + requiredBond);
    }

    function test_ResolveByArbitration_SolverWins() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        uint256 solverBalanceBefore = solver.balance;

        // Arbitrator resolves in favor of solver
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, false, 0, "Challenger claim invalid");

        // Verify solver wins
        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.SolverWins));

        // Challenger's forfeited bond is sent directly via transferChallengerBondTo
        assertTrue(solver.balance > solverBalanceBefore);

        // Solver's counter-bond is in pendingWithdrawals (pull pattern - PM-SC-023)
        assertEq(disputeModule.pendingWithdrawals(solver), requiredBond);
    }

    function test_ResolveByArbitration_RevertNotArbitrator() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        vm.prank(challenger); // Not arbitrator
        vm.expectRevert(IOptimisticDisputeModule.NotAuthorizedArbitrator.selector);
        disputeModule.resolveByArbitration(disputeId, true, 50, "Test");
    }

    function test_ResolveByArbitration_RevertNotContested() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        // Don't post counter-bond - dispute is still Open
        vm.prank(arbitrator);
        vm.expectRevert(IOptimisticDisputeModule.DisputeNotContested.selector);
        disputeModule.resolveByArbitration(disputeId, true, 50, "Test");
    }

    function test_ResolveByArbitration_RevertInvalidSlashPercentage() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        vm.prank(arbitrator);
        vm.expectRevert(IOptimisticDisputeModule.InvalidSlashPercentage.selector);
        disputeModule.resolveByArbitration(disputeId, true, 101, "Test"); // > 100%
    }

    // ============ Contested Timeout Tests ============

    function test_ResolveContestedByTimeout() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        uint256 challengerBalanceBefore = challenger.balance;

        // Fast forward past arbitration timeout (7 days)
        vm.warp(block.timestamp + 7 days + 1);

        // Anyone can resolve
        disputeModule.resolveContestedByTimeout(disputeId);

        // Challenger wins by default (arbitrator failed to act)
        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.ChallengerWins));

        // Challenger gets both bonds
        assertTrue(challenger.balance > challengerBalanceBefore + requiredBond);
    }

    function test_ResolveContestedByTimeout_RevertBeforeDeadline() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Only fast forward 1 day (need 7 days)
        vm.warp(block.timestamp + 1 days);

        vm.expectRevert(IOptimisticDisputeModule.ArbitrationDeadlineNotReached.selector);
        disputeModule.resolveContestedByTimeout(disputeId);
    }

    // ============ Evidence Tests ============

    function test_SubmitEvidence() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        bytes32 evidenceHash = keccak256("more evidence");

        vm.prank(challenger);
        disputeModule.submitEvidence(disputeId, evidenceHash);

        // Verify evidence stored
        (bytes32[] memory hashes, address[] memory submitters,) = disputeModule.getEvidenceHistory(disputeId);
        assertEq(hashes.length, 2); // Initial + new
        assertEq(hashes[1], evidenceHash);
        assertEq(submitters[1], challenger);
    }

    function test_SubmitEvidence_BothParties() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Both parties submit evidence
        vm.prank(challenger);
        disputeModule.submitEvidence(disputeId, keccak256("challenger evidence"));

        vm.prank(solver);
        disputeModule.submitEvidence(disputeId, keccak256("solver evidence"));

        (bytes32[] memory hashes,,) = disputeModule.getEvidenceHistory(disputeId);
        assertEq(hashes.length, 3); // Initial + 2 new
    }

    function test_SubmitEvidence_RevertNotParty() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        vm.prank(address(0x999)); // Random address
        vm.expectRevert(IOptimisticDisputeModule.NotDisputeParty.selector);
        disputeModule.submitEvidence(disputeId, keccak256("evidence"));
    }

    function test_SubmitEvidence_RevertWindowClosed() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Fast forward past evidence window (48 hours)
        vm.warp(block.timestamp + 48 hours + 1);

        vm.prank(challenger);
        vm.expectRevert(IOptimisticDisputeModule.EvidenceWindowClosed.selector);
        disputeModule.submitEvidence(disputeId, keccak256("late evidence"));
    }

    // ============ View Function Tests ============

    function test_CanPostCounterBond() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        assertTrue(disputeModule.canPostCounterBond(disputeId));

        // After deadline
        vm.warp(block.timestamp + 24 hours + 1);
        assertFalse(disputeModule.canPostCounterBond(disputeId));
    }

    function test_CanResolveByTimeout() public {
        (, bytes32 disputeId) = _createDisputedReceipt();

        // Before deadline
        assertFalse(disputeModule.canResolveByTimeout(disputeId));

        // After deadline
        vm.warp(block.timestamp + 24 hours + 1);
        assertTrue(disputeModule.canResolveByTimeout(disputeId));
    }

    function test_GetDisputeByReceipt() public {
        (bytes32 _receiptId, bytes32 disputeId) = _createDisputedReceipt();

        bytes32 foundDispute = disputeModule.getDisputeByReceipt(_receiptId);
        assertEq(foundDispute, disputeId);
    }

    // ============ Admin Tests ============

    function test_SetArbitrator() public {
        address newArbitrator = address(0xABC);
        disputeModule.setArbitrator(newArbitrator);
        assertEq(disputeModule.getArbitrator(), newArbitrator);
    }

    function test_SetTreasury() public {
        address newTreasury = address(0xDEF);
        disputeModule.setTreasury(newTreasury);
        assertEq(disputeModule.treasury(), newTreasury);
    }

    function test_PauseUnpause() public {
        disputeModule.pause();

        bytes32 _receiptId = _createV2Receipt();
        uint256 challengerBond = extension.challengerBondMin();
        vm.prank(challenger);
        extension.openDisputeV2{ value: challengerBond }(_receiptId, keccak256("reason"), keccak256("evidence"));

        vm.prank(challenger);
        vm.expectRevert();
        disputeModule.openOptimisticDispute(_receiptId, keccak256("evidence"));

        disputeModule.unpause();

        vm.prank(challenger);
        disputeModule.openOptimisticDispute(_receiptId, keccak256("evidence"));
    }

    // ============ Constants Tests ============

    function test_GetCounterBondWindow() public view {
        assertEq(disputeModule.getCounterBondWindow(), 24 hours);
    }

    function test_GetArbitrationTimeout() public view {
        assertEq(disputeModule.getArbitrationTimeout(), 7 days);
    }

    function test_GetEvidenceWindow() public view {
        assertEq(disputeModule.getEvidenceWindow(), 48 hours);
    }

    // ============ Change 3: Arbitrator Flat Fee & Slash Distribution Tests ============

    function test_ResolveByArbitration_ArbitratorGetsFlatFee() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Fund the dispute module with 1 ETH so it can pay the flat fee
        vm.deal(address(disputeModule), 1 ether);

        // Arbitrator resolves in favor of challenger
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, true, 50, "Service not delivered");

        // Arbitrator should have the default flat fee (0.005 ether) in pending withdrawals
        assertEq(disputeModule.pendingWithdrawals(arbitrator), 0.005 ether);
    }

    function test_ResolveByArbitration_SlashDistribution_75_25() public {
        // Verify the slash distribution constants: 75% user / 25% treasury
        assertEq(disputeModule.SLASH_USER_BPS(), 7500);
        assertEq(disputeModule.SLASH_TREASURY_BPS(), 2500);

        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Arbitrator resolves with solver fault, 50% slash
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, true, 50, "Solver at fault");

        // Verify dispute resolved as ChallengerWins
        IOptimisticDisputeModule.OptimisticDispute memory dispute = disputeModule.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IOptimisticDisputeModule.OptimisticDisputeStatus.ChallengerWins));
    }

    function test_SetArbitrationFlatFee_OnlyOwner() public {
        // Owner can set the fee
        disputeModule.setArbitrationFlatFee(0.01 ether);
        assertEq(disputeModule.arbitrationFlatFee(), 0.01 ether);

        // Non-owner should revert
        vm.prank(challenger);
        vm.expectRevert();
        disputeModule.setArbitrationFlatFee(0.01 ether);
    }

    function test_SetArbitrationFlatFee_Updates() public {
        disputeModule.setArbitrationFlatFee(0.01 ether);
        assertEq(disputeModule.arbitrationFlatFee(), 0.01 ether);
    }

    // ============ Change 4: Pull Pattern Withdrawal Tests ============

    function test_WithdrawPending_AfterResolution() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Arbitrator resolves in favor of solver (solver wins)
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, false, 0, "Challenger claim invalid");

        // Solver's counter-bond should be in pendingWithdrawals
        assertGt(disputeModule.pendingWithdrawals(solver), 0);

        uint256 solverBalanceBefore = solver.balance;

        // Solver withdraws pending balance
        vm.prank(solver);
        disputeModule.withdrawPending();

        // Pending balance should be zero after withdrawal
        assertEq(disputeModule.pendingWithdrawals(solver), 0);

        // Solver balance should have increased
        assertGt(solver.balance, solverBalanceBefore);
    }

    function test_WithdrawPending_DoubleWithdrawReverts() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Arbitrator resolves in favor of solver (solver wins)
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, false, 0, "Challenger claim invalid");

        // First withdrawal should succeed
        vm.prank(solver);
        disputeModule.withdrawPending();

        // Second withdrawal should revert (amount is 0)
        vm.prank(solver);
        vm.expectRevert(IOptimisticDisputeModule.TransferFailed.selector);
        disputeModule.withdrawPending();
    }

    function test_PendingWithdrawals_ArbitratorCanClaim() public {
        (, bytes32 disputeId) = _createDisputedReceipt();
        uint256 requiredBond = disputeModule.getRequiredCounterBond(disputeId);

        // Solver posts counter-bond
        vm.prank(solver);
        disputeModule.postCounterBond{ value: requiredBond }(disputeId);

        // Fund the dispute module with 1 ETH so it can pay the flat fee
        vm.deal(address(disputeModule), 1 ether);

        uint256 arbitratorBalanceBefore = arbitrator.balance;

        // Arbitrator resolves the dispute (challenger wins)
        vm.prank(arbitrator);
        disputeModule.resolveByArbitration(disputeId, true, 50, "Service not delivered");

        // Arbitrator should have pending balance (the flat fee)
        uint256 pendingAmount = disputeModule.pendingWithdrawals(arbitrator);
        assertEq(pendingAmount, 0.005 ether);

        // Arbitrator withdraws
        vm.prank(arbitrator);
        disputeModule.withdrawPending();

        // Verify arbitrator received the flat fee
        assertEq(arbitrator.balance, arbitratorBalanceBefore + 0.005 ether);
        assertEq(disputeModule.pendingWithdrawals(arbitrator), 0);
    }
}
