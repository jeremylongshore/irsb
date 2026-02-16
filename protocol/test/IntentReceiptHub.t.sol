// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { Types } from "../src/libraries/Types.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract IntentReceiptHubTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IntentReceiptHub public hub;
    SolverRegistry public registry;

    address public owner = address(this);
    uint256 public operatorPrivateKey = 0x1234;
    address public operator;
    address public challenger = address(0x2);

    uint256 public constant MINIMUM_BOND = 0.1 ether;
    uint256 public constant CHALLENGER_BOND = 0.01 ether; // 10% of solver minimum bond

    bytes32 public solverId;

    event ReceiptPosted(bytes32 indexed receiptId, bytes32 indexed intentHash, bytes32 indexed solverId, uint64 expiry);
    event DisputeOpened(
        bytes32 indexed receiptId, bytes32 indexed solverId, address indexed challenger, Types.DisputeReason reason
    );
    event DisputeResolved(bytes32 indexed receiptId, bytes32 indexed solverId, bool slashed, uint256 slashAmount);
    event ReceiptFinalized(bytes32 indexed receiptId, bytes32 indexed solverId);
    event SettlementProofSubmitted(bytes32 indexed receiptId, bytes32 proofHash);

    function setUp() public {
        operator = vm.addr(operatorPrivateKey);

        // Fund test contract
        vm.deal(address(this), 10 ether);
        // Fund challenger for bond payments
        vm.deal(challenger, 10 ether);

        // Deploy contracts
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));

        // Authorize hub to call registry
        registry.setAuthorizedCaller(address(hub), true);

        // Register and fund solver
        solverId = registry.registerSolver("ipfs://metadata", operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    // Allow test contract to receive ETH (for slashing)
    receive() external payable { }

    // ============ Helper Functions ============

    function _createReceipt(bytes32 intentHash, uint64 expiry) internal view returns (Types.IntentReceipt memory) {
        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: intentHash,
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: expiry,
            solverId: solverId,
            solverSig: ""
        });

        // Sign receipt (IRSB-SEC-001 + IRSB-SEC-006: includes chainId, hub address, and nonce for replay protection)
        uint256 currentNonce = hub.solverNonces(solverId);
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(hub),
                currentNonce,
                receipt.intentHash,
                receipt.constraintsHash,
                receipt.routeHash,
                receipt.outcomeHash,
                receipt.evidenceHash,
                receipt.createdAt,
                receipt.expiry,
                receipt.solverId
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        return receipt;
    }

    function _postReceipt(bytes32 intentHash, uint64 expiry) internal returns (bytes32 receiptId) {
        Types.IntentReceipt memory receipt = _createReceipt(intentHash, expiry);

        vm.prank(operator);
        receiptId = hub.postReceipt(receipt, 0);
    }

    // ============ Post Receipt Tests ============

    function test_PostReceipt() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        Types.IntentReceipt memory receipt = _createReceipt(intentHash, expiry);

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        assertTrue(receiptId != bytes32(0));
        assertEq(hub.totalReceipts(), 1);

        (Types.IntentReceipt memory stored, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(stored.intentHash, intentHash);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Pending));
    }

    function test_PostReceipt_RevertInvalidSolver() public {
        // Create receipt with unregistered solver
        address fakeSolver = address(0x999);
        bytes32 fakeId = keccak256(abi.encodePacked(fakeSolver, block.timestamp));

        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: fakeId,
            solverSig: ""
        });

        vm.expectRevert(abi.encodeWithSignature("InvalidSolver()"));
        hub.postReceipt(receipt, 0);
    }

    function test_PostReceipt_RevertDuplicate() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        Types.IntentReceipt memory receipt = _createReceipt(intentHash, expiry);

        vm.startPrank(operator);
        hub.postReceipt(receipt, 0);

        vm.expectRevert(abi.encodeWithSignature("ReceiptAlreadyExists()"));
        hub.postReceipt(receipt, 0);
        vm.stopPrank();
    }

    function test_PostReceipt_RevertInvalidSignature() public {
        // Sign with a different private key to produce wrong signature
        uint256 wrongPrivateKey = 0x5678;

        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            solverSig: ""
        });

        // Sign with wrong key (IRSB-SEC-001 + IRSB-SEC-006: includes chainId, hub address, and nonce)
        uint256 currentNonce = hub.solverNonces(solverId);
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(hub),
                currentNonce,
                receipt.intentHash,
                receipt.constraintsHash,
                receipt.routeHash,
                receipt.outcomeHash,
                receipt.evidenceHash,
                receipt.createdAt,
                receipt.expiry,
                receipt.solverId
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidReceiptSignature()"));
        hub.postReceipt(receipt, 0);
    }

    // ============ Open Dispute Tests ============

    function test_OpenDispute() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Disputed));

        Types.Dispute memory dispute = hub.getDispute(receiptId);
        assertEq(dispute.challenger, challenger);
        assertEq(uint256(dispute.reason), uint256(Types.DisputeReason.Timeout));
        assertFalse(dispute.resolved);

        assertEq(hub.totalDisputes(), 1);
        assertEq(hub.getChallengerBond(receiptId), CHALLENGER_BOND);
    }

    function test_OpenDispute_RevertNotPending() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        // Open first dispute
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        // Try to open second dispute
        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.MinOutViolation, keccak256("evidence2")
        );
    }

    function test_OpenDispute_RevertChallengeWindowExpired() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        // Fast forward past challenge window
        vm.warp(block.timestamp + 2 hours);

        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("ChallengeWindowExpired()"));
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));
    }

    function test_OpenDispute_RevertInvalidReason() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("InvalidDisputeReason()"));
        hub.openDispute(receiptId, Types.DisputeReason.None, keccak256("evidence"));
    }

    // ============ Resolve Dispute Tests ============

    function test_ResolveDeterministic_SlashOnTimeout() public {
        bytes32 intentHash = keccak256("intent");
        uint64 expiry = uint64(block.timestamp + 30 minutes);

        bytes32 receiptId = _postReceipt(intentHash, expiry);

        uint256 challengerBalanceBefore = challenger.balance;

        // Open timeout dispute with challenger bond
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        // Fast forward past expiry
        vm.warp(expiry + 1);

        // Resolve - should slash since no settlement proof and past expiry
        hub.resolveDeterministic(receiptId);

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Slashed));

        assertTrue(hub.totalSlashed() > 0);

        // Challenger should receive their bond back + 15% of slash (reward)
        // Bond: 0.01 ETH back + 0.015 ETH (15% of 0.1 ETH) = 0.025 ETH profit
        assertTrue(challenger.balance > challengerBalanceBefore);
    }

    function test_ResolveDeterministic_NoSlashWithProof() public {
        bytes32 intentHash = keccak256("intent");
        uint64 expiry = uint64(block.timestamp + 30 minutes);

        bytes32 receiptId = _postReceipt(intentHash, expiry);

        // Submit settlement proof
        vm.prank(operator);
        hub.submitSettlementProof(receiptId, keccak256("proof"));

        uint256 challengerBalanceBefore = challenger.balance;

        // Open timeout dispute with challenger bond
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        // Fast forward past expiry
        vm.warp(expiry + 1);

        // Resolve - should not slash since settlement proof exists
        hub.resolveDeterministic(receiptId);

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        // IRSB-SEC-003: Rejected disputes finalize the receipt to prevent re-challenge attacks
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));

        // Challenger loses their bond (frivolous dispute)
        assertEq(challenger.balance, challengerBalanceBefore - CHALLENGER_BOND);
    }

    function test_ResolveDeterministic_RevertAlreadyResolved() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));

        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        vm.warp(block.timestamp + 31 minutes);

        hub.resolveDeterministic(receiptId);

        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.resolveDeterministic(receiptId);
    }

    // ============ Finalize Tests ============

    function test_Finalize() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        // Fast forward past challenge window
        vm.warp(block.timestamp + 2 hours);

        hub.finalize(receiptId);

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));
    }

    function test_Finalize_RevertChallengeWindowActive() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.expectRevert(abi.encodeWithSignature("ChallengeWindowActive()"));
        hub.finalize(receiptId);
    }

    function test_Finalize_RevertNotPending() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.warp(block.timestamp + 2 hours);
        hub.finalize(receiptId);

        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.finalize(receiptId);
    }

    function test_CanFinalize() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        assertFalse(hub.canFinalize(receiptId));

        vm.warp(block.timestamp + 2 hours);

        assertTrue(hub.canFinalize(receiptId));
    }

    // ============ Settlement Proof Tests ============

    function test_SubmitSettlementProof() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        bytes32 proofHash = keccak256("settlement_proof");

        vm.prank(operator);
        hub.submitSettlementProof(receiptId, proofHash);

        // Proof stored (no direct getter, but affects dispute resolution)
    }

    function test_SubmitSettlementProof_RevertNonOperator() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(challenger);
        vm.expectRevert("Not solver operator");
        hub.submitSettlementProof(receiptId, keccak256("proof"));
    }

    // ============ Batch Post Tests ============

    function test_BatchPostReceipts() public {
        Types.IntentReceipt[] memory receipts = new Types.IntentReceipt[](3);

        // IRSB-SEC-006: Each receipt in batch needs sequential nonce
        uint256 baseNonce = hub.solverNonces(solverId);

        for (uint256 i = 0; i < 3; i++) {
            receipts[i] = Types.IntentReceipt({
                intentHash: keccak256(abi.encodePacked("intent", i)),
                constraintsHash: keccak256("constraints"),
                routeHash: keccak256("route"),
                outcomeHash: keccak256("outcome"),
                evidenceHash: keccak256("evidence"),
                createdAt: uint64(block.timestamp + i), // Unique timestamp for unique receipt ID
                expiry: uint64(block.timestamp + 1 hours),
                solverId: solverId,
                solverSig: ""
            });

            // Sign with sequential nonce (IRSB-SEC-001 + IRSB-SEC-006)
            bytes32 messageHash = keccak256(
                abi.encode(
                    block.chainid,
                    address(hub),
                    baseNonce + i, // Sequential nonce for each receipt
                    receipts[i].intentHash,
                    receipts[i].constraintsHash,
                    receipts[i].routeHash,
                    receipts[i].outcomeHash,
                    receipts[i].evidenceHash,
                    receipts[i].createdAt,
                    receipts[i].expiry,
                    receipts[i].solverId
                )
            );
            bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, ethSignedHash);
            receipts[i].solverSig = abi.encodePacked(r, s, v);
        }

        uint256[] memory volumes = new uint256[](receipts.length);

        vm.prank(operator);
        bytes32[] memory receiptIds = hub.batchPostReceipts(receipts, volumes);

        assertEq(receiptIds.length, 3);
        assertEq(hub.totalReceipts(), 3);
    }

    function test_BatchPostReceipts_SkipsDuplicates() public {
        Types.IntentReceipt memory receipt = _createReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        Types.IntentReceipt[] memory receipts = new Types.IntentReceipt[](2);
        receipts[0] = receipt;
        receipts[1] = receipt; // Duplicate

        uint256[] memory volumes = new uint256[](receipts.length);

        vm.prank(operator);
        bytes32[] memory receiptIds = hub.batchPostReceipts(receipts, volumes);

        // Second one should be bytes32(0) since it's a duplicate
        assertTrue(receiptIds[0] != bytes32(0));
        assertEq(receiptIds[1], bytes32(0));
        assertEq(hub.totalReceipts(), 1);
    }

    // ============ View Function Tests ============

    function test_GetReceiptsBySolver() public {
        _postReceipt(keccak256("intent1"), uint64(block.timestamp + 1 hours));

        // Need different timestamps for unique receipts
        vm.warp(block.timestamp + 1);
        _postReceipt(keccak256("intent2"), uint64(block.timestamp + 1 hours));

        vm.warp(block.timestamp + 1);
        _postReceipt(keccak256("intent3"), uint64(block.timestamp + 1 hours));

        bytes32[] memory receipts = hub.getReceiptsBySolver(solverId, 0, 10);
        assertEq(receipts.length, 3);

        // Test pagination
        bytes32[] memory page = hub.getReceiptsBySolver(solverId, 1, 1);
        assertEq(page.length, 1);
    }

    function test_GetReceiptsByIntent() public {
        bytes32 intentHash = keccak256("intent1");

        _postReceipt(intentHash, uint64(block.timestamp + 1 hours));

        bytes32[] memory receipts = hub.getReceiptsByIntent(intentHash);
        assertEq(receipts.length, 1);
    }

    function test_GetChallengeWindow() public {
        assertEq(hub.getChallengeWindow(), 1 hours);
    }

    // ============ Admin Function Tests ============

    function test_SetChallengeWindow() public {
        hub.setChallengeWindow(30 minutes);
        assertEq(hub.getChallengeWindow(), 30 minutes);
    }

    function test_SetChallengeWindow_RevertTooShort() public {
        vm.expectRevert("Window too short");
        hub.setChallengeWindow(10 minutes);
    }

    function test_SetChallengeWindow_RevertTooLong() public {
        vm.expectRevert("Window too long");
        hub.setChallengeWindow(48 hours);
    }

    function test_SetDisputeModule() public {
        address module = address(0x999);
        hub.setDisputeModule(module);
        assertEq(hub.disputeModule(), module);
    }

    function test_SetSolverRegistry() public {
        address newRegistry = address(0x888);
        hub.setSolverRegistry(newRegistry);
        assertEq(address(hub.solverRegistry()), newRegistry);
    }

    function test_PauseUnpause() public {
        hub.pause();

        Types.IntentReceipt memory receipt = _createReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        vm.expectRevert();
        hub.postReceipt(receipt, 0);

        hub.unpause();

        vm.prank(operator);
        hub.postReceipt(receipt, 0);
    }

    // ============ Challenger Bond Tests ============

    function test_OpenDispute_RevertInsufficientBond() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        // Try to open dispute with insufficient bond
        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("InsufficientChallengerBond()"));
        hub.openDispute{ value: CHALLENGER_BOND - 1 }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));
    }

    function test_OpenDispute_RevertNoBond() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        // Try to open dispute with no bond
        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("InsufficientChallengerBond()"));
        hub.openDispute(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));
    }

    function test_ChallengerBondReturned_OnSuccessfulDispute() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));

        uint256 challengerBalanceBefore = challenger.balance;

        // Open dispute with exact minimum bond
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        // Verify bond is held
        assertEq(hub.getChallengerBond(receiptId), CHALLENGER_BOND);
        assertEq(challenger.balance, challengerBalanceBefore - CHALLENGER_BOND);

        // Fast forward past expiry and resolve
        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Challenger should receive:
        // - Original bond back (0.01 ETH)
        // - 80% of slash (0.08 ETH) as userShare (going to challenger for now)
        // - 15% of slash (0.015 ETH) as challengerShare
        // Total received from registry: 0.095 ETH
        // Total received from hub: 0.01 ETH (bond return)
        // Net gain: 0.095 ETH (from slash shares)
        assertTrue(challenger.balance > challengerBalanceBefore);
    }

    function test_ChallengerBondForfeited_OnFailedDispute() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));

        // Submit settlement proof (makes dispute invalid)
        vm.prank(operator);
        hub.submitSettlementProof(receiptId, keccak256("proof"));

        uint256 challengerBalanceBefore = challenger.balance;

        // Open frivolous dispute
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        // Verify bond is held
        assertEq(hub.getChallengerBond(receiptId), CHALLENGER_BOND);

        // Fast forward and resolve - dispute should fail
        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Challenger should lose their bond entirely
        assertEq(challenger.balance, challengerBalanceBefore - CHALLENGER_BOND);

        // Bond should be zeroed out (forfeited to contract)
        assertEq(hub.getChallengerBond(receiptId), 0);
    }

    function test_SetChallengerBondMin() public {
        uint256 newBondMin = 0.05 ether;
        hub.setChallengerBondMin(newBondMin);
        assertEq(hub.challengerBondMin(), newBondMin);
    }

    function test_SetChallengerBondMin_RevertZero() public {
        vm.expectRevert("Bond must be > 0");
        hub.setChallengerBondMin(0);
    }

    function test_SetChallengerBondMin_RevertNonOwner() public {
        vm.prank(challenger);
        vm.expectRevert();
        hub.setChallengerBondMin(0.05 ether);
    }

    function test_SweepForfeitedBonds() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));

        // Submit proof to make dispute fail
        vm.prank(operator);
        hub.submitSettlementProof(receiptId, keccak256("proof"));

        // Open and lose dispute
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Hub should now have the forfeited bond
        assertEq(address(hub).balance, CHALLENGER_BOND);

        // Sweep to treasury
        address treasury = address(0x999);
        hub.sweepForfeitedBonds(treasury);

        assertEq(treasury.balance, CHALLENGER_BOND);
        assertEq(address(hub).balance, 0);
    }

    function test_SweepForfeitedBonds_RevertNoFunds() public {
        vm.expectRevert(abi.encodeWithSignature("NoForfeitedBonds()"));
        hub.sweepForfeitedBonds(address(0x999));
    }

    function test_SweepForfeitedBonds_RevertNonOwner() public {
        // First create some forfeited funds
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));
        vm.prank(operator);
        hub.submitSettlementProof(receiptId, keccak256("proof"));
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));
        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Try to sweep as non-owner
        vm.prank(challenger);
        vm.expectRevert();
        hub.sweepForfeitedBonds(challenger);
    }

    // ============ Security Regression Tests ============

    /// @notice IRSB-SEC-001: Verify cross-chain replay is prevented
    /// @dev Receipt signed for a different chainId must be rejected
    function test_IRSB_SEC_001_crossChainReplayPrevented() public {
        // Create receipt with signature for wrong chainId
        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            solverSig: ""
        });

        // Sign with WRONG chainId (simulating replay from another chain)
        uint256 wrongChainId = 999999;
        uint256 currentNonce = hub.solverNonces(solverId);
        bytes32 messageHash = keccak256(
            abi.encode(
                wrongChainId, // Wrong chain!
                address(hub),
                currentNonce,
                receipt.intentHash,
                receipt.constraintsHash,
                receipt.routeHash,
                receipt.outcomeHash,
                receipt.evidenceHash,
                receipt.createdAt,
                receipt.expiry,
                receipt.solverId
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        // Should fail because chainId doesn't match
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidReceiptSignature()"));
        hub.postReceipt(receipt, 0);
    }

    /// @notice IRSB-SEC-001: Verify wrong contract address is rejected
    /// @dev Receipt signed for a different contract address must be rejected
    function test_IRSB_SEC_001_wrongContractAddressRejected() public {
        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            solverSig: ""
        });

        // Sign with WRONG contract address
        address wrongHub = address(0xDEAD);
        uint256 currentNonce = hub.solverNonces(solverId);
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                wrongHub, // Wrong contract address!
                currentNonce,
                receipt.intentHash,
                receipt.constraintsHash,
                receipt.routeHash,
                receipt.outcomeHash,
                receipt.evidenceHash,
                receipt.createdAt,
                receipt.expiry,
                receipt.solverId
            )
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        // Should fail because contract address doesn't match
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidReceiptSignature()"));
        hub.postReceipt(receipt, 0);
    }

    /// @notice IRSB-SEC-003: Verify rejected dispute finalizes receipt and prevents re-challenge
    /// @dev After dispute is rejected, receipt should be Finalized and cannot be disputed again
    function test_IRSB_SEC_003_rejectedDisputeCannotBeRechallenged() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));

        // Submit settlement proof to make dispute fail
        vm.prank(operator);
        hub.submitSettlementProof(receiptId, keccak256("proof"));

        // Open dispute (will be rejected due to proof)
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        // Fast forward and resolve - dispute should be rejected
        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Verify receipt is now Finalized (not Pending)
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));

        // Attempt to re-challenge should fail because receipt is not Pending
        vm.deal(challenger, 10 ether); // Ensure challenger has funds
        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.openDispute{ value: CHALLENGER_BOND }(
            receiptId, Types.DisputeReason.MinOutViolation, keccak256("evidence2")
        );
    }

    // ============ Volume-Proportional Bond Tests (PM-EC-001) ============

    function test_PostReceipt_WithDeclaredVolume() public {
        bytes32 intentHash = keccak256("intent-vol");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        Types.IntentReceipt memory receipt = _createReceipt(intentHash, expiry);

        // 1 ETH volume with 0.1 ETH bond (at 5% ratio, needs max(0.1, 0.05) = 0.1) — passes
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 1 ether);
        assertTrue(receiptId != bytes32(0));
    }

    function test_PostReceipt_RevertInsufficientBondForVolume() public {
        // Deposit more bond to make solver active but test volume check
        // Current bond: 0.1 ETH. At 5% ratio, 0.1 ETH covers up to 2 ETH volume.
        // 10 ETH volume requires 0.5 ETH bond — should revert
        bytes32 intentHash = keccak256("intent-bigvol");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        Types.IntentReceipt memory receipt = _createReceipt(intentHash, expiry);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBondForVolume()"));
        hub.postReceipt(receipt, 10 ether);
    }

    function test_PostReceipt_HighBondAllowsHighVolume() public {
        // Deposit additional bond to cover high volume
        registry.depositBond{ value: 0.9 ether }(solverId); // Now 1.0 ETH total

        bytes32 intentHash = keccak256("intent-highvol");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        Types.IntentReceipt memory receipt = _createReceipt(intentHash, expiry);

        // 1.0 ETH bond at 5% covers up to 20 ETH volume
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 20 ether);
        assertTrue(receiptId != bytes32(0));
    }

    function test_BatchPostReceipts_WithVolumes() public {
        // Deposit more bond
        registry.depositBond{ value: 0.9 ether }(solverId); // 1.0 ETH total

        Types.IntentReceipt[] memory receipts = new Types.IntentReceipt[](2);
        uint256 baseNonce = hub.solverNonces(solverId);

        for (uint256 i = 0; i < 2; i++) {
            receipts[i] = Types.IntentReceipt({
                intentHash: keccak256(abi.encodePacked("batch-vol-intent", i)),
                constraintsHash: keccak256("constraints"),
                routeHash: keccak256("route"),
                outcomeHash: keccak256("outcome"),
                evidenceHash: keccak256("evidence"),
                createdAt: uint64(block.timestamp + i),
                expiry: uint64(block.timestamp + 1 hours),
                solverId: solverId,
                solverSig: ""
            });

            bytes32 messageHash = keccak256(
                abi.encode(
                    block.chainid,
                    address(hub),
                    baseNonce + i,
                    receipts[i].intentHash,
                    receipts[i].constraintsHash,
                    receipts[i].routeHash,
                    receipts[i].outcomeHash,
                    receipts[i].evidenceHash,
                    receipts[i].createdAt,
                    receipts[i].expiry,
                    receipts[i].solverId
                )
            );
            bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, ethSignedHash);
            receipts[i].solverSig = abi.encodePacked(r, s, v);
        }

        uint256[] memory volumes = new uint256[](2);
        volumes[0] = 5 ether; // Needs 0.25 ETH bond
        volumes[1] = 5 ether; // Needs 0.25 ETH bond

        vm.prank(operator);
        bytes32[] memory ids = hub.batchPostReceipts(receipts, volumes);
        assertEq(ids.length, 2);
        assertTrue(ids[0] != bytes32(0));
        assertTrue(ids[1] != bytes32(0));
    }
}
