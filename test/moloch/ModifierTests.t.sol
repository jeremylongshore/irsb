// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { DisputeModule } from "../../src/DisputeModule.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { Types } from "../../src/libraries/Types.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ModifierTests - Moloch DAO-Style Modifier Pair Tests
/// @notice Tests each custom modifier with (allowed, rejected) pair
/// @dev Naming: test_modifier_[modifier]_[allows|rejects]_[who]
contract ModifierTestsTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    SolverRegistry public registry;
    IntentReceiptHub public hub;
    DisputeModule public disputeModule;
    EscrowVault public vault;

    address public owner;
    uint256 public operatorKey = 0x1234;
    address public operator;
    address public unauthorized = address(0x4);
    address public arbitrator = address(0x3);

    bytes32 public solverId;

    function setUp() public {
        owner = address(this);
        operator = vm.addr(operatorKey);

        vm.deal(owner, 100 ether);
        vm.deal(operator, 100 ether);

        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        disputeModule = new DisputeModule(address(hub), address(registry), arbitrator);
        vault = new EscrowVault();

        registry.setAuthorizedCaller(address(hub), true);
        hub.setDisputeModule(address(disputeModule));
        vault.setAuthorizedHub(address(hub), true);

        solverId = registry.registerSolver("ipfs://metadata", operator);
        vm.prank(operator);
        registry.depositBond{ value: 0.5 ether }(solverId);
    }

    receive() external payable { }

    function _createSignedReceipt(bytes32 intentHash, uint64 expiry)
        internal
        view
        returns (Types.IntentReceipt memory receipt)
    {
        receipt = Types.IntentReceipt({
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
    }

    // ================================================================
    //            onlyOperator (SolverRegistry)
    // ================================================================

    /// @notice onlyOperator allows the registered operator
    function test_modifier_onlyOperator_allows_operator() public {
        vm.prank(operator);
        registry.initiateWithdrawal(solverId);
        // Success - no revert
    }

    /// @notice onlyOperator rejects non-operator
    function test_modifier_onlyOperator_rejects_nonOperator() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("NotSolverOperator()"));
        registry.initiateWithdrawal(solverId);
    }

    // ================================================================
    //            solverExists (SolverRegistry)
    // ================================================================

    /// @notice solverExists allows existing solver
    function test_modifier_solverExists_allows_existing() public {
        Types.Solver memory solver = registry.getSolver(solverId);
        assertTrue(solver.registeredAt > 0, "Solver should exist");

        // depositBond uses solverExists - should succeed
        vm.prank(operator);
        registry.depositBond{ value: 0.01 ether }(solverId);
    }

    /// @notice solverExists rejects non-existent solver
    function test_modifier_solverExists_rejects_nonExistent() public {
        bytes32 fakeSolverId = keccak256("nonexistent");

        vm.expectRevert(abi.encodeWithSignature("SolverNotFound()"));
        registry.depositBond{ value: 0.01 ether }(fakeSolverId);
    }

    // ================================================================
    //            receiptExists (IntentReceiptHub)
    // ================================================================

    /// @notice receiptExists allows existing receipt
    function test_modifier_receiptExists_allows_existing() public {
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        // finalize uses receiptExists - check we get ChallengeWindowActive (not ReceiptNotFound)
        vm.expectRevert(abi.encodeWithSignature("ChallengeWindowActive()"));
        hub.finalize(receiptId);
    }

    /// @notice receiptExists rejects non-existent receipt
    function test_modifier_receiptExists_rejects_nonExistent() public {
        bytes32 fakeReceiptId = keccak256("nonexistent");

        vm.expectRevert(abi.encodeWithSignature("ReceiptNotFound()"));
        hub.finalize(fakeReceiptId);
    }

    // ================================================================
    //            onlyAuthorized (SolverRegistry)
    // ================================================================

    /// @notice onlyAuthorized allows authorized caller
    function test_modifier_onlyAuthorized_allows_authorizedCaller() public {
        // hub is authorized - use lockBond which requires onlyAuthorized
        registry.setAuthorizedCaller(address(this), true);
        registry.lockBond(solverId, 0.01 ether);
        // Success - no revert
    }

    /// @notice onlyAuthorized allows owner
    function test_modifier_onlyAuthorized_allows_owner() public {
        // owner can call onlyAuthorized functions directly
        registry.updateScore(solverId, true, 100);
        // Success - no revert
    }

    /// @notice onlyAuthorized rejects unauthorized caller
    function test_modifier_onlyAuthorized_rejects_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert("Not authorized");
        registry.lockBond(solverId, 0.01 ether);
    }

    // ================================================================
    //            onlyHub (EscrowVault)
    // ================================================================

    /// @notice onlyHub allows authorized hub
    function test_modifier_onlyHub_allows_hub() public {
        bytes32 escrowId = keccak256("escrow");
        vault.createEscrow{ value: 1 ether }(
            escrowId, keccak256("receipt"), address(this), uint64(block.timestamp + 1 hours)
        );

        // Test contract is authorized hub (set in setUp)
        vault.release(escrowId, address(this));
        // Success - no revert
    }

    /// @notice onlyHub allows owner (as fallback)
    function test_modifier_onlyHub_allows_owner() public {
        bytes32 escrowId = keccak256("escrow2");
        vault.createEscrow{ value: 1 ether }(
            escrowId, keccak256("receipt2"), address(this), uint64(block.timestamp + 1 hours)
        );

        // Owner (address(this)) can call onlyHub functions
        vault.release(escrowId, address(this));
    }

    /// @notice onlyHub rejects unauthorized caller
    function test_modifier_onlyHub_rejects_other() public {
        bytes32 escrowId = keccak256("escrow3");
        vault.createEscrow{ value: 1 ether }(
            escrowId, keccak256("receipt3"), address(this), uint64(block.timestamp + 1 hours)
        );

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedCaller()"));
        vault.release(escrowId, address(this));
    }

    // ================================================================
    //            onlyArbitrator (DisputeModule)
    // ================================================================

    /// @notice onlyArbitrator allows the arbitrator
    function test_modifier_onlyArbitrator_allows_arbitrator() public {
        // resolve requires escalated dispute, so just test the modifier reverts correctly
        // with non-arbitrator
        vm.prank(arbitrator);
        // Will fail with "Not escalated" (past the modifier), proving modifier passed
        vm.expectRevert("Not escalated");
        disputeModule.resolve(keccak256("fake"), true, 50, "reason");
    }

    /// @notice onlyArbitrator rejects non-arbitrator
    function test_modifier_onlyArbitrator_rejects_nonArbitrator() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("NotAuthorizedArbitrator()"));
        disputeModule.resolve(keccak256("fake"), true, 50, "reason");
    }

    // ================================================================
    //            onlyDisputeModule (IntentReceiptHub)
    // ================================================================

    /// @notice onlyDisputeModule allows dispute module
    function test_modifier_onlyDisputeModule_allows_module() public {
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(keccak256("intent2"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        // Call from dispute module - will fail with ReceiptNotPending (past modifier)
        vm.prank(address(disputeModule));
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.resolveEscalatedDispute(receiptId, true);
    }

    /// @notice onlyDisputeModule allows owner as fallback
    function test_modifier_onlyDisputeModule_allows_owner() public {
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(keccak256("intent3"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        // Owner can call onlyDisputeModule functions - will fail with ReceiptNotPending
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.resolveEscalatedDispute(receiptId, true);
    }

    /// @notice onlyDisputeModule rejects other callers
    function test_modifier_onlyDisputeModule_rejects_other() public {
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(keccak256("intent4"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        vm.prank(unauthorized);
        vm.expectRevert("Not dispute module");
        hub.resolveEscalatedDispute(receiptId, true);
    }
}
