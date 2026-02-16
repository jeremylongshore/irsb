// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { IEscrowVault } from "../../src/interfaces/IEscrowVault.sol";
import { Types } from "../../src/libraries/Types.sol";
import { VerificationHelpers } from "../helpers/VerificationHelpers.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title StateTransitions - Moloch DAO-Style State Verification Tests
/// @notice Verifies ALL fields change correctly during key state transitions
/// @dev Uses VerificationHelpers for comprehensive post-condition assertions
contract StateTransitionsTest is VerificationHelpers {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    SolverRegistry public registry;
    IntentReceiptHub public hub;
    EscrowVault public vault;

    address public owner;
    uint256 public operatorKey = 0x1234;
    address public operator;
    address public challenger = address(0x2);

    uint256 public constant MINIMUM_BOND = 0.1 ether;

    function setUp() public {
        owner = address(this);
        operator = vm.addr(operatorKey);

        vm.deal(owner, 100 ether);
        vm.deal(operator, 100 ether);
        vm.deal(challenger, 100 ether);

        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        vault = new EscrowVault();

        registry.setAuthorizedCaller(address(hub), true);
        registry.setAuthorizedCaller(address(this), true);
        vault.setAuthorizedHub(address(this), true);
    }

    receive() external payable { }

    // ============ Helpers ============

    function _createSignedReceipt(bytes32 solverId, bytes32 intentHash, uint64 expiry)
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
    //                  SOLVER REGISTRY TRANSITIONS
    // ================================================================

    /// @notice Verify ALL fields correct after registerSolver
    function test_stateTransition_registerSolver_allFieldsCorrect() public {
        uint256 solversBefore = registry.totalSolvers();

        bytes32 solverId = registry.registerSolver("ipfs://test", operator);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.operator, operator, "Operator mismatch");
        assertEq(solver.metadataURI, "ipfs://test", "Metadata mismatch");
        assertEq(solver.bondBalance, 0, "Bond should be 0");
        assertEq(solver.lockedBalance, 0, "Locked should be 0");
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive), "Should be Inactive");
        assertEq(solver.score.totalFills, 0, "Score should be zeroed");
        assertEq(solver.score.successfulFills, 0, "Score should be zeroed");
        assertEq(solver.score.disputesOpened, 0, "Score should be zeroed");
        assertEq(solver.score.disputesLost, 0, "Score should be zeroed");
        assertEq(solver.score.volumeProcessed, 0, "Score should be zeroed");
        assertEq(solver.score.totalSlashed, 0, "Score should be zeroed");
        assertEq(solver.registeredAt, uint64(block.timestamp), "RegisteredAt mismatch");
        assertEq(solver.lastActivityAt, uint64(block.timestamp), "LastActivityAt mismatch");
        assertEq(registry.totalSolvers(), solversBefore + 1, "Total solvers mismatch");
        assertEq(registry.getSolverByOperator(operator), solverId, "Operator mapping mismatch");
    }

    /// @notice Verify bond deposit triggers activation at threshold
    function test_stateTransition_depositBond_activationThreshold() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        uint256 totalBondedBefore = registry.totalBonded();

        // Deposit below minimum — stays Inactive
        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND - 1 }(solverId);

        verifyPostDeposit(
            registry, solverId, MINIMUM_BOND - 1, Types.SolverStatus.Inactive, totalBondedBefore + MINIMUM_BOND - 1
        );

        // Deposit 1 more wei — activates
        vm.prank(operator);
        registry.depositBond{ value: 1 }(solverId);

        verifyPostDeposit(
            registry, solverId, MINIMUM_BOND, Types.SolverStatus.Active, totalBondedBefore + MINIMUM_BOND
        );
    }

    /// @notice Verify ALL fields after slash from locked balance
    function test_stateTransition_slash_fromLocked_allFieldsCorrect() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: 0.5 ether }(solverId);

        // Lock 0.2 ETH
        registry.lockBond(solverId, 0.2 ether);

        uint256 totalBondedBefore = registry.totalBonded();
        uint256 slashAmount = 0.15 ether;
        address recipient = address(0x7);

        // Slash 0.15 ETH (all from locked)
        registry.slash(solverId, slashAmount, bytes32(uint256(1)), Types.DisputeReason.Timeout, recipient);

        verifyPostSlash(
            registry,
            solverId,
            0.3 ether, // bondBalance unchanged (slash was from locked)
            0.05 ether, // lockedBalance: 0.2 - 0.15
            1, // disputesLost
            Types.SolverStatus.Active // still above minimum
        );
        assertEq(registry.totalBonded(), totalBondedBefore - slashAmount, "Total bonded mismatch");
        assertEq(recipient.balance, slashAmount, "Recipient didn't receive slash");
    }

    /// @notice Verify slash spills from locked to available
    function test_stateTransition_slash_spillToAvailable() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: 0.5 ether }(solverId);

        // Lock 0.1 ETH
        registry.lockBond(solverId, 0.1 ether);
        // bondBalance = 0.4, lockedBalance = 0.1

        address recipient = address(0x8);
        uint256 slashAmount = 0.15 ether; // More than locked

        registry.slash(solverId, slashAmount, bytes32(uint256(2)), Types.DisputeReason.Timeout, recipient);

        // 0.1 from locked (now 0), 0.05 from available (0.4 → 0.35)
        verifyPostSlash(registry, solverId, 0.35 ether, 0, 1, Types.SolverStatus.Active);
    }

    // ================================================================
    //                  RECEIPT HUB TRANSITIONS
    // ================================================================

    /// @notice Verify ALL fields after posting and finalizing a receipt
    function test_stateTransition_finalize_allFieldsCorrect() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        bytes32 intentHash = keccak256("intent1");
        uint64 expiry = uint64(block.timestamp + 1 hours);
        Types.IntentReceipt memory receipt = _createSignedReceipt(solverId, intentHash, expiry);

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        // Verify Pending state
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Pending), "Should be Pending");
        assertEq(hub.totalReceipts(), 1, "Receipt count mismatch");

        // Warp past challenge window and finalize
        vm.warp(block.timestamp + 2 hours);
        hub.finalize(receiptId);

        verifyPostFinalization(hub, registry, receiptId, solverId, Types.ReceiptStatus.Finalized, 1);

        // Solver score should be updated
        Types.IntentScore memory score = registry.getIntentScore(solverId);
        assertEq(score.successfulFills, 1, "Successful fills should increment");
    }

    /// @notice Verify dispute resolution (slash path) full state
    function test_stateTransition_resolveDeterministic_slashPath() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: 0.5 ether }(solverId);

        bytes32 intentHash = keccak256("intent2");
        uint64 expiry = uint64(block.timestamp + 30 minutes);
        Types.IntentReceipt memory receipt = _createSignedReceipt(solverId, intentHash, expiry);

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        // Open dispute
        uint256 challengerBond = hub.challengerBondMin();
        vm.prank(challenger);
        hub.openDispute{ value: challengerBond }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        verifyPostDispute(hub, receiptId, Types.ReceiptStatus.Disputed, challenger, challengerBond);

        // Warp past expiry, no settlement proof → slash
        vm.warp(expiry + 1);
        hub.resolveDeterministic(receiptId);

        (, Types.ReceiptStatus finalStatus) = hub.getReceipt(receiptId);
        assertEq(uint256(finalStatus), uint256(Types.ReceiptStatus.Slashed), "Should be Slashed");
        assertTrue(hub.totalSlashed() > 0, "Slash amount should be tracked");
        assertEq(hub.getChallengerBond(receiptId), 0, "Challenger bond should be zeroed after return");
    }

    // ================================================================
    //                  ESCROW VAULT TRANSITIONS
    // ================================================================

    /// @notice Verify full escrow lifecycle: create → release
    function test_stateTransition_escrowCreate_release_allFieldsCorrect() public {
        bytes32 escrowId = keccak256("escrow1");
        bytes32 receiptId = keccak256("receipt1");
        address depositor = address(0x900);
        uint64 deadline = uint64(block.timestamp + 1 hours);
        uint256 amount = 1 ether;

        uint256 totalEscrowsBefore = vault.totalEscrows();

        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);

        // Verify Active state
        verifyEscrowState(vault, escrowId, IEscrowVault.EscrowStatus.Active, amount);
        assertEq(vault.totalEscrows(), totalEscrowsBefore + 1, "Total escrows mismatch");
        assertEq(vault.getEscrowByReceipt(receiptId), escrowId, "Receipt mapping mismatch");

        IEscrowVault.Escrow memory escrow = vault.getEscrow(escrowId);
        assertEq(escrow.receiptId, receiptId, "Receipt ID mismatch");
        assertEq(escrow.depositor, depositor, "Depositor mismatch");
        assertEq(escrow.token, address(0), "Token should be native");
        assertEq(escrow.createdAt, uint64(block.timestamp), "CreatedAt mismatch");
        assertEq(escrow.deadline, deadline, "Deadline mismatch");

        // Release to a non-precompile address
        address recipient = address(0xBEEF);
        uint256 releasedBefore = vault.totalReleasedNative();

        vault.release(escrowId, recipient);

        verifyEscrowState(vault, escrowId, IEscrowVault.EscrowStatus.Released, 0);
        assertEq(recipient.balance, amount, "Recipient should receive funds");
        assertEq(vault.totalReleasedNative(), releasedBefore + amount, "Released tracker mismatch");
    }

    /// @notice Verify full escrow lifecycle: create → refund
    function test_stateTransition_escrowCreate_refund_allFieldsCorrect() public {
        bytes32 escrowId = keccak256("escrow2");
        bytes32 receiptId = keccak256("receipt2");
        address depositor = address(0xB00B);
        vm.deal(depositor, 0); // Ensure starts at 0
        uint64 deadline = uint64(block.timestamp + 1 hours);
        uint256 amount = 2 ether;

        vault.createEscrow{ value: amount }(escrowId, receiptId, depositor, deadline);
        verifyEscrowState(vault, escrowId, IEscrowVault.EscrowStatus.Active, amount);

        uint256 refundedBefore = vault.totalRefundedNative();

        vault.refund(escrowId);

        verifyEscrowState(vault, escrowId, IEscrowVault.EscrowStatus.Refunded, 0);
        assertEq(depositor.balance, amount, "Depositor should receive refund");
        assertEq(vault.totalRefundedNative(), refundedBefore + amount, "Refunded tracker mismatch");
    }
}
