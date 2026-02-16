// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { AcrossAdapter } from "../src/adapters/AcrossAdapter.sol";
import { IAcrossAdapter } from "../src/interfaces/IAcrossAdapter.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { Types } from "../src/libraries/Types.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AcrossAdapterTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    AcrossAdapter public adapter;
    IntentReceiptHub public hub;
    SolverRegistry public registry;

    address public owner = address(this);
    uint256 public relayerPrivateKey = 0x1234;
    address public relayer;
    address public depositor = address(0x2);
    address public recipient = address(0x3);

    uint256 public constant MINIMUM_BOND = 0.1 ether;

    bytes32 public solverId;

    event AcrossReceiptPosted(
        bytes32 indexed receiptId,
        bytes32 indexed depositId,
        bytes32 indexed solverId,
        uint256 originChainId,
        uint256 destinationChainId
    );

    function setUp() public {
        relayer = vm.addr(relayerPrivateKey);

        // Fund accounts
        vm.deal(address(this), 10 ether);
        vm.deal(relayer, 10 ether);
        vm.deal(depositor, 10 ether);

        // Deploy core contracts
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        adapter = new AcrossAdapter(address(hub), address(registry));

        // Authorize hub to call registry
        registry.setAuthorizedCaller(address(hub), true);

        // Register relayer as solver
        vm.prank(relayer);
        solverId = registry.registerSolver("ipfs://relayer-metadata", relayer);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    // Allow test contract to receive ETH
    receive() external payable { }

    // ============ Helper Functions ============

    function _createDeposit() internal view returns (IAcrossAdapter.AcrossDeposit memory) {
        return IAcrossAdapter.AcrossDeposit({
            originChainId: 1,
            destinationChainId: 10,
            originToken: address(0x111),
            destinationToken: address(0x222),
            inputAmount: 1 ether,
            outputAmount: 0.99 ether,
            depositor: depositor,
            recipient: recipient,
            fillDeadline: uint256(block.timestamp + 1 hours),
            depositId: keccak256("deposit-1"),
            exclusivityDeadline: uint256(block.timestamp + 30 minutes),
            exclusiveRelayer: relayer,
            message: ""
        });
    }

    function _createFillData(IAcrossAdapter.AcrossDeposit memory deposit)
        internal
        view
        returns (IAcrossAdapter.FillData memory)
    {
        return IAcrossAdapter.FillData({
            fillChainId: deposit.destinationChainId,
            tokenFilled: deposit.destinationToken,
            amountFilled: deposit.outputAmount,
            recipientFilled: deposit.recipient,
            fillTxHash: keccak256("fill-tx-1"),
            filledAt: uint64(block.timestamp)
        });
    }

    function _prepareAndSignReceipt(IAcrossAdapter.AcrossDeposit memory deposit, IAcrossAdapter.FillData memory fill)
        internal
        view
        returns (Types.IntentReceipt memory receipt, bytes memory sig)
    {
        // Get the receipt structure
        receipt = adapter.prepareReceipt(deposit, fill, solverId);

        // IRSB-SEC-001 + IRSB-SEC-006: Compute message hash with chainId, hub address, and nonce for replay protection
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(relayerPrivateKey, ethSignedHash);
        sig = abi.encodePacked(r, s, v);

        // Add signature to receipt
        receipt.solverSig = sig;
    }

    function _postReceiptToHub(IAcrossAdapter.AcrossDeposit memory deposit, IAcrossAdapter.FillData memory fill)
        internal
        returns (bytes32 receiptId, Types.IntentReceipt memory receipt)
    {
        bytes memory sig;
        (receipt, sig) = _prepareAndSignReceipt(deposit, fill);

        // Post to hub as relayer
        vm.prank(relayer);
        receiptId = hub.postReceipt(receipt, 0);
    }

    // ============ Register Receipt Tests ============

    function testRegisterAcrossReceipt() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        // Post to hub first
        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        // Register with adapter
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        // Verify registration
        assertTrue(adapter.hasReceipt(deposit.depositId), "Should have receipt");

        IAcrossAdapter.AcrossReceipt memory acrossReceipt = adapter.getReceiptByDepositId(deposit.depositId);
        assertEq(acrossReceipt.receiptId, receiptId, "Receipt ID mismatch");
        assertEq(acrossReceipt.depositId, deposit.depositId, "Deposit ID mismatch");
        assertEq(acrossReceipt.solverId, solverId, "Solver ID mismatch");
    }

    function testRegisterAcrossReceiptEmitsEvent() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.expectEmit(true, true, true, true);
        emit AcrossReceiptPosted(
            receiptId, deposit.depositId, solverId, deposit.originChainId, deposit.destinationChainId
        );

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);
    }

    function testCannotRegisterDuplicateReceipt() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        // First registration succeeds
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        // Second registration fails
        vm.expectRevert(IAcrossAdapter.ReceiptAlreadyPosted.selector);
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);
    }

    function testCannotRegisterWithNonExistentReceipt() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();

        vm.expectRevert(IAcrossAdapter.InvalidDeposit.selector);
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, keccak256("fake-receipt-id"));
    }

    function testCannotRegisterByNonOperator() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        // Try to register as non-operator
        vm.expectRevert(IAcrossAdapter.UnauthorizedRelayer.selector);
        vm.prank(address(0x999));
        adapter.registerAcrossReceipt(deposit, receiptId);
    }

    function testCannotRegisterWithMismatchedIntent() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        // Modify deposit to create mismatched intent
        IAcrossAdapter.AcrossDeposit memory wrongDeposit = deposit;
        wrongDeposit.inputAmount = 999 ether;

        vm.expectRevert(IAcrossAdapter.InvalidDeposit.selector);
        vm.prank(relayer);
        adapter.registerAcrossReceipt(wrongDeposit, receiptId);
    }

    // ============ Validate Fill Tests ============

    function testValidateFillSuccess() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        (bool valid, string memory reason) = adapter.validateFill(receiptId, fill);
        assertTrue(valid, "Fill should be valid");
        assertEq(bytes(reason).length, 0, "Reason should be empty");
    }

    function testValidateFillWrongChain() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        IAcrossAdapter.FillData memory wrongFill = fill;
        wrongFill.fillChainId = 42069;

        (bool valid, string memory reason) = adapter.validateFill(receiptId, wrongFill);
        assertFalse(valid, "Fill should be invalid");
        assertEq(reason, "Wrong destination chain");
    }

    function testValidateFillWrongToken() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        IAcrossAdapter.FillData memory wrongFill = fill;
        wrongFill.tokenFilled = address(0x999);

        (bool valid, string memory reason) = adapter.validateFill(receiptId, wrongFill);
        assertFalse(valid, "Fill should be invalid");
        assertEq(reason, "Wrong token");
    }

    function testValidateFillAmountBelowMinimum() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        IAcrossAdapter.FillData memory wrongFill = fill;
        wrongFill.amountFilled = 0.5 ether;

        (bool valid, string memory reason) = adapter.validateFill(receiptId, wrongFill);
        assertFalse(valid, "Fill should be invalid");
        assertEq(reason, "Amount below minimum");
    }

    function testValidateFillWrongRecipient() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        IAcrossAdapter.FillData memory wrongFill = fill;
        wrongFill.recipientFilled = address(0xDEAD);

        (bool valid, string memory reason) = adapter.validateFill(receiptId, wrongFill);
        assertFalse(valid, "Fill should be invalid");
        assertEq(reason, "Wrong recipient");
    }

    function testValidateFillAfterDeadline() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        IAcrossAdapter.FillData memory wrongFill = fill;
        wrongFill.filledAt = uint64(deposit.fillDeadline + 1);

        (bool valid, string memory reason) = adapter.validateFill(receiptId, wrongFill);
        assertFalse(valid, "Fill should be invalid");
        assertEq(reason, "Fill after deadline");
    }

    function testValidateFillNonexistentReceipt() public view {
        IAcrossAdapter.FillData memory fill = IAcrossAdapter.FillData({
            fillChainId: 10,
            tokenFilled: address(0x222),
            amountFilled: 1 ether,
            recipientFilled: recipient,
            fillTxHash: keccak256("fake"),
            filledAt: uint64(block.timestamp)
        });

        (bool valid, string memory reason) = adapter.validateFill(bytes32(0), fill);
        assertFalse(valid, "Fill should be invalid");
        assertEq(reason, "Receipt not found");
    }

    // ============ Hash Computation Tests ============

    function testComputeIntentHash() public view {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        bytes32 hash1 = adapter.computeIntentHash(deposit);
        bytes32 hash2 = adapter.computeIntentHash(deposit);

        assertEq(hash1, hash2, "Hashes should match");
        assertTrue(hash1 != bytes32(0), "Hash should not be zero");
    }

    function testComputeIntentHashDifferentInputs() public view {
        IAcrossAdapter.AcrossDeposit memory deposit1 = _createDeposit();
        IAcrossAdapter.AcrossDeposit memory deposit2 = _createDeposit();
        deposit2.inputAmount = 2 ether;

        bytes32 hash1 = adapter.computeIntentHash(deposit1);
        bytes32 hash2 = adapter.computeIntentHash(deposit2);

        assertTrue(hash1 != hash2, "Different inputs should produce different hashes");
    }

    function testComputeConstraintsHash() public view {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        bytes32 hash = adapter.computeConstraintsHash(deposit);
        assertTrue(hash != bytes32(0), "Hash should not be zero");
    }

    function testComputeRouteHash() public view {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        bytes32 hash = adapter.computeRouteHash(deposit);
        assertTrue(hash != bytes32(0), "Hash should not be zero");
    }

    function testComputeOutcomeHash() public view {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);
        bytes32 hash = adapter.computeOutcomeHash(fill);
        assertTrue(hash != bytes32(0), "Hash should not be zero");
    }

    // ============ Prepare Receipt Tests ============

    function testPrepareReceipt() public view {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        Types.IntentReceipt memory receipt = adapter.prepareReceipt(deposit, fill, solverId);

        assertEq(receipt.solverId, solverId, "Solver ID mismatch");
        assertTrue(receipt.intentHash != bytes32(0), "Intent hash should not be zero");
        assertTrue(receipt.constraintsHash != bytes32(0), "Constraints hash should not be zero");
        assertEq(receipt.createdAt, uint64(block.timestamp), "Created at mismatch");
        assertEq(receipt.expiry, uint64(block.timestamp) + 1 hours, "Expiry mismatch");
    }

    function testGetReceiptMessageHash() public view {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        bytes32 messageHash = adapter.getReceiptMessageHash(deposit, fill, solverId);
        assertTrue(messageHash != bytes32(0), "Message hash should not be zero");
    }

    // ============ View Functions Tests ============

    function testGetDeposit() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        IAcrossAdapter.AcrossDeposit memory storedDeposit = adapter.getDeposit(receiptId);
        assertEq(storedDeposit.originChainId, deposit.originChainId);
        assertEq(storedDeposit.destinationChainId, deposit.destinationChainId);
        assertEq(storedDeposit.inputAmount, deposit.inputAmount);
        assertEq(storedDeposit.outputAmount, deposit.outputAmount);
        assertEq(storedDeposit.depositId, deposit.depositId);
    }

    function testEstimateGasOverhead() public view {
        uint256 gas = adapter.estimateGasOverhead();
        assertEq(gas, 50_000, "Gas overhead should be 50k");
    }

    function testIntentReceiptHubAddress() public view {
        assertEq(address(adapter.intentReceiptHub()), address(hub));
    }

    function testSolverRegistryAddress() public view {
        assertEq(address(adapter.solverRegistry()), address(registry));
    }

    // ============ Admin Tests ============

    function testPauseUnpause() public {
        adapter.pause();

        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        // Should fail when paused
        vm.expectRevert();
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        adapter.unpause();

        // Should work after unpause
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);
        assertTrue(adapter.hasReceipt(deposit.depositId), "Should have receipt after unpause");
    }

    function testOnlyOwnerCanPause() public {
        vm.expectRevert();
        vm.prank(relayer);
        adapter.pause();
    }

    // ============ Integration Tests ============

    function testFullFlowWithFinalization() public {
        // 1. Create and post receipt to hub
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

        // 2. Register with adapter
        vm.prank(relayer);
        adapter.registerAcrossReceipt(deposit, receiptId);

        // 3. Verify both hub and adapter have the receipt
        (Types.IntentReceipt memory receipt, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint8(status), uint8(Types.ReceiptStatus.Pending));
        assertEq(receipt.solverId, solverId);

        IAcrossAdapter.AcrossReceipt memory acrossReceipt = adapter.getReceiptByDepositId(deposit.depositId);
        assertEq(acrossReceipt.receiptId, receiptId);

        // 4. Warp past challenge window and finalize
        vm.warp(block.timestamp + 2 hours);
        hub.finalize(receiptId);

        // 5. Verify finalized
        (, status) = hub.getReceipt(receiptId);
        assertEq(uint8(status), uint8(Types.ReceiptStatus.Finalized));
    }

    function testMultipleReceipts() public {
        for (uint256 i = 0; i < 3; i++) {
            IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
            deposit.depositId = keccak256(abi.encode("deposit-", i));
            deposit.inputAmount = (i + 1) * 1 ether;

            IAcrossAdapter.FillData memory fill = _createFillData(deposit);
            (bytes32 receiptId,) = _postReceiptToHub(deposit, fill);

            vm.prank(relayer);
            adapter.registerAcrossReceipt(deposit, receiptId);

            assertTrue(adapter.hasReceipt(deposit.depositId), "Should have receipt");
        }

        assertEq(adapter.totalAcrossReceipts(), 3, "Should have 3 receipts");
    }

    // ============ PostAcrossReceipt Tests (tracking only) ============

    function testPostAcrossReceiptTracksData() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        // Sign for the adapter's postAcrossReceipt function
        bytes memory sig;
        (, sig) = _prepareAndSignReceipt(deposit, fill);

        // This registers tracking but doesn't post to hub
        vm.prank(relayer);
        bytes32 receiptId = adapter.postAcrossReceipt(deposit, fill, sig);

        // Should be tracked in adapter
        assertTrue(adapter.hasReceipt(deposit.depositId), "Should track receipt");
        assertEq(adapter.totalAcrossReceipts(), 1, "Should have 1 receipt");

        // Note: Receipt is NOT in hub because adapter.postAcrossReceipt only tracks
        // The relayer must still call hub.postReceipt separately
    }

    function testPostAcrossReceiptRevertsExpired() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);
        bytes memory sig;
        (, sig) = _prepareAndSignReceipt(deposit, fill);

        vm.warp(block.timestamp + 2 hours);

        vm.expectRevert(IAcrossAdapter.DepositExpired.selector);
        vm.prank(relayer);
        adapter.postAcrossReceipt(deposit, fill, sig);
    }

    function testPostAcrossReceiptRevertsDuplicate() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);
        bytes memory sig;
        (, sig) = _prepareAndSignReceipt(deposit, fill);

        vm.prank(relayer);
        adapter.postAcrossReceipt(deposit, fill, sig);

        vm.expectRevert(IAcrossAdapter.ReceiptAlreadyPosted.selector);
        vm.prank(relayer);
        adapter.postAcrossReceipt(deposit, fill, sig);
    }

    function testPostAcrossReceiptRevertsUnregisteredSolver() public {
        IAcrossAdapter.AcrossDeposit memory deposit = _createDeposit();
        IAcrossAdapter.FillData memory fill = _createFillData(deposit);

        vm.expectRevert(IAcrossAdapter.SolverNotRegistered.selector);
        vm.prank(address(0x999));
        adapter.postAcrossReceipt(deposit, fill, "");
    }
}
