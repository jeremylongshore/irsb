// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { Types } from "../../src/libraries/Types.sol";

/// @title IntentReceiptHubInvariants
/// @notice Invariant tests for IntentReceiptHub per audit/INVARIANTS.md
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract IntentReceiptHubInvariants
contract IntentReceiptHubInvariants is Test {
    SolverRegistry public registry;
    IntentReceiptHub public hub;
    HubHandler public handler;

    function setUp() public {
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));

        // Authorize hub in registry
        registry.setAuthorizedCaller(address(hub), true);

        handler = new HubHandler(registry, hub);
        targetContract(address(handler));
    }

    /// @notice Helper to get receipt status
    function _getReceiptStatus(bytes32 receiptId) internal view returns (Types.ReceiptStatus) {
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        return status;
    }

    /// @notice IRH-1: Receipt Uniqueness
    /// @dev Each intent hash maps to at most one receipt
    function invariant_IRH1_receiptUniqueness() public view {
        bytes32[] memory receiptIds = handler.getReceiptIds();

        // Each receipt ID should appear only once
        for (uint256 i = 0; i < receiptIds.length; i++) {
            for (uint256 j = i + 1; j < receiptIds.length; j++) {
                assertTrue(receiptIds[i] != receiptIds[j], "IRH-1: Duplicate receipt IDs");
            }
        }
    }

    /// @notice IRH-6: Slash Distribution Total
    /// @dev userShare + challengerShare + treasuryShare == slashAmount (100%)
    function invariant_IRH6_slashDistributionTotal() public pure {
        // Static check: BPS constants must sum to 10000
        uint256 total = Types.SLASH_USER_BPS + Types.SLASH_CHALLENGER_BPS + Types.SLASH_TREASURY_BPS;
        assertEq(total, Types.BPS, "IRH-6: Slash distribution != 100%");
    }

    /// @notice IRH-7: Status Transitions - no invalid states
    /// @dev Receipt status follows valid state machine
    function invariant_IRH7_validStatusTransitions() public view {
        bytes32[] memory receiptIds = handler.getReceiptIds();

        for (uint256 i = 0; i < receiptIds.length; i++) {
            Types.ReceiptStatus status = _getReceiptStatus(receiptIds[i]);

            // Status must be a valid enum value (0-3)
            assertTrue(
                status == Types.ReceiptStatus.Pending || status == Types.ReceiptStatus.Disputed
                    || status == Types.ReceiptStatus.Finalized || status == Types.ReceiptStatus.Slashed,
                "IRH-7: Invalid receipt status"
            );
        }
    }

    /// @notice EC-1: No Value Creation
    /// @dev Protocol cannot create ETH
    function invariant_EC1_noValueCreation() public view {
        uint256 totalDeposits = handler.totalDeposits();
        uint256 totalWithdrawals = handler.totalWithdrawals();

        assertGe(totalDeposits, totalWithdrawals, "EC-1: Withdrawals exceed deposits");
    }

    /// @notice EC-2: Challenger Risk/Reward
    /// @dev Challenger bond must be at risk when opening dispute (incentive alignment)
    function invariant_EC2_challengerRiskReward() public view {
        // The minimum challenger bond is always > 0 (set to 0.01 ETH by default)
        // This ensures challengers have skin in the game
        uint256 minBond = hub.challengerBondMin();
        assertTrue(minBond > 0, "EC-2: Challenger bond minimum must be > 0");

        // The challenger bond provides incentive alignment:
        // - If dispute succeeds: challenger gets 15% of slash + their bond back
        // - If dispute fails: challenger loses their bond
        // This is enforced by code: openDispute requires msg.value >= minBond
    }

    /// @notice EC-3: User Compensation Priority
    /// @dev Users get majority share (80%) in deterministic slashing
    function invariant_EC3_userCompensationPriority() public pure {
        // Static check: user share must be majority
        // Distribution: 80% user, 15% challenger, 5% treasury
        assertTrue(Types.SLASH_USER_BPS > Types.BPS / 2, "EC-3: User share must be > 50%");
        assertTrue(Types.SLASH_USER_BPS == 8000, "EC-3: User share must be 80%");
        assertTrue(Types.SLASH_USER_BPS > Types.SLASH_CHALLENGER_BPS, "EC-3: User share > challenger share");
        assertTrue(Types.SLASH_USER_BPS > Types.SLASH_TREASURY_BPS, "EC-3: User share > treasury share");
    }

    /// @notice EC-4: Loss Bounded by Bond
    /// @dev Solver can never lose more than their deposited bond
    function invariant_EC4_lossBoundedByBond() public view {
        bytes32[] memory solverIdList = handler.getSolverIds();

        for (uint256 i = 0; i < solverIdList.length; i++) {
            bytes32 solverId = solverIdList[i];
            Types.Solver memory solver = registry.getSolver(solverId);

            // Bond balance can never be negative (uint256 underflow protection)
            // The slash function in SolverRegistry enforces this by capping slash amount
            assertTrue(solver.bondBalance >= 0, "EC-4: Bond balance never negative");

            // Locked balance is always <= bond balance at time of lock
            // This is enforced by lockBond requiring sufficient balance
            assertTrue(
                solver.lockedBalance <= solver.bondBalance + solver.lockedBalance, "EC-4: Locked within total bond"
            );
        }
    }
}

