// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { Types } from "../../src/libraries/Types.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title IntentReceiptHubFuzz
/// @notice Fuzz tests for IntentReceiptHub invariants
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract IntentReceiptHubFuzz
contract IntentReceiptHubFuzz is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IntentReceiptHub public hub;
    SolverRegistry public registry;

    address public owner = address(this);
    uint256 public operatorPrivateKey = 0x1234;
    address public operator;
    address public challenger = address(0xC4a11e9e2);

    uint256 public constant MINIMUM_BOND = 0.1 ether;
    uint256 public constant CHALLENGER_BOND = 0.01 ether;

    bytes32 public solverId;

    // Allow test contract to receive ETH (for treasury share)
    receive() external payable { }

    function setUp() public {
        operator = vm.addr(operatorPrivateKey);
        vm.deal(address(this), 100 ether);
        vm.deal(operator, 100 ether);
        vm.deal(challenger, 100 ether);

        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));

        registry.setAuthorizedCaller(address(hub), true);

        // Register and fund solver
        vm.prank(operator);
        solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    /// @notice Invariant: receipt ID is deterministic
    function testFuzz_ReceiptIdDeterministic(bytes32 salt) public view {
        bytes32 intentHash = keccak256(abi.encodePacked("intent", salt));
        uint64 expiry = uint64(block.timestamp + 30 minutes);

        Types.IntentReceipt memory receipt = _createUnsignedReceipt(intentHash, expiry);

        // Compute ID twice
        bytes32 id1 = hub.computeReceiptId(receipt);
        bytes32 id2 = hub.computeReceiptId(receipt);

        assertEq(id1, id2, "Receipt ID not deterministic");
        assertTrue(id1 != bytes32(0), "Receipt ID should not be zero");
    }

    /// @notice Invariant: different receipts have different IDs
    function testFuzz_UniqueReceiptIds(bytes32 salt1, bytes32 salt2) public view {
        vm.assume(salt1 != salt2);

        uint64 expiry = uint64(block.timestamp + 30 minutes);

        Types.IntentReceipt memory receipt1 =
            _createUnsignedReceipt(keccak256(abi.encodePacked("intent", salt1)), expiry);
        Types.IntentReceipt memory receipt2 =
            _createUnsignedReceipt(keccak256(abi.encodePacked("intent", salt2)), expiry);

        bytes32 id1 = hub.computeReceiptId(receipt1);
        bytes32 id2 = hub.computeReceiptId(receipt2);

        assertTrue(id1 != id2, "Different receipts should have different IDs");
    }

    /// @notice Invariant: forfeited bonds tracking is accurate
    function testFuzz_ForfeitedBondsTracking(uint8 numDisputes) public {
        numDisputes = uint8(bound(numDisputes, 1, 5));

        uint256 expectedForfeited = 0;

        for (uint256 i = 0; i < numDisputes; i++) {
            // Create and post receipt
            bytes32 intentHash = keccak256(abi.encodePacked("intent", i));
            uint64 expiry = uint64(block.timestamp + 30 minutes);
            bytes32 receiptId = _postReceipt(intentHash, expiry);

            // Submit settlement proof so dispute will fail
            vm.prank(operator);
            hub.submitSettlementProof(receiptId, keccak256(abi.encodePacked("proof", i)));

            // Open dispute (will be rejected because proof exists)
            vm.prank(challenger);
            hub.openDispute{ value: CHALLENGER_BOND }(
                receiptId, Types.DisputeReason.Timeout, keccak256(abi.encodePacked("evidence", i))
            );

            // Resolve (dispute rejected, bond forfeited)
            hub.resolveDeterministic(receiptId);

            expectedForfeited += CHALLENGER_BOND;
        }

        // Verify tracking
        assertEq(hub.totalForfeitedBonds(), expectedForfeited, "Forfeited bonds not tracked correctly");
    }

    /// @notice Invariant: sweep only takes tracked forfeited bonds
    function testFuzz_SweepOnlyForfeited(uint8 numForfeited) public {
        numForfeited = uint8(bound(numForfeited, 1, 3));

        uint256 expectedForfeited = 0;

        // Create forfeited bonds
        for (uint256 i = 0; i < numForfeited; i++) {
            bytes32 intentHash = keccak256(abi.encodePacked("forfeit", i));
            uint64 expiry = uint64(block.timestamp + 30 minutes);
            bytes32 receiptId = _postReceipt(intentHash, expiry);

            vm.prank(operator);
            hub.submitSettlementProof(receiptId, keccak256(abi.encodePacked("proof", i)));

            vm.prank(challenger);
            hub.openDispute{ value: CHALLENGER_BOND }(
                receiptId, Types.DisputeReason.Timeout, keccak256(abi.encodePacked("evidence", i))
            );

            hub.resolveDeterministic(receiptId);
            expectedForfeited += CHALLENGER_BOND;
        }

        // Create an active dispute (bond should NOT be swept)
        bytes32 activeIntentHash = keccak256("active");
        uint64 activeExpiry = uint64(block.timestamp + 30 minutes);
        bytes32 activeReceiptId = _postReceipt(activeIntentHash, activeExpiry);

        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(
            activeReceiptId, Types.DisputeReason.Timeout, keccak256("active-evidence")
        );

        // Contract balance includes both forfeited AND active dispute bonds
        uint256 contractBalance = address(hub).balance;
        assertEq(contractBalance, expectedForfeited + CHALLENGER_BOND, "Contract balance should be forfeited + active");

        // Sweep forfeited
        address treasury = address(0x999);
        uint256 treasuryBefore = treasury.balance;

        hub.sweepForfeitedBonds(treasury);

        // Verify only forfeited was swept
        assertEq(treasury.balance - treasuryBefore, expectedForfeited, "Sweep took wrong amount");
        assertEq(hub.totalForfeitedBonds(), 0, "Tracking should be zero after sweep");
        assertEq(address(hub).balance, CHALLENGER_BOND, "Active dispute bond should remain");
    }

    /// @notice Invariant: challenge window timing is enforced
    function testFuzz_ChallengeWindowEnforced(uint256 timePassed) public {
        // Post receipt
        bytes32 intentHash = keccak256("timing-test");
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 receiptId = _postReceipt(intentHash, expiry);

        uint64 challengeWindow = hub.getChallengeWindow();
        timePassed = bound(timePassed, 0, challengeWindow + 1 hours);

        // Warp time
        vm.warp(block.timestamp + timePassed);

        // Try to open dispute
        vm.prank(challenger);
        if (timePassed > challengeWindow) {
            vm.expectRevert(abi.encodeWithSignature("ChallengeWindowExpired()"));
            hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));
        } else {
            // Should succeed
            hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

            Types.Dispute memory dispute = hub.getDispute(receiptId);
            assertEq(dispute.challenger, challenger, "Dispute should be opened");
        }
    }

    /// @notice Invariant: finalization only after challenge window
    function testFuzz_FinalizationTiming(uint256 timePassed) public {
        bytes32 intentHash = keccak256("finalize-test");
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 receiptId = _postReceipt(intentHash, expiry);

        uint64 challengeWindow = hub.getChallengeWindow();
        timePassed = bound(timePassed, 0, challengeWindow + 1 hours);

        vm.warp(block.timestamp + timePassed);

        if (timePassed <= challengeWindow) {
            vm.expectRevert(abi.encodeWithSignature("ChallengeWindowActive()"));
            hub.finalize(receiptId);
        } else {
            hub.finalize(receiptId);
            (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
            assertEq(uint8(status), uint8(Types.ReceiptStatus.Finalized), "Should be finalized");
        }
    }

    /// @notice Invariant: duplicate receipts rejected
    function testFuzz_DuplicateReceiptsRejected(bytes32 salt) public {
        bytes32 intentHash = keccak256(abi.encodePacked("duplicate", salt));
        uint64 expiry = uint64(block.timestamp + 30 minutes);

        // Post receipt
        Types.IntentReceipt memory receipt = _createSignedReceipt(intentHash, expiry);
        vm.prank(operator);
        hub.postReceipt(receipt, 0);

        // Try to post again - should fail
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("ReceiptAlreadyExists()"));
        hub.postReceipt(receipt, 0);
    }

    /// @notice Invariant: status transitions follow state machine
    function testFuzz_StatusTransitions(uint8 path) public {
        path = uint8(bound(path, 0, 2));

        bytes32 intentHash = keccak256(abi.encodePacked("status", path));
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        bytes32 receiptId = _postReceipt(intentHash, expiry);

        // Initial status is Pending
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint8(status), uint8(Types.ReceiptStatus.Pending), "Initial should be Pending");

        if (path == 0) {
            // Path: Pending → Finalized
            vm.warp(block.timestamp + 1 hours + 1);
            hub.finalize(receiptId);
            (, status) = hub.getReceipt(receiptId);
            assertEq(uint8(status), uint8(Types.ReceiptStatus.Finalized), "Should be Finalized");
        } else if (path == 1) {
            // Path: Pending → Disputed → Slashed (no proof, receipt expires)
            vm.prank(challenger);
            hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

            (, status) = hub.getReceipt(receiptId);
            assertEq(uint8(status), uint8(Types.ReceiptStatus.Disputed), "Should be Disputed");

            vm.warp(expiry + 1);
            hub.resolveDeterministic(receiptId);

            (, status) = hub.getReceipt(receiptId);
            assertEq(uint8(status), uint8(Types.ReceiptStatus.Slashed), "Should be Slashed");
        } else {
            // Path: Pending → Disputed → Finalized (dispute rejected)
            // IRSB-SEC-003: Rejected disputes now finalize the receipt to prevent re-challenge attacks
            vm.prank(operator);
            hub.submitSettlementProof(receiptId, keccak256("proof"));

            vm.prank(challenger);
            hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

            hub.resolveDeterministic(receiptId);

            // IRSB-SEC-003: Receipt is now Finalized after rejected dispute
            (, status) = hub.getReceipt(receiptId);
            assertEq(uint8(status), uint8(Types.ReceiptStatus.Finalized), "Should be Finalized after rejected dispute");
        }
    }

    // ============ Helper Functions ============

    function _createUnsignedReceipt(bytes32 intentHash, uint64 expiry)
        internal
        view
        returns (Types.IntentReceipt memory)
    {
        return Types.IntentReceipt({
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
    }

    function _createSignedReceipt(bytes32 intentHash, uint64 expiry)
        internal
        view
        returns (Types.IntentReceipt memory)
    {
        Types.IntentReceipt memory receipt = _createUnsignedReceipt(intentHash, expiry);

        // IRSB-SEC-001: Include chainId and hub address to prevent cross-chain replay
        // IRSB-SEC-006: Include nonce for same-chain replay protection
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

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivateKey, messageHash.toEthSignedMessageHash());
        receipt.solverSig = abi.encodePacked(r, s, v);

        return receipt;
    }

    function _postReceipt(bytes32 intentHash, uint64 expiry) internal returns (bytes32 receiptId) {
        Types.IntentReceipt memory receipt = _createSignedReceipt(intentHash, expiry);
        vm.prank(operator);
        receiptId = hub.postReceipt(receipt, 0);
    }
}
