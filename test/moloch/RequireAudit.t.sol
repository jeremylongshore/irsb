// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { DisputeModule } from "../../src/DisputeModule.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { WalletDelegate } from "../../src/delegation/WalletDelegate.sol";
import { X402Facilitator } from "../../src/X402Facilitator.sol";
import { Types } from "../../src/libraries/Types.sol";
import { TypesDelegation } from "../../src/libraries/TypesDelegation.sol";
import { IWalletDelegate } from "../../src/interfaces/IWalletDelegate.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { MockETHRejecter } from "../helpers/MockETHRejecter.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title RequireAudit - Moloch DAO-Style Require/Revert Coverage
/// @notice Triggers every untested require/revert path across IRSB contracts
/// @dev Naming: test_requireFail_[Contract]_[function]_[reason]
contract RequireAuditTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Contracts ============

    SolverRegistry public registry;
    IntentReceiptHub public hub;
    DisputeModule public disputeModule;
    EscrowVault public vault;
    WalletDelegate public walletDelegate;
    X402Facilitator public facilitator;
    MockERC20 public usdc;
    MockETHRejecter public rejecter;

    // ============ Actors ============

    address public owner;
    uint256 public operatorKey = 0x1234;
    address public operator;
    address public challenger = address(0x2);
    address public arbitrator = address(0x3);
    address public unauthorized = address(0x4);

    uint256 public constant MINIMUM_BOND = 0.1 ether;

    bytes32 public solverId;

    // ============ Setup ============

    function setUp() public {
        owner = address(this);
        operator = vm.addr(operatorKey);

        vm.deal(owner, 100 ether);
        vm.deal(operator, 100 ether);
        vm.deal(challenger, 100 ether);
        vm.deal(arbitrator, 10 ether);

        // Deploy core contracts
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        disputeModule = new DisputeModule(address(hub), address(registry), arbitrator);
        vault = new EscrowVault();
        walletDelegate = new WalletDelegate();
        facilitator = new X402Facilitator(address(walletDelegate), address(hub));
        usdc = new MockERC20("USD Coin", "USDC", 6);
        rejecter = new MockETHRejecter();

        // Wire up
        registry.setAuthorizedCaller(address(hub), true);
        hub.setDisputeModule(address(disputeModule));
        vault.setAuthorizedHub(address(hub), true);

        // Register and activate solver
        solverId = registry.registerSolver("ipfs://metadata", operator);
        registry.depositBond{ value: 0.5 ether }(solverId);
    }

    receive() external payable { }

    // ============ Helpers ============

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

    function _postReceipt(bytes32 intentHash, uint64 expiry) internal returns (bytes32 receiptId) {
        Types.IntentReceipt memory receipt = _createSignedReceipt(intentHash, expiry);
        vm.prank(operator);
        receiptId = hub.postReceipt(receipt);
    }

    function _openDispute(bytes32 receiptId) internal {
        vm.prank(challenger);
        hub.openDispute{ value: hub.challengerBondMin() }(
            receiptId, Types.DisputeReason.Timeout, keccak256("evidence")
        );
    }

    // ================================================================
    //                     SOLVER REGISTRY TESTS
    // ================================================================

    /// @notice depositBond reverts when caller is not operator or owner
    function test_requireFail_SolverRegistry_depositBond_unauthorizedDepositor() public {
        vm.deal(unauthorized, 1 ether);
        vm.prank(unauthorized);
        vm.expectRevert("Not authorized to deposit");
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    /// @notice withdrawBond reverts when amount exceeds available balance
    function test_requireFail_SolverRegistry_withdrawBond_insufficientBond() public {
        vm.startPrank(operator);
        registry.initiateWithdrawal(solverId);
        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBond()"));
        registry.withdrawBond(solverId, 100 ether); // way more than deposited
        vm.stopPrank();
    }

    /// @notice withdrawBond reverts on ETH transfer to rejecting contract
    function test_requireFail_SolverRegistry_withdrawBond_transferFailed() public {
        // Register solver with rejecter as operator
        address rejecterAddr = address(rejecter);
        bytes32 rejecterId = registry.registerSolver("ipfs://rejecter", rejecterAddr);
        registry.depositBond{ value: 0.2 ether }(rejecterId);

        // Initiate withdrawal as rejecter
        vm.prank(rejecterAddr);
        registry.initiateWithdrawal(rejecterId);

        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(rejecterAddr);
        vm.expectRevert("Transfer failed");
        registry.withdrawBond(rejecterId, 0.1 ether);
    }

    /// @notice slash reverts when total bond is insufficient
    function test_requireFail_SolverRegistry_slash_insufficientTotalBond() public {
        // Lock some bond first
        registry.setAuthorizedCaller(address(this), true);
        registry.lockBond(solverId, 0.1 ether);

        // Try to slash more than total (locked + available)
        vm.expectRevert("Insufficient total bond");
        registry.slash(solverId, 10 ether, bytes32(uint256(1)), Types.DisputeReason.Timeout, address(0x5));
    }

    /// @notice slash reverts on ETH transfer to rejecting recipient
    function test_requireFail_SolverRegistry_slash_transferFailed() public {
        registry.setAuthorizedCaller(address(this), true);
        registry.lockBond(solverId, 0.1 ether);

        vm.expectRevert("Slash transfer failed");
        registry.slash(solverId, 0.05 ether, bytes32(uint256(1)), Types.DisputeReason.Timeout, address(rejecter));
    }

    /// @notice unjailSolver reverts when called on Active solver
    function test_requireFail_SolverRegistry_unjailSolver_notJailed_active() public {
        // solver is Active
        vm.expectRevert("Not jailed");
        registry.unjailSolver(solverId);
    }

    /// @notice unjailSolver reverts when called on Banned solver
    function test_requireFail_SolverRegistry_unjailSolver_notJailed_banned() public {
        registry.banSolver(solverId);

        vm.expectRevert("Not jailed");
        registry.unjailSolver(solverId);
    }

    /// @notice setSolverKey reverts when new operator is already registered
    function test_requireFail_SolverRegistry_setSolverKey_alreadyRegistered() public {
        address operator2 = address(0x10);
        registry.registerSolver("ipfs://other", operator2);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("SolverAlreadyRegistered()"));
        registry.setSolverKey(solverId, operator2);
    }

    /// @notice setSolverKey reverts when new operator is zero address
    function test_requireFail_SolverRegistry_setSolverKey_zeroAddress() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("InvalidOperatorAddress()"));
        registry.setSolverKey(solverId, address(0));
    }

    /// @notice registerSolver emits exact EnforcedPause error when paused
    function test_requireFail_SolverRegistry_registerSolver_paused() public {
        registry.pause();

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        registry.registerSolver("ipfs://new", address(0x20));
    }

    /// @notice initiateWithdrawal reverts when bond is locked
    function test_requireFail_SolverRegistry_initiateWithdrawal_bondLocked() public {
        registry.setAuthorizedCaller(address(this), true);
        registry.lockBond(solverId, 0.1 ether);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSignature("BondLocked()"));
        registry.initiateWithdrawal(solverId);
    }

    /// @notice setAuthorizedCaller reverts for non-owner
    function test_requireFail_SolverRegistry_setAuthorizedCaller_nonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        registry.setAuthorizedCaller(unauthorized, true);
    }

    /// @notice updateScore reverts for non-authorized caller
    function test_requireFail_SolverRegistry_updateScore_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert("Not authorized");
        registry.updateScore(solverId, true, 100);
    }

    // ================================================================
    //                     INTENT RECEIPT HUB TESTS
    // ================================================================

    /// @notice batchPostReceipts reverts on empty array
    function test_requireFail_IntentReceiptHub_batchPostReceipts_emptyBatch() public {
        Types.IntentReceipt[] memory empty = new Types.IntentReceipt[](0);

        vm.prank(operator);
        vm.expectRevert("Empty batch");
        hub.batchPostReceipts(empty);
    }

    /// @notice batchPostReceipts reverts when array exceeds MAX_BATCH_SIZE (51)
    function test_requireFail_IntentReceiptHub_batchPostReceipts_batchTooLarge() public {
        Types.IntentReceipt[] memory big = new Types.IntentReceipt[](51);

        vm.prank(operator);
        vm.expectRevert("Batch too large");
        hub.batchPostReceipts(big);
    }

    /// @notice openDispute reverts on non-existent receipt ID
    function test_requireFail_IntentReceiptHub_openDispute_receiptNotFound() public {
        bytes32 fakeReceiptId = keccak256("nonexistent");
        uint256 bondMin = hub.challengerBondMin();

        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotFound()"));
        hub.openDispute{ value: bondMin }(
            fakeReceiptId, Types.DisputeReason.Timeout, keccak256("evidence")
        );
    }

    /// @notice resolveEscalatedDispute reverts for non-dispute-module caller
    function test_requireFail_IntentReceiptHub_resolveEscalatedDispute_notDisputeModule() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(unauthorized);
        vm.expectRevert("Not dispute module");
        hub.resolveEscalatedDispute(receiptId, true);
    }

    /// @notice resolveEscalatedDispute reverts when dispute is already resolved
    function test_requireFail_IntentReceiptHub_resolveEscalatedDispute_alreadyResolved() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));
        _openDispute(receiptId);

        // Resolve via deterministic first
        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Try to resolve again via dispute module (owner can act as disputeModule)
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.resolveEscalatedDispute(receiptId, true);
    }

    /// @notice sweepForfeitedBonds reverts on failing treasury transfer
    function test_requireFail_IntentReceiptHub_sweepForfeitedBonds_transferFailed() public {
        // Create forfeited bonds
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 30 minutes));
        vm.prank(operator);
        hub.submitSettlementProof(receiptId, keccak256("proof"));
        _openDispute(receiptId);
        vm.warp(block.timestamp + 31 minutes);
        hub.resolveDeterministic(receiptId);

        // Sweep to rejecter
        vm.expectRevert(abi.encodeWithSignature("SweepTransferFailed()"));
        hub.sweepForfeitedBonds(address(rejecter));
    }

    /// @notice setChallengeWindow boundary: 14m59s fails
    function test_requireFail_IntentReceiptHub_setChallengeWindow_tooShort() public {
        vm.expectRevert("Window too short");
        hub.setChallengeWindow(14 minutes + 59 seconds);
    }

    /// @notice setChallengeWindow boundary: 24h+1s fails
    function test_requireFail_IntentReceiptHub_setChallengeWindow_tooLong() public {
        vm.expectRevert("Window too long");
        hub.setChallengeWindow(24 hours + 1 seconds);
    }

    /// @notice finalize reverts on non-existent receipt
    function test_requireFail_IntentReceiptHub_finalize_receiptNotFound() public {
        bytes32 fakeId = keccak256("nonexistent");
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotFound()"));
        hub.finalize(fakeId);
    }

    /// @notice resolveEscalatedDispute reverts on receipt not in Disputed status
    function test_requireFail_IntentReceiptHub_resolveEscalatedDispute_notDisputed() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));

        // Try to resolve escalated dispute on Pending receipt (from disputeModule/owner)
        vm.expectRevert(abi.encodeWithSignature("ReceiptNotPending()"));
        hub.resolveEscalatedDispute(receiptId, true);
    }

    // ================================================================
    //                     DISPUTE MODULE TESTS
    // ================================================================

    /// @notice resolve reverts when dispute is not escalated
    function test_requireFail_DisputeModule_resolve_notEscalated() public {
        bytes32 receiptId = _postReceipt(keccak256("intent"), uint64(block.timestamp + 1 hours));
        _openDispute(receiptId);

        vm.prank(arbitrator);
        vm.expectRevert("Not escalated");
        disputeModule.resolve(receiptId, true, 50, "reason");
    }

    /// @notice setArbitrator reverts on zero address
    function test_requireFail_DisputeModule_setArbitrator_zeroAddress() public {
        vm.expectRevert("Zero address");
        disputeModule.setArbitrator(address(0));
    }

    /// @notice setTreasury reverts on zero address
    function test_requireFail_DisputeModule_setTreasury_zeroAddress() public {
        vm.expectRevert("Zero address");
        disputeModule.setTreasury(address(0));
    }

    /// @notice withdrawFees reverts when nothing to withdraw
    function test_requireFail_DisputeModule_withdrawFees_noFees() public {
        vm.expectRevert(abi.encodeWithSignature("NoFeesToWithdraw()"));
        disputeModule.withdrawFees();
    }

    /// @notice resolve reverts for non-arbitrator caller
    function test_requireFail_DisputeModule_resolve_notArbitrator() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("NotAuthorizedArbitrator()"));
        disputeModule.resolve(keccak256("fake"), true, 50, "reason");
    }

    // ================================================================
    //                     ESCROW VAULT TESTS
    // ================================================================

    /// @notice release reverts on non-existent escrow
    function test_requireFail_EscrowVault_release_escrowNotFound() public {
        bytes32 fakeEscrowId = keccak256("nonexistent");

        vm.expectRevert(abi.encodeWithSignature("EscrowNotFound()"));
        vault.release(fakeEscrowId, address(0x5));
    }

    /// @notice refund reverts on non-existent escrow
    function test_requireFail_EscrowVault_refund_escrowNotFound() public {
        bytes32 fakeEscrowId = keccak256("nonexistent");

        vm.expectRevert(abi.encodeWithSignature("EscrowNotFound()"));
        vault.refund(fakeEscrowId);
    }

    /// @notice emergencyWithdraw reverts with zero address
    function test_requireFail_EscrowVault_emergencyWithdraw_zeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("TransferFailed()"));
        vault.emergencyWithdraw(address(0), 1 ether, address(0));
    }

    /// @notice emergencyWithdraw reverts on failed ETH transfer
    function test_requireFail_EscrowVault_emergencyWithdraw_transferFailed() public {
        vm.deal(address(vault), 1 ether);

        vm.expectRevert(abi.encodeWithSignature("TransferFailed()"));
        vault.emergencyWithdraw(address(0), 1 ether, address(rejecter));
    }

    /// @notice release reverts on ETH transfer to rejecting recipient
    function test_requireFail_EscrowVault_release_transferFailed() public {
        bytes32 escrowId = keccak256("escrow1");
        bytes32 receiptId = keccak256("receipt1");

        vault.createEscrow{ value: 1 ether }(escrowId, receiptId, address(this), uint64(block.timestamp + 1 hours));

        vm.expectRevert(abi.encodeWithSignature("TransferFailed()"));
        vault.release(escrowId, address(rejecter));
    }

    /// @notice refund reverts on ETH transfer to rejecting depositor
    function test_requireFail_EscrowVault_refund_transferFailed() public {
        bytes32 escrowId = keccak256("escrow2");
        bytes32 receiptId = keccak256("receipt2");

        // Create escrow with rejecter as depositor
        vault.createEscrow{ value: 1 ether }(escrowId, receiptId, address(rejecter), uint64(block.timestamp + 1 hours));

        vm.expectRevert(abi.encodeWithSignature("TransferFailed()"));
        vault.refund(escrowId);
    }

    /// @notice release reverts with zero address recipient
    function test_requireFail_EscrowVault_release_zeroRecipient() public {
        bytes32 escrowId = keccak256("escrow3");
        bytes32 receiptId = keccak256("receipt3");

        vault.createEscrow{ value: 1 ether }(escrowId, receiptId, address(this), uint64(block.timestamp + 1 hours));

        vm.expectRevert(abi.encodeWithSignature("TransferFailed()"));
        vault.release(escrowId, address(0));
    }

    /// @notice release/refund revert on non-active (already released) escrow
    function test_requireFail_EscrowVault_release_escrowNotActive() public {
        bytes32 escrowId = keccak256("escrow4");
        bytes32 receiptId = keccak256("receipt4");

        vault.createEscrow{ value: 1 ether }(escrowId, receiptId, address(this), uint64(block.timestamp + 1 hours));
        vault.release(escrowId, address(this));

        vm.expectRevert(abi.encodeWithSignature("EscrowNotActive()"));
        vault.release(escrowId, address(this));
    }

    /// @notice createEscrow reverts with zero value
    function test_requireFail_EscrowVault_createEscrow_invalidAmount() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        vault.createEscrow(keccak256("e"), keccak256("r"), address(this), uint64(block.timestamp + 1));
    }

    /// @notice createEscrow reverts with zero receiptId
    function test_requireFail_EscrowVault_createEscrow_invalidReceiptId() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidReceiptId()"));
        vault.createEscrow{ value: 1 ether }(keccak256("e"), bytes32(0), address(this), uint64(block.timestamp + 1));
    }

    /// @notice createEscrow reverts when deadline is in the past
    function test_requireFail_EscrowVault_createEscrow_invalidDeadline() public {
        vm.warp(1000);
        vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
        vault.createEscrow{ value: 1 ether }(
            keccak256("e"), keccak256("r"), address(this), uint64(block.timestamp)
        );
    }

    /// @notice Unauthorized caller cannot release escrow
    function test_requireFail_EscrowVault_release_unauthorizedCaller() public {
        bytes32 escrowId = keccak256("escrow5");
        bytes32 receiptId = keccak256("receipt5");
        vault.createEscrow{ value: 1 ether }(escrowId, receiptId, address(this), uint64(block.timestamp + 1 hours));

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedCaller()"));
        vault.release(escrowId, address(this));
    }

    // ================================================================
    //                     WALLET DELEGATE TESTS
    // ================================================================

    /// @notice redeemDelegations reverts on length mismatch
    function test_requireFail_WalletDelegate_redeemDelegations_lengthMismatch() public {
        TypesDelegation.Delegation[] memory delegations = new TypesDelegation.Delegation[](1);
        uint256[] memory modes = new uint256[](2); // Mismatch!
        bytes[] memory execCalldata = new bytes[](1);

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.LengthMismatch.selector));
        walletDelegate.redeemDelegations(delegations, modes, execCalldata);
    }

    /// @notice redeemDelegations reverts on unsupported mode
    function test_requireFail_WalletDelegate_redeemDelegations_unsupportedMode() public {
        // Build a valid delegation first
        uint256 delegatorKey_ = 0xA11CE;
        address delegatorAddr = vm.addr(delegatorKey_);

        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);
        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegatorAddr;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = 1;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", walletDelegate.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey_, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        walletDelegate.setupDelegation(delegation);

        TypesDelegation.Delegation[] memory delegations = new TypesDelegation.Delegation[](1);
        delegations[0] = delegation;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 1; // Unsupported - only mode 0 allowed

        bytes[] memory execCalldata = new bytes[](1);
        execCalldata[0] = abi.encode(TypesDelegation.ExecutionParams({ target: address(0x1), callData: "", value: 0 }));

        vm.expectRevert("Only call mode (0) supported");
        walletDelegate.redeemDelegations(delegations, modes, execCalldata);
    }

    /// @notice redeemDelegations reverts when delegation not found
    function test_requireFail_WalletDelegate_redeemDelegations_notFound() public {
        TypesDelegation.Delegation[] memory delegations = new TypesDelegation.Delegation[](1);
        // delegations[0] is default/zeroed — won't match any stored delegation
        delegations[0].delegate = address(walletDelegate);
        delegations[0].caveats = new TypesDelegation.Caveat[](0);

        uint256[] memory modes = new uint256[](1);
        bytes[] memory execCalldata = new bytes[](1);
        execCalldata[0] = abi.encode(TypesDelegation.ExecutionParams({ target: address(0x1), callData: "", value: 0 }));

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationNotFound.selector));
        walletDelegate.redeemDelegations(delegations, modes, execCalldata);
    }

    /// @notice revokeDelegation reverts on double revoke (DelegationNotActive)
    function test_requireFail_WalletDelegate_revokeDelegation_doubleRevoke() public {
        uint256 delegatorKey_ = 0xA11CE;
        address delegatorAddr = vm.addr(delegatorKey_);

        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);
        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegatorAddr;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = 100;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", walletDelegate.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey_, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        walletDelegate.setupDelegation(delegation);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        vm.startPrank(delegatorAddr);
        walletDelegate.revokeDelegation(delegationHash);

        vm.expectRevert(abi.encodeWithSelector(IWalletDelegate.DelegationNotActive.selector));
        walletDelegate.revokeDelegation(delegationHash);
        vm.stopPrank();
    }

    /// @notice executeDelegated reverts when paused
    function test_requireFail_WalletDelegate_executeDelegated_whenPaused() public {
        uint256 delegatorKey_ = 0xA11CE;
        address delegatorAddr = vm.addr(delegatorKey_);

        TypesDelegation.Caveat[] memory caveats = new TypesDelegation.Caveat[](0);
        TypesDelegation.Delegation memory delegation;
        delegation.delegator = delegatorAddr;
        delegation.delegate = address(walletDelegate);
        delegation.authority = bytes32(0);
        delegation.caveats = caveats;
        delegation.salt = 200;

        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", walletDelegate.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(delegatorKey_, digest);
        delegation.signature = abi.encodePacked(r, s, v);

        walletDelegate.setupDelegation(delegation);
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        walletDelegate.pause();

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        walletDelegate.executeDelegated(delegationHash, address(0x1), "", 0);
    }

    // ================================================================
    //                     X402 FACILITATOR TESTS
    // ================================================================

    function _makeSettlementParams(bytes32 paymentHash, uint256 amount)
        internal
        view
        returns (TypesDelegation.SettlementParams memory)
    {
        return TypesDelegation.SettlementParams({
            paymentHash: paymentHash,
            token: address(usdc),
            amount: amount,
            seller: address(0x5),
            buyer: address(this),
            receiptId: keccak256("receipt"),
            intentHash: keccak256("intent"),
            proof: "proof",
            expiry: uint64(block.timestamp + 1 hours)
        });
    }

    /// @notice settlePayment reverts with invalid (zero) paymentHash
    function test_requireFail_X402Facilitator_settlePayment_invalidHash() public {
        TypesDelegation.SettlementParams memory params = _makeSettlementParams(bytes32(0), 100e6);

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidPaymentHash.selector));
        facilitator.settlePayment(params);
    }

    /// @notice settlePayment reverts with zero amount
    function test_requireFail_X402Facilitator_settlePayment_zeroAmount() public {
        TypesDelegation.SettlementParams memory params = _makeSettlementParams(keccak256("pay"), 0);

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidAmount.selector));
        facilitator.settlePayment(params);
    }

    /// @notice settlePayment reverts with zero seller address
    function test_requireFail_X402Facilitator_settlePayment_zeroSeller() public {
        TypesDelegation.SettlementParams memory params = _makeSettlementParams(keccak256("pay"), 100e6);
        params.seller = address(0);

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidSeller.selector));
        facilitator.settlePayment(params);
    }

    /// @notice settlePayment reverts with zero buyer address
    function test_requireFail_X402Facilitator_settlePayment_zeroBuyer() public {
        TypesDelegation.SettlementParams memory params = _makeSettlementParams(keccak256("pay"), 100e6);
        params.buyer = address(0);

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidBuyer.selector));
        facilitator.settlePayment(params);
    }

    /// @notice settlePayment reverts with zero token address
    function test_requireFail_X402Facilitator_settlePayment_zeroToken() public {
        TypesDelegation.SettlementParams memory params = _makeSettlementParams(keccak256("pay"), 100e6);
        params.token = address(0);

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.InvalidToken.selector));
        facilitator.settlePayment(params);
    }

    /// @notice settlePayment reverts when expired
    function test_requireFail_X402Facilitator_settlePayment_expired() public {
        vm.warp(1000);
        TypesDelegation.SettlementParams memory params = _makeSettlementParams(keccak256("pay"), 100e6);
        params.expiry = uint64(block.timestamp - 1);

        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.PaymentExpired.selector));
        facilitator.settlePayment(params);
    }
}
