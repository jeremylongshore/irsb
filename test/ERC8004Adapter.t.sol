// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC8004Adapter } from "../src/adapters/ERC8004Adapter.sol";
import { MockERC8004Registry } from "../src/mocks/MockERC8004Registry.sol";
import { IERC8004 } from "../src/interfaces/IERC8004.sol";
import { IValidationRegistry } from "../src/interfaces/IValidationRegistry.sol";

contract ERC8004AdapterTest is Test {
    ERC8004Adapter public adapter;
    MockERC8004Registry public registry;

    address public owner = address(this);
    address public hub = address(0x100);
    address public unauthorized = address(0x200);

    bytes32 public receiptId = keccak256("receipt-1");
    bytes32 public solverId = keccak256("solver-1");

    event ValidationSignalEmitted(
        bytes32 indexed taskId,
        bytes32 indexed agentId,
        IERC8004.ValidationOutcome outcome,
        uint256 timestamp,
        bytes32 evidenceHash,
        bytes metadata
    );
    event ValidationRecorded(bytes32 indexed taskId, bytes32 indexed agentId, address indexed registry);
    event HubAuthorizationChanged(address indexed hub, bool authorized);
    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    function setUp() public {
        // Deploy adapter with hub authorization
        adapter = new ERC8004Adapter(hub);

        // Deploy mock registry
        registry = new MockERC8004Registry();

        // Authorize adapter in registry
        registry.setAuthorizedProvider(address(adapter), true);

        // Set registry in adapter
        adapter.setRegistry(address(registry));
    }

    // ============ Constructor Tests ============

    function test_Constructor_SetsOwner() public view {
        assertEq(adapter.owner(), owner);
    }

    function test_Constructor_AuthorizesHub() public view {
        assertTrue(adapter.isAuthorizedHub(hub));
    }

    function test_Constructor_ZeroHubNoAuth() public {
        ERC8004Adapter adapterNoHub = new ERC8004Adapter(address(0));
        assertFalse(adapterNoHub.isAuthorizedHub(address(0)));
    }

    // ============ Provider Info Tests ============

    function test_GetProviderInfo() public view {
        (string memory name, string memory version, uint256 chainId) = adapter.getProviderInfo();
        assertEq(name, "IRSB Protocol");
        assertEq(version, "2.0.0");
        assertEq(chainId, block.chainid);
    }

    function test_SupportsERC8004() public view {
        assertTrue(adapter.supportsERC8004());
    }

    // ============ Signal Finalized Tests ============

    function test_SignalFinalized_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ValidationSignalEmitted(
            receiptId, solverId, IERC8004.ValidationOutcome.Finalized, block.timestamp, bytes32(0), ""
        );

        vm.prank(hub);
        adapter.signalFinalized(receiptId, solverId);
    }

    function test_SignalFinalized_RecordsToRegistry() public {
        vm.expectEmit(true, true, true, true);
        emit ValidationRecorded(receiptId, solverId, address(registry));

        vm.prank(hub);
        adapter.signalFinalized(receiptId, solverId);

        // Verify registry recorded validation
        (bytes32 agentId, bool success, uint64 timestamp) = registry.getValidation(receiptId);
        assertEq(agentId, solverId);
        assertTrue(success);
        assertEq(timestamp, uint64(block.timestamp));
    }

    function test_SignalFinalized_IncrementsCounters() public {
        vm.prank(hub);
        adapter.signalFinalized(receiptId, solverId);

        assertEq(adapter.totalSignals(), 1);
        assertEq(adapter.getOutcomeCount(IERC8004.ValidationOutcome.Finalized), 1);
    }

    function test_SignalFinalized_RevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(ERC8004Adapter.UnauthorizedHub.selector);
        adapter.signalFinalized(receiptId, solverId);
    }

    function test_SignalFinalized_OwnerCanSignal() public {
        // Owner should be able to signal
        adapter.signalFinalized(receiptId, solverId);
        assertEq(adapter.totalSignals(), 1);
    }

    // ============ Signal Slashed Tests ============

    function test_SignalSlashed_EmitsEvent() public {
        uint256 amount = 1 ether;

        vm.expectEmit(true, true, false, true);
        emit ValidationSignalEmitted(
            receiptId, solverId, IERC8004.ValidationOutcome.Slashed, block.timestamp, bytes32(0), abi.encode(amount)
        );

        vm.prank(hub);
        adapter.signalSlashed(receiptId, solverId, amount);
    }

    function test_SignalSlashed_RecordsFailure() public {
        vm.prank(hub);
        adapter.signalSlashed(receiptId, solverId, 1 ether);

        (bytes32 agentId, bool success,) = registry.getValidation(receiptId);
        assertEq(agentId, solverId);
        assertFalse(success);
    }

    function test_SignalSlashed_IncrementsCounters() public {
        vm.prank(hub);
        adapter.signalSlashed(receiptId, solverId, 1 ether);

        assertEq(adapter.totalSignals(), 1);
        assertEq(adapter.getOutcomeCount(IERC8004.ValidationOutcome.Slashed), 1);
    }

    // ============ Signal Dispute Won Tests ============

    function test_SignalDisputeWon_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ValidationSignalEmitted(
            receiptId, solverId, IERC8004.ValidationOutcome.DisputeWon, block.timestamp, bytes32(0), ""
        );

        vm.prank(hub);
        adapter.signalDisputeWon(receiptId, solverId);
    }

    function test_SignalDisputeWon_RecordsSuccess() public {
        vm.prank(hub);
        adapter.signalDisputeWon(receiptId, solverId);

        (bytes32 agentId, bool success,) = registry.getValidation(receiptId);
        assertEq(agentId, solverId);
        assertTrue(success); // DisputeWon = success
    }

    function test_SignalDisputeWon_IncrementsCounters() public {
        vm.prank(hub);
        adapter.signalDisputeWon(receiptId, solverId);

        assertEq(adapter.totalSignals(), 1);
        assertEq(adapter.getOutcomeCount(IERC8004.ValidationOutcome.DisputeWon), 1);
    }

    // ============ Signal Dispute Lost Tests ============

    function test_SignalDisputeLost_EmitsEvent() public {
        uint256 slashAmount = 0.5 ether;

        vm.expectEmit(true, true, false, true);
        emit ValidationSignalEmitted(
            receiptId,
            solverId,
            IERC8004.ValidationOutcome.DisputeLost,
            block.timestamp,
            bytes32(0),
            abi.encode(slashAmount)
        );

        vm.prank(hub);
        adapter.signalDisputeLost(receiptId, solverId, slashAmount);
    }

    function test_SignalDisputeLost_RecordsFailure() public {
        vm.prank(hub);
        adapter.signalDisputeLost(receiptId, solverId, 0.5 ether);

        (bytes32 agentId, bool success,) = registry.getValidation(receiptId);
        assertEq(agentId, solverId);
        assertFalse(success); // DisputeLost = failure
    }

    function test_SignalDisputeLost_IncrementsCounters() public {
        vm.prank(hub);
        adapter.signalDisputeLost(receiptId, solverId, 0.5 ether);

        assertEq(adapter.totalSignals(), 1);
        assertEq(adapter.getOutcomeCount(IERC8004.ValidationOutcome.DisputeLost), 1);
    }

    // ============ Generic Signal Validation Tests ============

    function test_SignalValidation_FullParams() public {
        IERC8004.ValidationSignal memory signal = IERC8004.ValidationSignal({
            taskId: receiptId,
            agentId: solverId,
            outcome: IERC8004.ValidationOutcome.Finalized,
            timestamp: block.timestamp,
            evidenceHash: keccak256("evidence"),
            metadata: abi.encode("additional context")
        });

        vm.prank(hub);
        adapter.emitValidationSignal(signal);

        assertEq(adapter.totalSignals(), 1);
    }

    // ============ No Registry Tests ============

    function test_SignalFinalized_WorksWithoutRegistry() public {
        // Create adapter without registry
        ERC8004Adapter adapterNoRegistry = new ERC8004Adapter(hub);

        vm.prank(hub);
        adapterNoRegistry.signalFinalized(receiptId, solverId);

        // Should still emit event and increment counters
        assertEq(adapterNoRegistry.totalSignals(), 1);
    }

    // ============ Registry Failure Tests ============

    function test_SignalFinalized_DoesNotRevertOnRegistryFailure() public {
        // Enable failure simulation in mock
        registry.setShouldFail(true);

        // Should NOT revert even though registry call fails
        vm.prank(hub);
        adapter.signalFinalized(receiptId, solverId);

        // Event still emitted, counter still incremented
        assertEq(adapter.totalSignals(), 1);

        // But registry should NOT have the record
        assertFalse(registry.isValidated(receiptId));
    }

    // ============ Statistics Tests ============

    function test_GetAllOutcomeStats() public {
        // Generate various signals
        vm.startPrank(hub);

        bytes32 r1 = keccak256("r1");
        bytes32 r2 = keccak256("r2");
        bytes32 r3 = keccak256("r3");
        bytes32 r4 = keccak256("r4");
        bytes32 r5 = keccak256("r5");

        adapter.signalFinalized(r1, solverId);
        adapter.signalFinalized(r2, solverId);
        adapter.signalSlashed(r3, solverId, 1 ether);
        adapter.signalDisputeWon(r4, solverId);
        adapter.signalDisputeLost(r5, solverId, 0.5 ether);

        vm.stopPrank();

        (uint256 finalized, uint256 slashed, uint256 disputeWon, uint256 disputeLost) = adapter.getAllOutcomeStats();

        assertEq(finalized, 2);
        assertEq(slashed, 1);
        assertEq(disputeWon, 1);
        assertEq(disputeLost, 1);
        assertEq(adapter.totalSignals(), 5);
    }

    // ============ Admin Tests ============

    function test_SetAuthorizedHub() public {
        address newHub = address(0x300);

        vm.expectEmit(true, false, false, true);
        emit HubAuthorizationChanged(newHub, true);

        adapter.setAuthorizedHub(newHub, true);
        assertTrue(adapter.isAuthorizedHub(newHub));
    }

    function test_SetAuthorizedHub_Revoke() public {
        adapter.setAuthorizedHub(hub, false);
        assertFalse(adapter.isAuthorizedHub(hub));
    }

    function test_SetAuthorizedHub_RevertsZeroAddress() public {
        vm.expectRevert(ERC8004Adapter.InvalidHubAddress.selector);
        adapter.setAuthorizedHub(address(0), true);
    }

    function test_SetAuthorizedHub_RevertsNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorized));
        adapter.setAuthorizedHub(address(0x300), true);
    }

    function test_SetRegistry() public {
        address newRegistry = address(0x400);

        vm.expectEmit(true, true, false, true);
        emit RegistryUpdated(address(registry), newRegistry);

        adapter.setRegistry(newRegistry);
        assertEq(address(adapter.registry()), newRegistry);
    }

    function test_SetRegistry_ZeroToDisable() public {
        adapter.setRegistry(address(0));
        assertEq(address(adapter.registry()), address(0));

        // Signals should still work without registry
        vm.prank(hub);
        adapter.signalFinalized(receiptId, solverId);
        assertEq(adapter.totalSignals(), 1);
    }

    function test_SetRegistry_RevertsNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorized));
        adapter.setRegistry(address(0x400));
    }

    // ============ Registry View Function Tests ============

    function test_Registry_GetValidationCount() public {
        bytes32 s1 = keccak256("solver-1");
        bytes32 s2 = keccak256("solver-2");

        vm.startPrank(hub);

        // 3 successes, 1 failure for solver1
        adapter.signalFinalized(keccak256("r1"), s1);
        adapter.signalFinalized(keccak256("r2"), s1);
        adapter.signalDisputeWon(keccak256("r3"), s1);
        adapter.signalSlashed(keccak256("r4"), s1, 1 ether);

        // 1 success for solver2
        adapter.signalFinalized(keccak256("r5"), s2);

        vm.stopPrank();

        (uint256 total1, uint256 successful1) = registry.getValidationCount(s1);
        assertEq(total1, 4);
        assertEq(successful1, 3);

        (uint256 total2, uint256 successful2) = registry.getValidationCount(s2);
        assertEq(total2, 1);
        assertEq(successful2, 1);
    }

    function test_Registry_GetSuccessRate() public {
        vm.startPrank(hub);

        // 7 successes, 3 failures = 70% success rate
        for (uint256 i = 0; i < 7; i++) {
            adapter.signalFinalized(keccak256(abi.encode("success", i)), solverId);
        }
        for (uint256 i = 0; i < 3; i++) {
            adapter.signalSlashed(keccak256(abi.encode("fail", i)), solverId, 1 ether);
        }

        vm.stopPrank();

        uint256 rate = registry.getSuccessRate(solverId);
        assertEq(rate, 7000); // 70% in basis points
    }

    function test_Registry_IsValidated() public {
        assertFalse(registry.isValidated(receiptId));

        vm.prank(hub);
        adapter.signalFinalized(receiptId, solverId);

        assertTrue(registry.isValidated(receiptId));
    }
}
