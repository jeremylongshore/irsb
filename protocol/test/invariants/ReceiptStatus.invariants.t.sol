// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { Types } from "../../src/libraries/Types.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ReceiptStatusInvariants
/// @notice Invariant: receipt status can only move forward (Pending→Disputed→Finalized|Slashed)
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract ReceiptStatusInvariants
contract ReceiptStatusInvariants is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    SolverRegistry public registry;
    IntentReceiptHub public hub;
    ReceiptStatusHandler public handler;

    function setUp() public {
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        registry.setAuthorizedCaller(address(hub), true);

        handler = new ReceiptStatusHandler(registry, hub);
        targetContract(address(handler));
    }

    /// @notice Receipt status must never regress to a prior state
    function invariant_receiptStatusMonotonicity() public view {
        bytes32[] memory receiptIds = handler.getReceiptIds();

        for (uint256 i = 0; i < receiptIds.length; i++) {
            (, Types.ReceiptStatus currentStatus) = hub.getReceipt(receiptIds[i]);
            uint256 previousMax = handler.highWaterMark(receiptIds[i]);

            // Current status must be >= the highest status we've ever seen
            assertGe(
                uint256(currentStatus),
                previousMax,
                "Status regressed - monotonicity violation"
            );
        }
    }

    /// @notice Terminal states (Finalized, Slashed) must be permanent
    function invariant_terminalStatesPermanent() public view {
        bytes32[] memory receiptIds = handler.getReceiptIds();

        for (uint256 i = 0; i < receiptIds.length; i++) {
            (, Types.ReceiptStatus currentStatus) = hub.getReceipt(receiptIds[i]);
            uint256 hwm = handler.highWaterMark(receiptIds[i]);

            // If we ever saw Finalized or Slashed, current must still be that
            if (hwm >= uint256(Types.ReceiptStatus.Finalized)) {
                assertGe(uint256(currentStatus), uint256(Types.ReceiptStatus.Finalized), "Left terminal state");
            }
        }
    }
}

/// @notice Handler for receipt status invariant testing
contract ReceiptStatusHandler is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    SolverRegistry public registry;
    IntentReceiptHub public hub;

    bytes32[] public receiptIds;
    bytes32 public solverId;
    uint256 public operatorKey;
    address public operator;

    /// @notice Tracks the highest status ever seen for each receipt
    mapping(bytes32 => uint256) public highWaterMark;

    uint256 private nonce;

    constructor(SolverRegistry _registry, IntentReceiptHub _hub) {
        registry = _registry;
        hub = _hub;

        operatorKey = 0xBEEF;
        operator = vm.addr(operatorKey);
        vm.deal(operator, 100 ether);

        vm.prank(operator);
        solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: 1 ether }(solverId);
    }

    function postReceipt() public {
        nonce++;

        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256(abi.encode("intent", nonce)),
            constraintsHash: keccak256(abi.encode("constraints", nonce)),
            routeHash: keccak256(abi.encode("route", nonce)),
            outcomeHash: keccak256(abi.encode("outcome", nonce)),
            evidenceHash: keccak256(abi.encode("evidence", nonce)),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            solverSig: ""
        });

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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);
        receiptIds.push(receiptId);

        _updateHighWaterMark(receiptId);
    }

    function finalizeReceipt(uint256 index) public {
        if (receiptIds.length == 0) return;
        index = bound(index, 0, receiptIds.length - 1);
        bytes32 receiptId = receiptIds[index];

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        if (status != Types.ReceiptStatus.Pending) return;

        // Warp past challenge window
        vm.warp(block.timestamp + 2 hours);

        try hub.finalize(receiptId) {} catch {}

        _updateHighWaterMark(receiptId);
    }

    function openDispute(uint256 index) public {
        if (receiptIds.length == 0) return;
        index = bound(index, 0, receiptIds.length - 1);
        bytes32 receiptId = receiptIds[index];

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        if (status != Types.ReceiptStatus.Pending) return;

        address challenger = address(uint160(nonce + 0xCAFE));
        vm.deal(challenger, 1 ether);

        vm.prank(challenger);
        try hub.openDispute{ value: 0.01 ether }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence")) {}
        catch {}

        _updateHighWaterMark(receiptId);
    }

    function _updateHighWaterMark(bytes32 receiptId) internal {
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        uint256 current = uint256(status);
        if (current > highWaterMark[receiptId]) {
            highWaterMark[receiptId] = current;
        }
    }

    function getReceiptIds() external view returns (bytes32[] memory) {
        return receiptIds;
    }
}
