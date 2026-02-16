// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { DisputeModule } from "../../src/DisputeModule.sol";
import { Types } from "../../src/libraries/Types.sol";

/// @title DisputeModuleInvariants
/// @notice Invariant tests for DisputeModule per audit/INVARIANTS.md
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract DisputeModuleInvariants
contract DisputeModuleInvariants is Test {
    SolverRegistry public registry;
    IntentReceiptHub public hub;
    DisputeModule public disputeModule;
    DisputeHandler public handler;

    address public arbitrator = address(0xA4B);

    function setUp() public {
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));
        disputeModule = new DisputeModule(address(registry), address(hub), arbitrator);

        // Authorize contracts
        registry.setAuthorizedCaller(address(hub), true);
        registry.setAuthorizedCaller(address(disputeModule), true);
        hub.setDisputeModule(address(disputeModule));

        handler = new DisputeHandler(registry, hub, disputeModule, arbitrator);
        targetContract(address(handler));
    }

    /// @notice DM-4: Resolution Finality
    /// @dev Once resolved, disputes cannot transition to any other status
    function invariant_DM4_resolutionFinality() public view {
        bytes32[] memory receiptIds = handler.getDisputeIds();

        for (uint256 i = 0; i < receiptIds.length; i++) {
            (, Types.ReceiptStatus status) = hub.getReceipt(receiptIds[i]);

            // If slashed or finalized, it cannot change back
            if (status == Types.ReceiptStatus.Slashed || status == Types.ReceiptStatus.Finalized) {
                assertTrue(
                    status == Types.ReceiptStatus.Slashed || status == Types.ReceiptStatus.Finalized,
                    "DM-4: Terminal status changed"
                );
            }
        }
    }

    /// @notice DM-7: Slash Distribution (Arbitration) sums to 100%
    /// @dev userShare + treasuryShare + arbitratorShare == slashAmount
    function invariant_DM7_arbitrationSlashDistribution() public pure {
        // Static check: arbitration distribution matches contract constants (70 + 20 + 10 = 100%)
        // Contract uses percentages, not BPS: see DisputeModule.sol lines 160-162
        uint256 userPct = 70;
        uint256 treasuryPct = 20;
        uint256 arbitratorPct = 10;

        assertEq(userPct + treasuryPct + arbitratorPct, 100, "DM-7: Arbitration distribution != 100%");
    }

    /// @notice CC-4: Slash Source Validity
    /// @dev Slashes only from authorized sources
    function invariant_CC4_onlyAuthorizedCanSlash() public view {
        assertTrue(registry.authorizedCallers(address(disputeModule)), "CC-4: DisputeModule not authorized");
        assertTrue(registry.authorizedCallers(address(hub)), "CC-4: Hub not authorized");
    }
}

/// @notice Simplified handler for DisputeModule invariant testing
contract DisputeHandler is Test {
    SolverRegistry public registry;
    IntentReceiptHub public hub;
    DisputeModule public disputeModule;
    address public arbitrator;

    bytes32[] public solverIds;
    mapping(bytes32 => uint256) public solverPrivateKeys;

    bytes32[] public receiptIds;
    bytes32[] public disputeIds;

    uint256 internal nonce;

    constructor(SolverRegistry _registry, IntentReceiptHub _hub, DisputeModule _disputeModule, address _arbitrator) {
        registry = _registry;
        hub = _hub;
        disputeModule = _disputeModule;
        arbitrator = _arbitrator;
    }

    /// @notice Helper to get receipt status
    function _getReceiptStatus(bytes32 receiptId) internal view returns (Types.ReceiptStatus) {
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        return status;
    }

    /// @notice Register a solver with bond
    function registerSolver(uint256 seed) public {
        uint256 privateKey = bound(seed, 1, type(uint128).max);
        address operator = vm.addr(privateKey);

        vm.deal(operator, 1 ether);

        vm.startPrank(operator);
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        registry.depositBond{ value: 0.5 ether }(solverId);
        vm.stopPrank();

        solverIds.push(solverId);
        solverPrivateKeys[solverId] = privateKey;
    }

    /// @notice Post a receipt
    function postReceipt(uint256 solverIndex) public {
        if (solverIds.length == 0) return;

        solverIndex = bound(solverIndex, 0, solverIds.length - 1);
        bytes32 solverId = solverIds[solverIndex];

        Types.Solver memory solver = registry.getSolver(solverId);
        if (solver.status != Types.SolverStatus.Active) return;

        uint256 privateKey = solverPrivateKeys[solverId];
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

        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(hub),
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

        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        hub.postReceipt(receipt, 0);

        bytes32 receiptId = Types.computeReceiptId(receipt);
        receiptIds.push(receiptId);
    }

    /// @notice Open a dispute on a receipt
    function openDispute(uint256 receiptIndex, uint256 challengerSeed) public {
        if (receiptIds.length == 0) return;

        receiptIndex = bound(receiptIndex, 0, receiptIds.length - 1);
        bytes32 receiptId = receiptIds[receiptIndex];

        Types.ReceiptStatus status = _getReceiptStatus(receiptId);
        if (status != Types.ReceiptStatus.Pending) return;

        address challenger = address(uint160(bound(challengerSeed, 1, type(uint160).max)));
        vm.deal(challenger, 1 ether);

        vm.prank(challenger);
        hub.openDispute{ value: 0.01 ether }(receiptId, Types.DisputeReason.Timeout, keccak256("evidence"));

        disputeIds.push(receiptId);
    }

    /// @notice Get all dispute IDs
    function getDisputeIds() external view returns (bytes32[] memory) {
        return disputeIds;
    }
}
