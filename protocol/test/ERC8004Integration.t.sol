// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { ERC8004Adapter } from "../src/adapters/ERC8004Adapter.sol";
import { MockERC8004Registry } from "../src/mocks/MockERC8004Registry.sol";
import { Types } from "../src/libraries/Types.sol";
import { IERC8004 } from "../src/interfaces/IERC8004.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ERC8004Integration Test
/// @notice Integration tests verifying ERC-8004 signals flow from core contracts to adapter
contract ERC8004IntegrationTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Core contracts
    IntentReceiptHub public hub;
    SolverRegistry public registry;

    // ERC-8004 components
    ERC8004Adapter public adapter;
    MockERC8004Registry public mockRegistry;

    // Test accounts
    address public owner = address(this);
    uint256 public operatorPrivateKey = 0x1234;
    address public operator;
    address public challenger = address(0x2);

    // Constants
    uint256 public constant MINIMUM_BOND = 0.1 ether;
    uint256 public constant CHALLENGER_BOND = 0.01 ether;

    // Test data
    bytes32 public solverId;

    function setUp() public {
        operator = vm.addr(operatorPrivateKey);

        // Fund accounts
        vm.deal(address(this), 100 ether);
        vm.deal(challenger, 10 ether);

        // Deploy core contracts
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));

        // Deploy ERC-8004 components
        adapter = new ERC8004Adapter(address(hub));
        mockRegistry = new MockERC8004Registry();

        // Configure adapter
        adapter.setRegistry(address(mockRegistry));
        mockRegistry.setAuthorizedProvider(address(adapter), true);

        // Connect hub and registry to adapter
        hub.setERC8004Adapter(address(adapter));
        registry.setERC8004Adapter(address(adapter));

        // Authorize hub/registry to call adapter
        adapter.setAuthorizedHub(address(hub), true);
        adapter.setAuthorizedHub(address(registry), true);

        // Authorize hub to call registry
        registry.setAuthorizedCaller(address(hub), true);

        // Register and fund solver
        solverId = registry.registerSolver("ipfs://metadata", operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
    }

    receive() external payable { }

    // ============ Core Integration Tests ============

    /// @notice Test that receipt finalization triggers ERC-8004 signal
    function test_Finalize_TriggersERC8004Signal() public {
        // Post a receipt
        Types.IntentReceipt memory receipt = _createSignedReceipt(keccak256("intent1"));
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        // Warp past challenge window
        vm.warp(block.timestamp + 1 hours + 1);

        // Finalize
        hub.finalize(receiptId);

        // Verify adapter recorded the signal
        assertEq(adapter.totalSignals(), 1);
        assertEq(adapter.getOutcomeCount(IERC8004.ValidationOutcome.Finalized), 1);

        // Verify mock registry received the validation
        assertTrue(mockRegistry.isValidated(receiptId));
    }

    /// @notice Test that slashing via timeout dispute triggers ERC-8004 signal
    function test_Slash_TriggersERC8004Signal() public {
        // Set a known starting time
        vm.warp(1000);

        // Post a receipt with expiry at T+1800 (30 min)
        Types.IntentReceipt memory receipt =
            _createSignedReceiptWithExpiry(keccak256("intent_slash"), uint64(block.timestamp + 30 minutes));
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        // Open a timeout dispute
        vm.prank(challenger);
        hub.openDispute{ value: CHALLENGER_BOND }(receiptId, Types.DisputeReason.Timeout, "timeout");

        // Warp well past expiry (T+1 hour)
        vm.warp(block.timestamp + 1 hours);

        // Resolve - should slash since past expiry with no settlement proof
        hub.resolveDeterministic(receiptId);

        // Verify slashed
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Slashed));

        // Verify ERC-8004 signals were emitted via SolverRegistry slash
        // Note: Multiple slash calls (user/challenger/treasury distribution) = multiple signals
        assertGe(adapter.totalSignals(), 1);
        assertGe(adapter.getOutcomeCount(IERC8004.ValidationOutcome.Slashed), 1);
    }

    /// @notice Test that adapter failures don't block finalization
    function test_AdapterFailure_DoesNotBlockFinalize() public {
        // Enable failure simulation
        mockRegistry.setShouldFail(true);

        // Post a receipt
        Types.IntentReceipt memory receipt = _createSignedReceipt(keccak256("intent_fail"));
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        vm.warp(block.timestamp + 1 hours + 1);

        // Finalize should succeed despite registry failure
        hub.finalize(receiptId);

        // Receipt should be finalized
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));

        // Signal still counted (emitted, just not recorded to registry)
        assertEq(adapter.totalSignals(), 1);
    }

    /// @notice Test disabling adapter stops signals
    function test_DisableAdapter_StopsSignals() public {
        // Disable adapter
        hub.setERC8004Adapter(address(0));

        // Post and finalize
        Types.IntentReceipt memory receipt = _createSignedReceipt(keccak256("no_signal"));
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        vm.warp(block.timestamp + 1 hours + 1);
        hub.finalize(receiptId);

        // No signals emitted
        assertEq(adapter.totalSignals(), 0);
    }

    /// @notice Test validation is tracked in registry
    function test_Registry_TracksValidation() public {
        // Finalize a receipt
        Types.IntentReceipt memory receipt = _createSignedReceipt(keccak256("track"));
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        vm.warp(block.timestamp + 1 hours + 1);
        hub.finalize(receiptId);

        // Verify registry tracked it
        (uint256 total, uint256 successful) = mockRegistry.getValidationCount(solverId);
        assertEq(total, 1);
        assertEq(successful, 1);
    }

    /// @notice Test adapter stats are maintained correctly
    function test_AdapterStats_Maintained() public {
        // Get initial stats
        (uint256 initFinalized,,,) = adapter.getAllOutcomeStats();
        assertEq(initFinalized, 0);

        // Finalize a receipt
        Types.IntentReceipt memory receipt = _createSignedReceipt(keccak256("stats"));
        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt, 0);

        vm.warp(block.timestamp + 1 hours + 1);
        hub.finalize(receiptId);

        // Verify stats updated
        (uint256 finalized, uint256 slashed, uint256 disputeWon, uint256 disputeLost) = adapter.getAllOutcomeStats();
        assertEq(finalized, 1);
        assertEq(slashed, 0);
        assertEq(disputeWon, 0);
        assertEq(disputeLost, 0);
    }

    // ============ Helper Functions ============

    function _createSignedReceipt(bytes32 intentHash) internal returns (Types.IntentReceipt memory) {
        return _createSignedReceiptWithExpiry(intentHash, uint64(block.timestamp + 1 days));
    }

    function _createSignedReceiptWithExpiry(bytes32 intentHash, uint64 expiry)
        internal
        returns (Types.IntentReceipt memory)
    {
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

        // Sign receipt
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
}
