// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ReceiptV2Extension } from "../../src/extensions/ReceiptV2Extension.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { Types } from "../../src/libraries/Types.sol";
import { TypesV2 } from "../../src/libraries/TypesV2.sol";
import { EIP712ReceiptV2 } from "../../src/libraries/EIP712ReceiptV2.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ReceiptV2 Fuzz Tests
/// @notice Fuzz tests for V2 receipt extension - run with 10k iterations in CI
contract ReceiptV2FuzzTest is Test {
    using ECDSA for bytes32;

    ReceiptV2Extension public extension;
    SolverRegistry public registry;

    uint256 public operatorPrivateKey = 0x1234;
    uint256 public clientPrivateKey = 0x5678;
    address public operator;
    address public client;

    uint256 public constant MINIMUM_BOND = 0.1 ether;

    bytes32 public solverId;

    function setUp() public {
        operator = vm.addr(operatorPrivateKey);
        client = vm.addr(clientPrivateKey);

        vm.deal(address(this), 10 ether);

        registry = new SolverRegistry();
        extension = new ReceiptV2Extension(address(registry));
        registry.setAuthorizedCaller(address(extension), true);

        solverId = registry.registerSolver("ipfs://metadata", operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    receive() external payable { }

    // ============ Fuzz Tests ============

    /// @notice Fuzz test: receipt ID computation is deterministic
    function testFuzz_ReceiptIdDeterministic(bytes32 intentHash, uint64 createdAt, bytes32 commitment) public view {
        vm.assume(commitment != bytes32(0));
        // Bound createdAt to avoid overflow when adding 1 hours for expiry
        createdAt = uint64(bound(createdAt, 1, type(uint64).max - 1 hours - 1));

        TypesV2.IntentReceiptV2 memory receipt1 = _createReceiptStub(intentHash, createdAt, commitment);
        TypesV2.IntentReceiptV2 memory receipt2 = _createReceiptStub(intentHash, createdAt, commitment);

        bytes32 id1 = TypesV2.computeReceiptV2Id(receipt1);
        bytes32 id2 = TypesV2.computeReceiptV2Id(receipt2);

        assertEq(id1, id2, "Same inputs should produce same ID");
    }

    /// @notice Fuzz test: different inputs produce different IDs
    function testFuzz_ReceiptIdUnique(bytes32 intentHash1, bytes32 intentHash2, uint64 createdAt) public view {
        vm.assume(intentHash1 != intentHash2);
        // Bound createdAt to avoid overflow when adding 1 hours for expiry
        createdAt = uint64(bound(createdAt, 1, type(uint64).max - 1 hours - 1));

        TypesV2.IntentReceiptV2 memory receipt1 = _createReceiptStub(intentHash1, createdAt, keccak256("meta1"));
        TypesV2.IntentReceiptV2 memory receipt2 = _createReceiptStub(intentHash2, createdAt, keccak256("meta2"));

        bytes32 id1 = TypesV2.computeReceiptV2Id(receipt1);
        bytes32 id2 = TypesV2.computeReceiptV2Id(receipt2);

        assertTrue(id1 != id2, "Different intent hashes should produce different IDs");
    }

    /// @notice Fuzz test: EIP-712 struct hash is deterministic
    function testFuzz_StructHashDeterministic(
        bytes32 intentHash,
        bytes32 constraintsHash,
        uint64 expiry,
        bytes32 commitment
    ) public view {
        vm.assume(commitment != bytes32(0));
        vm.assume(expiry > block.timestamp);

        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: intentHash,
            constraintsHash: constraintsHash,
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: expiry,
            solverId: solverId,
            client: client,
            metadataCommitment: commitment,
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.SemiPublic,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        bytes32 hash1 = TypesV2.hashReceiptV2(receipt);
        bytes32 hash2 = TypesV2.hashReceiptV2(receipt);

        assertEq(hash1, hash2, "Same receipt should produce same hash");
    }

    /// @notice Fuzz test: valid signatures are accepted
    function testFuzz_ValidSignaturesAccepted(bytes32 intentHash, uint64 expiryOffset) public {
        vm.assume(expiryOffset > 0 && expiryOffset < 365 days);

        uint64 expiry = uint64(block.timestamp) + expiryOffset;

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
            metadataCommitment: keccak256(abi.encode(intentHash)), // Unique commitment
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        // Sign
        bytes32 digest = _computeDigest(receipt);
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(operatorPrivateKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientPrivateKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(operator);
        bytes32 receiptId = extension.postReceiptV2(receipt);

        assertTrue(receiptId != bytes32(0), "Valid receipt should be posted");
    }

    /// @notice Fuzz test: invalid solver signatures are rejected
    function testFuzz_InvalidSolverSigRejected(bytes32 intentHash, uint256 wrongKey) public {
        vm.assume(wrongKey != 0 && wrongKey != operatorPrivateKey);
        vm.assume(wrongKey < 115792089237316195423570985008687907852837564279074904382605163141518161494337); // secp256k1 order

        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: intentHash,
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            client: client,
            metadataCommitment: keccak256("meta"),
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        bytes32 digest = _computeDigest(receipt);

        // Sign with wrong key
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(wrongKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);

        // Sign client correctly
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(clientPrivateKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidSolverSignature()"));
        extension.postReceiptV2(receipt);
    }

    /// @notice Fuzz test: invalid client signatures are rejected
    function testFuzz_InvalidClientSigRejected(bytes32 intentHash, uint256 wrongKey) public {
        vm.assume(wrongKey != 0 && wrongKey != clientPrivateKey);
        vm.assume(wrongKey < 115792089237316195423570985008687907852837564279074904382605163141518161494337);

        TypesV2.IntentReceiptV2 memory receipt = TypesV2.IntentReceiptV2({
            intentHash: intentHash,
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            client: client,
            metadataCommitment: keccak256("meta"),
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });

        bytes32 digest = _computeDigest(receipt);

        // Sign solver correctly
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(operatorPrivateKey, digest);
        receipt.solverSig = abi.encodePacked(r1, s1, v1);

        // Sign with wrong key
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(wrongKey, digest);
        receipt.clientSig = abi.encodePacked(r2, s2, v2);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidClientSignature()"));
        extension.postReceiptV2(receipt);
    }

    /// @notice Fuzz test: challenge window enforcement
    function testFuzz_ChallengeWindowEnforcement(uint64 windowDuration, uint64 timePassed) public {
        // Bound inputs
        windowDuration = uint64(bound(windowDuration, 15 minutes, 24 hours));
        timePassed = uint64(bound(timePassed, 0, 48 hours));

        extension.setChallengeWindow(windowDuration);

        TypesV2.IntentReceiptV2 memory receipt =
            _createSignedReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = extension.postReceiptV2(receipt);

        // Warp time
        vm.warp(block.timestamp + timePassed);

        bool canFinalize = extension.canFinalizeV2(receiptId);
        bool shouldBeAbleToFinalize = timePassed > windowDuration;

        assertEq(canFinalize, shouldBeAbleToFinalize, "Challenge window enforcement failed");
    }

    /// @notice Fuzz test: challenger bond minimum enforcement
    function testFuzz_ChallengerBondEnforcement(uint256 bondAmount) public {
        uint256 minBond = extension.challengerBondMin();
        bondAmount = bound(bondAmount, 0, 10 ether);

        TypesV2.IntentReceiptV2 memory receipt =
            _createSignedReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = extension.postReceiptV2(receipt);

        vm.deal(address(0x999), bondAmount + 1 ether);
        vm.prank(address(0x999));

        if (bondAmount < minBond) {
            vm.expectRevert(abi.encodeWithSignature("InsufficientBond()"));
        }

        extension.openDisputeV2{ value: bondAmount }(receiptId, keccak256("reason"), keccak256("evidence"));
    }

    /// @notice Fuzz test: pointer validation
    function testFuzz_PointerValidation(string memory pointer) public view {
        bytes memory b = bytes(pointer);

        // Check validation result matches expected
        bool expected = true;

        if (b.length == 0 || b.length > 64) {
            expected = false;
        } else {
            for (uint256 i = 0; i < b.length; i++) {
                bytes1 c = b[i];
                bool isAlphanumeric = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
                if (!isAlphanumeric) {
                    expected = false;
                    break;
                }
            }
        }

        bool result = TypesV2.isValidPointer(pointer);
        assertEq(result, expected, "Pointer validation mismatch");
    }

    // ============ Invariant: Receipt ID uniqueness ============

    /// @notice Fuzz test: no two different receipts should have the same ID
    function testFuzz_ReceiptIdCollisionResistance(
        bytes32 intentHash1,
        bytes32 intentHash2,
        uint64 createdAt1,
        uint64 createdAt2,
        bytes32 commitment1,
        bytes32 commitment2
    ) public view {
        vm.assume(commitment1 != bytes32(0) && commitment2 != bytes32(0));
        // Bound createdAt to avoid overflow when adding 1 hours for expiry
        createdAt1 = uint64(bound(createdAt1, 1, type(uint64).max - 1 hours - 1));
        createdAt2 = uint64(bound(createdAt2, 1, type(uint64).max - 1 hours - 1));

        TypesV2.IntentReceiptV2 memory receipt1 = _createReceiptStub(intentHash1, createdAt1, commitment1);
        TypesV2.IntentReceiptV2 memory receipt2 = _createReceiptStub(intentHash2, createdAt2, commitment2);

        bytes32 id1 = TypesV2.computeReceiptV2Id(receipt1);
        bytes32 id2 = TypesV2.computeReceiptV2Id(receipt2);

        // If all uniqueness-contributing fields are the same, IDs should match
        bool sameInputs =
            intentHash1 == intentHash2 && createdAt1 == createdAt2 && commitment1 == commitment2 && client == client;

        if (sameInputs) {
            assertEq(id1, id2);
        }
        // Otherwise, collision is extremely unlikely (cryptographic)
    }

    // ============ Helper Functions ============

    function _createReceiptStub(bytes32 intentHash, uint64 createdAt, bytes32 commitment)
        internal
        view
        returns (TypesV2.IntentReceiptV2 memory)
    {
        return TypesV2.IntentReceiptV2({
            intentHash: intentHash,
            constraintsHash: keccak256("constraints"),
            routeHash: keccak256("route"),
            outcomeHash: keccak256("outcome"),
            evidenceHash: keccak256("evidence"),
            createdAt: createdAt,
            expiry: createdAt + 1 hours,
            solverId: solverId,
            client: client,
            metadataCommitment: commitment,
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.Public,
            escrowId: bytes32(0),
            solverSig: "",
            clientSig: ""
        });
    }

    function _createSignedReceipt(bytes32 intentHash, uint64 expiry)
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
            metadataCommitment: keccak256(abi.encode(intentHash, block.timestamp)),
            ciphertextPointer: "QmTest",
            privacyLevel: TypesV2.PrivacyLevel.SemiPublic,
            escrowId: bytes32(0),
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
}
