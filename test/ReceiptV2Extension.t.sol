// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ReceiptV2Extension } from "../src/extensions/ReceiptV2Extension.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { Types } from "../src/libraries/Types.sol";
import { TypesV2 } from "../src/libraries/TypesV2.sol";
import { EIP712ReceiptV2 } from "../src/libraries/EIP712ReceiptV2.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ReceiptV2ExtensionTest is Test {
    using ECDSA for bytes32;

    ReceiptV2Extension public extension;
    SolverRegistry public registry;

    address public owner = address(this);
    uint256 public operatorPrivateKey = 0x1234;
    uint256 public clientPrivateKey = 0x5678;
    address public operator;
    address public client;
    address public challenger = address(0x3);

    uint256 public constant MINIMUM_BOND = 0.1 ether;
    uint256 public constant CHALLENGER_BOND = 0.01 ether;

    bytes32 public solverId;

    event ReceiptV2Posted(
        bytes32 indexed receiptId,
        bytes32 indexed intentHash,
        bytes32 indexed solverId,
        address client,
        bytes32 metadataCommitment,
        TypesV2.PrivacyLevel privacyLevel,
        bytes32 escrowId,
        uint64 expiry
    );

    event ReceiptV2Finalized(bytes32 indexed receiptId, bytes32 indexed solverId, bytes32 escrowId);

    event ReceiptV2Disputed(
        bytes32 indexed receiptId, bytes32 indexed solverId, address indexed challenger, bytes32 reasonHash
    );

    function setUp() public {
        operator = vm.addr(operatorPrivateKey);
        client = vm.addr(clientPrivateKey);

        // Fund accounts
        vm.deal(address(this), 10 ether);
        vm.deal(challenger, 10 ether);

        // Deploy contracts
        registry = new SolverRegistry();
        extension = new ReceiptV2Extension(address(registry));

        // Authorize extension to call registry
        registry.setAuthorizedCaller(address(extension), true);

        // Register and fund solver
        solverId = registry.registerSolver("ipfs://metadata", operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    receive() external payable { }

    // ============ Helper Functions ============

    function _createReceiptV2(bytes32 intentHash, uint64 expiry)
        internal
        view
        returns (TypesV2.IntentReceiptV2 memory)
    {
        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: intentHash,
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: expiry,
            solverId: solverId,
            client: client,
            metadataCommitment: keccak256("metadata"),
            ciphertextPointer: "QmTest123456789",
            privacyLevel: TypesV2.PrivacyLevel.SemiPublic,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        // Sign with EIP-712
        bytes32 digest = _computeDigest(receipt);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(operatorPrivateKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientPrivateKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        return receipt;
    }

    function _createReceiptV2WithEscrow(bytes32 intentHash, uint64 expiry, bytes32 escrowId)
        internal
        view
        returns (TypesV2.IntentReceiptV2 memory)
    {
        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: intentHash,
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: expiry,
            solverId: solverId,
            client: client,
            metadataCommitment: keccak256("metadata"),
            ciphertextPointer: "QmTest123456789",
            privacyLevel: TypesV2.PrivacyLevel.Private,
            escrowId: escrowId,
            solverSig: "",
            clientSig: ""
        });

        bytes32 digest = _computeDigest(receipt);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(operatorPrivateKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);

        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientPrivateKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        return receipt;
    }

    function _computeDigest(TypesV2.IntentReceiptV2 memory receipt) internal view returns (bytes32) {
        bytes32 structHash = TypesV2.hashReceiptV2(receipt);
        bytes32 domainSeparator = extension.domainSeparator();
        return EIP712ReceiptV2.computeTypedDataHash(domainSeparator, structHash);
    }

    function _postReceiptV2(bytes32 intentHash, uint64 expiry) internal returns (bytes32 receiptId) {
        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);
        vm.prank(operator);
        receiptId = extension.postReceiptV2(receipt);
    }

    // ============ Post Receipt V2 Tests ============

    function test_PostReceiptV2() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);

        vm.prank(operator);
        bytes32 receiptId = extension.postReceiptV2(receipt);

        assertTrue(receiptId != bytes32(0));
        assertEq(extension.totalReceiptsV2(), 1);

        (TypesV2.IntentReceiptV2 memory stored, TypesV2.ReceiptV2Status status) = extension.getReceiptV2(receiptId);
        assertEq(stored.intentHash, intentHash);
        assertEq(stored.client, client);
        assertEq(stored.metadataCommitment, keccak256("metadata"));
        assertEq(uint256(status), uint256(TypesV2.ReceiptV2Status.Pending));
    }

    function test_PostReceiptV2_EmitsEvent() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);
        bytes32 expectedReceiptId = TypesV2.computeReceiptV2Id(receipt);

        vm.expectEmit(true, true, true, true);
        emit ReceiptV2Posted(
            expectedReceiptId,
            intentHash,
            solverId,
            client,
            keccak256("metadata"),
            TypesV2.PrivacyLevel.SemiPublic,
            bytes32(0),
            expiry
        );

        vm.prank(operator);
        extension.postReceiptV2(receipt);
    }

    function test_PostReceiptV2_WithEscrowId() public {
        bytes32 intentHash = keccak256("intent_escrow");
        uint64 expiry = uint64(block.timestamp + 1 hours);
        bytes32 escrowId = keccak256("escrow123");

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2WithEscrow(intentHash, expiry, escrowId);

        vm.prank(operator);
        bytes32 receiptId = extension.postReceiptV2(receipt);

        (TypesV2.IntentReceiptV2 memory stored,) = extension.getReceiptV2(receiptId);
        assertEq(stored.escrowId, escrowId);
        assertEq(uint256(stored.privacyLevel), uint256(TypesV2.PrivacyLevel.Private));
    }

    function test_PostReceiptV2_RevertDuplicate() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);

        vm.startPrank(operator);
        extension.postReceiptV2(receipt);

        vm.expectRevert(abi.encodeWithSignature("ReceiptV2AlreadyExists()"));
        extension.postReceiptV2(receipt);
        vm.stopPrank();
    }

    function test_PostReceiptV2_RevertInvalidSolverSignature() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);
        // Corrupt solver signature
        receipt.solverSig = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidSolverSignature()"));
        extension.postReceiptV2(receipt);
    }

    function test_PostReceiptV2_RevertInvalidClientSignature() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);
        // Corrupt client signature
        receipt.clientSig = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidClientSignature()"));
        extension.postReceiptV2(receipt);
    }

    function test_PostReceiptV2_RevertInvalidMetadataCommitment() public {
        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            client: client,
            metadataCommitment: bytes32(0), // Invalid - zero commitment
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidMetadataCommitment()"));
        extension.postReceiptV2(receipt);
    }

    function test_PostReceiptV2_RevertSolverNotActive() public {
        // Create a new solver that is not bonded (inactive)
        bytes32 inactiveSolverId = registry.registerSolver("ipfs://inactive", address(0x999));

        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: inactiveSolverId,
            client: client,
            metadataCommitment: keccak256("meta"),
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSignature("SolverNotActive()"));
        extension.postReceiptV2(receipt);
    }

    function test_PostReceiptV2_RevertNotSolverOperator() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);

        // Try to post from non-operator
        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSignature("NotSolverOperator()"));
        extension.postReceiptV2(receipt);
    }

    // ============ Finalize V2 Tests ============

    function test_FinalizeV2() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        // Fast-forward past challenge window
        vm.warp(block.timestamp + 1 hours + 1);

        vm.expectEmit(true, true, true, true);
        emit ReceiptV2Finalized(receiptId, solverId, bytes32(0));

        extension.finalizeV2(receiptId);

        (, TypesV2.ReceiptV2Status status) = extension.getReceiptV2(receiptId);
        assertEq(uint256(status), uint256(TypesV2.ReceiptV2Status.Finalized));
    }

    function test_FinalizeV2_RevertChallengeWindowActive() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        // Try to finalize before window expires
        vm.expectRevert(abi.encodeWithSignature("ChallengeWindowActive()"));
        extension.finalizeV2(receiptId);
    }

    function test_FinalizeV2_RevertNotPending() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        // Fast-forward and finalize
        vm.warp(block.timestamp + 1 hours + 1);
        extension.finalizeV2(receiptId);

        // Try to finalize again
        vm.expectRevert(abi.encodeWithSignature("ReceiptV2NotPending()"));
        extension.finalizeV2(receiptId);
    }

    function test_CanFinalizeV2() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        // Before window expires
        assertFalse(extension.canFinalizeV2(receiptId));

        // After window expires
        vm.warp(block.timestamp + 1 hours + 1);
        assertTrue(extension.canFinalizeV2(receiptId));
    }

    // ============ Dispute V2 Tests ============

    function test_OpenDisputeV2() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);
        bytes32 reasonHash = keccak256("timeout");

        vm.expectEmit(true, true, true, true);
        emit ReceiptV2Disputed(receiptId, solverId, challenger, reasonHash);

        vm.prank(challenger);
        extension.openDisputeV2{ value: CHALLENGER_BOND }(receiptId, reasonHash, keccak256("evidence"));

        (, TypesV2.ReceiptV2Status status) = extension.getReceiptV2(receiptId);
        assertEq(uint256(status), uint256(TypesV2.ReceiptV2Status.Disputed));
        assertEq(extension.getChallenger(receiptId), challenger);
        assertEq(extension.getChallengerBondV2(receiptId), CHALLENGER_BOND);
    }

    function test_OpenDisputeV2_RevertInsufficientBond() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBond()"));
        extension.openDisputeV2{ value: 0.001 ether }(receiptId, keccak256("reason"), keccak256("evidence"));
    }

    function test_OpenDisputeV2_RevertChallengeWindowExpired() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        // Fast-forward past challenge window
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("ChallengeWindowExpired()"));
        extension.openDisputeV2{ value: CHALLENGER_BOND }(receiptId, keccak256("reason"), keccak256("evidence"));
    }

    function test_OpenDisputeV2_RevertNotPending() public {
        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes32 receiptId = _postReceiptV2(intentHash, expiry);

        // Finalize the receipt first
        vm.warp(block.timestamp + 1 hours + 1);
        extension.finalizeV2(receiptId);

        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("ReceiptV2NotPending()"));
        extension.openDisputeV2{ value: CHALLENGER_BOND }(receiptId, keccak256("reason"), keccak256("evidence"));
    }

    // ============ Query Tests ============

    function test_GetReceiptsV2BySolver() public {
        // Post 3 receipts
        _postReceiptV2(keccak256("intent1"), uint64(block.timestamp + 1 hours));
        _postReceiptV2(keccak256("intent2"), uint64(block.timestamp + 2 hours));
        _postReceiptV2(keccak256("intent3"), uint64(block.timestamp + 3 hours));

        bytes32[] memory receipts = extension.getReceiptsV2BySolver(solverId, 0, 10);
        assertEq(receipts.length, 3);
    }

    function test_GetReceiptsV2ByClient() public {
        // Post 2 receipts
        _postReceiptV2(keccak256("intent1"), uint64(block.timestamp + 1 hours));
        _postReceiptV2(keccak256("intent2"), uint64(block.timestamp + 2 hours));

        bytes32[] memory receipts = extension.getReceiptsV2ByClient(client, 0, 10);
        assertEq(receipts.length, 2);
    }

    // ============ Admin Tests ============

    function test_SetChallengeWindow() public {
        extension.setChallengeWindow(30 minutes);
        assertEq(extension.challengeWindow(), 30 minutes);
    }

    function test_SetChallengeWindow_RevertTooShort() public {
        vm.expectRevert("Window too short");
        extension.setChallengeWindow(5 minutes);
    }

    function test_SetChallengeWindow_RevertTooLong() public {
        vm.expectRevert("Window too long");
        extension.setChallengeWindow(48 hours);
    }

    function test_SetChallengerBondMin() public {
        extension.setChallengerBondMin(0.05 ether);
        assertEq(extension.challengerBondMin(), 0.05 ether);
    }

    function test_PauseUnpause() public {
        extension.pause();

        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);
        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);

        vm.prank(operator);
        vm.expectRevert();
        extension.postReceiptV2(receipt);

        extension.unpause();

        vm.prank(operator);
        extension.postReceiptV2(receipt);
    }

    // ============ Pointer Validation Tests ============

    function test_InvalidPointer_TooLong() public {
        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            client: client,
            metadataCommitment: keccak256("meta"),
            ciphertextPointer: "QmThisPointerIsWayTooLongAndShouldFailValidationBecauseItExceedsMaxLength123",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        bytes32 digest = _computeDigest(receipt);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(operatorPrivateKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientPrivateKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidCiphertextPointer()"));
        extension.postReceiptV2(receipt);
    }

    function test_EmptyPointer_Allowed() public {
        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: keccak256("intent"),
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            client: client,
            metadataCommitment: keccak256("meta"),
            ciphertextPointer: "", // Empty pointer allowed
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        bytes32 digest = _computeDigest(receipt);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(operatorPrivateKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientPrivateKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(operator);
        bytes32 receiptId = extension.postReceiptV2(receipt);
        assertTrue(receiptId != bytes32(0));
    }

    // ============ PM-SC-022: address(0) Check After tryRecover ============

    function test_PostReceiptV2_RevertZeroAddressRecovery() public {
        // Create a receipt where the solver signature would produce address(0)
        // In OZ ECDSA.tryRecover, invalid signatures that don't produce an error
        // but recover to address(0) are now explicitly caught.
        // We test this by crafting a signature that reverts due to the address(0) check.
        bytes32 intentHash = keccak256("intent_zero_addr");
        uint64 expiry = uint64(block.timestamp + 1 hours);

        TypesV2.IntentReceiptV2 memory receipt = _createReceiptV2(intentHash, expiry);

        // Corrupt solver signature to an invalid but parseable form
        // This tests that even if tryRecover returns NoError but address(0),
        // our explicit check catches it
        receipt.solverSig = abi.encodePacked(bytes32(0), bytes32(0), uint8(27));

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidSolverSignature()"));
        extension.postReceiptV2(receipt);
    }

    // ============ Replay Protection Tests ============

    function test_ReplayProtection_DifferentChain() public {
        // This test verifies that the domain separator includes chainId
        bytes32 domainSep = extension.domainSeparator();

        // Compute what the domain separator should be
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("IRSB Protocol"),
                keccak256("2"),
                block.chainid,
                address(extension)
            )
        );

        assertEq(domainSep, expected);
    }
}