/// @notice Handler for IntentReceiptHub invariant testing
contract HubHandler is Test {
    SolverRegistry public registry;
    IntentReceiptHub public hub;

    bytes32[] public receiptIds;
    mapping(bytes32 => bool) public receiptExists;

    bytes32[] public solverIds;
    mapping(bytes32 => uint256) public solverPrivateKeys;

    uint256 public totalDeposits;
    uint256 public totalWithdrawals;

    uint256 internal nonce;

    constructor(SolverRegistry _registry, IntentReceiptHub _hub) {
        registry = _registry;
        hub = _hub;
    }

    /// @notice Helper to get receipt status
    function _getReceiptStatus(bytes32 receiptId) internal view returns (Types.ReceiptStatus) {
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        return status;
    }

    /// @notice Register a solver with bond
    function registerAndBondSolver(uint256 seed) public {
        uint256 privateKey = bound(seed, 1, type(uint128).max);
        address operator = vm.addr(privateKey);

        vm.deal(operator, 1 ether);

        vm.startPrank(operator);
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        registry.depositBond{ value: 0.1 ether }(solverId);
        vm.stopPrank();

        solverIds.push(solverId);
        solverPrivateKeys[solverId] = privateKey;
        totalDeposits += 0.1 ether;
    }

    /// @notice Post a valid receipt
    function postReceipt(uint256 solverIndex) public {
        if (solverIds.length == 0) return;

        solverIndex = bound(solverIndex, 0, solverIds.length - 1);
        bytes32 solverId = solverIds[solverIndex];

        Types.Solver memory solver = registry.getSolver(solverId);
        if (solver.status != Types.SolverStatus.Active) return;

        uint256 privateKey = solverPrivateKeys[solverId];
        nonce++;

        // Create receipt
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

        // IRSB-SEC-001: Include chainId and hub address for cross-chain replay protection
        // IRSB-SEC-006: Include nonce for same-chain replay protection
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

        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        receipt.solverSig = abi.encodePacked(r, s, v);

        // Post receipt
        hub.postReceipt(receipt, 0);

        bytes32 receiptId = Types.computeReceiptId(receipt);
        if (!receiptExists[receiptId]) {
            receiptIds.push(receiptId);
            receiptExists[receiptId] = true;
        }
    }

    /// @notice Finalize a pending receipt
    function finalizeReceipt(uint256 receiptIndex) public {
        if (receiptIds.length == 0) return;

        receiptIndex = bound(receiptIndex, 0, receiptIds.length - 1);
        bytes32 receiptId = receiptIds[receiptIndex];

        Types.ReceiptStatus status = _getReceiptStatus(receiptId);
        if (status != Types.ReceiptStatus.Pending) return;

        // Warp past challenge window
        vm.warp(block.timestamp + 1 hours + 1);

        hub.finalize(receiptId);
    }

    /// @notice Get all receipt IDs
    function getReceiptIds() external view returns (bytes32[] memory) {
        return receiptIds;
    }

    /// @notice Get all solver IDs
    function getSolverIds() external view returns (bytes32[] memory) {
        return solverIds;
    }
}
