// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { IEscrowVault } from "../../src/interfaces/IEscrowVault.sol";
import { Types } from "../../src/libraries/Types.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title BoundaryTests - Moloch DAO-Style Boundary Condition Testing
/// @notice Systematic 0, 1, MAX, MAX-1, MAX+1 for every numeric parameter
/// @dev Naming: test_boundary_[Contract]_[parameter]_[condition]
contract BoundaryTestsTest is Test {
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

    function _registerAndActivate() internal returns (bytes32 solverId) {
        solverId = registry.registerSolver("ipfs://test", operator);
        vm.prank(operator);
        registry.depositBond{ value: 0.5 ether }(solverId);
    }

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
    //              BOND AMOUNT BOUNDARIES (SolverRegistry)
    // ================================================================

    /// @notice 0 ETH deposit reverts
    function test_boundary_SolverRegistry_bondDeposit_zero() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);

        vm.prank(operator);
        vm.expectRevert("Zero deposit");
        registry.depositBond{ value: 0 }(solverId);
    }

    /// @notice 1 wei deposit: valid but stays Inactive
    function test_boundary_SolverRegistry_bondDeposit_oneWei() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);

        vm.prank(operator);
        registry.depositBond{ value: 1 }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, 1);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
    }

    /// @notice MINIMUM_BOND - 1: stays Inactive
    function test_boundary_SolverRegistry_bondDeposit_minimumMinusOne() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);

        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND - 1 }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
    }

    /// @notice MINIMUM_BOND exact: activates
    function test_boundary_SolverRegistry_bondDeposit_minimumExact() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);

        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Active));
    }

    /// @notice MINIMUM_BOND + 1: activates
    function test_boundary_SolverRegistry_bondDeposit_minimumPlusOne() public {
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);

        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND + 1 }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Active));
        assertEq(solver.bondBalance, MINIMUM_BOND + 1);
    }

    // ================================================================
    //           CHALLENGE WINDOW BOUNDARIES (IntentReceiptHub)
    // ================================================================

    /// @notice 14m59s: fails (too short)
    function test_boundary_IntentReceiptHub_challengeWindow_14m59s() public {
        vm.expectRevert("Window too short");
        hub.setChallengeWindow(14 minutes + 59 seconds);
    }

    /// @notice 15m exact: passes (minimum valid)
    function test_boundary_IntentReceiptHub_challengeWindow_15m() public {
        hub.setChallengeWindow(15 minutes);
        assertEq(hub.challengeWindow(), 15 minutes);
    }

    /// @notice 24h exact: passes (maximum valid)
    function test_boundary_IntentReceiptHub_challengeWindow_24h() public {
        hub.setChallengeWindow(24 hours);
        assertEq(hub.challengeWindow(), 24 hours);
    }

    /// @notice 24h+1s: fails (too long)
    function test_boundary_IntentReceiptHub_challengeWindow_24h1s() public {
        vm.expectRevert("Window too long");
        hub.setChallengeWindow(24 hours + 1 seconds);
    }

    // ================================================================
    //            BATCH SIZE BOUNDARIES (IntentReceiptHub)
    // ================================================================

    /// @notice 0 items: fails
    function test_boundary_IntentReceiptHub_batchSize_zero() public {
        Types.IntentReceipt[] memory empty = new Types.IntentReceipt[](0);

        vm.prank(operator);
        vm.expectRevert("Empty batch");
        hub.batchPostReceipts(empty);
    }

    /// @notice 1 item: valid minimum batch
    function test_boundary_IntentReceiptHub_batchSize_one() public {
        bytes32 solverId = _registerAndActivate();

        Types.IntentReceipt[] memory batch = new Types.IntentReceipt[](1);
        batch[0] = _createSignedReceipt(solverId, keccak256("intent1"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32[] memory ids = hub.batchPostReceipts(batch);
        assertEq(ids.length, 1);
        assertTrue(ids[0] != bytes32(0));
    }

    /// @notice 50 items: maximum valid batch
    function test_boundary_IntentReceiptHub_batchSize_max() public {
        bytes32 solverId = _registerAndActivate();

        Types.IntentReceipt[] memory batch = new Types.IntentReceipt[](50);
        uint256 baseNonce = hub.solverNonces(solverId);

        for (uint256 i = 0; i < 50; i++) {
            batch[i] = Types.IntentReceipt({
                intentHash: keccak256(abi.encodePacked("intent", i)),
                constraintsHash: keccak256("constraints"),
                routeHash: keccak256("route"),
                outcomeHash: keccak256("outcome"),
                evidenceHash: keccak256("evidence"),
                createdAt: uint64(block.timestamp + i),
                expiry: uint64(block.timestamp + 1 hours + i),
                solverId: solverId,
                solverSig: ""
            });

            // Sign with sequential nonce
            bytes32 messageHash = keccak256(
                abi.encode(
                    block.chainid,
                    address(hub),
                    baseNonce + i,
                    batch[i].intentHash,
                    batch[i].constraintsHash,
                    batch[i].routeHash,
                    batch[i].outcomeHash,
                    batch[i].evidenceHash,
                    batch[i].createdAt,
                    batch[i].expiry,
                    batch[i].solverId
                )
            );
            bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethSignedHash);
            batch[i].solverSig = abi.encodePacked(r, s, v);
        }

        vm.prank(operator);
        bytes32[] memory ids = hub.batchPostReceipts(batch);
        assertEq(ids.length, 50);
    }

    /// @notice 51 items: exceeds maximum
    function test_boundary_IntentReceiptHub_batchSize_maxPlusOne() public {
        Types.IntentReceipt[] memory batch = new Types.IntentReceipt[](51);

        vm.prank(operator);
        vm.expectRevert("Batch too large");
        hub.batchPostReceipts(batch);
    }

    // ================================================================
    //           ESCROW DEADLINE BOUNDARIES (EscrowVault)
    // ================================================================

    /// @notice deadline == block.timestamp: fails (not strictly future)
    function test_boundary_EscrowVault_deadline_currentTimestamp() public {
        vm.warp(1000);
        vm.expectRevert(abi.encodeWithSignature("InvalidDeadline()"));
        vault.createEscrow{ value: 1 ether }(
            keccak256("e"), keccak256("r"), address(this), uint64(block.timestamp)
        );
    }

    /// @notice deadline == block.timestamp + 1: passes (minimum valid)
    function test_boundary_EscrowVault_deadline_currentPlusOne() public {
        vm.warp(1000);
        vault.createEscrow{ value: 1 ether }(
            keccak256("e"), keccak256("r"), address(this), uint64(block.timestamp + 1)
        );

        IEscrowVault.Escrow memory escrow = vault.getEscrow(keccak256("e"));
        assertEq(uint256(escrow.status), uint256(IEscrowVault.EscrowStatus.Active));
    }

    // ================================================================
    //         FINALIZATION TIMING BOUNDARIES (IntentReceiptHub)
    // ================================================================

    /// @notice Finalize at exact challenge window end: fails (must be strictly after)
    function test_boundary_IntentReceiptHub_finalize_exactWindowEnd() public {
        bytes32 solverId = _registerAndActivate();
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(solverId, keccak256("intent"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        uint64 windowEnd = receipt.createdAt + hub.challengeWindow();
        vm.warp(windowEnd);

        vm.expectRevert(abi.encodeWithSignature("ChallengeWindowActive()"));
        hub.finalize(receiptId);
    }

    /// @notice Finalize 1 second after challenge window: passes
    function test_boundary_IntentReceiptHub_finalize_windowEndPlusOne() public {
        bytes32 solverId = _registerAndActivate();
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(solverId, keccak256("intent2"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        uint64 windowEnd = receipt.createdAt + hub.challengeWindow();
        vm.warp(windowEnd + 1);

        hub.finalize(receiptId);

        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(Types.ReceiptStatus.Finalized));
    }

    // ================================================================
    //           JAIL COUNT BOUNDARIES (SolverRegistry)
    // ================================================================

    /// @notice MAX_JAILS - 1 (2nd jail): solver is Jailed
    function test_boundary_SolverRegistry_jailCount_maxMinusOne() public {
        bytes32 solverId = _registerAndActivate();

        // First jail
        registry.jailSolver(solverId);
        assertEq(uint256(registry.getSolverStatus(solverId)), uint256(Types.SolverStatus.Jailed));

        // Unjail
        registry.unjailSolver(solverId);

        // Second jail (MAX_JAILS=3, this is jail #2)
        registry.jailSolver(solverId);
        assertEq(uint256(registry.getSolverStatus(solverId)), uint256(Types.SolverStatus.Jailed));
    }

    /// @notice MAX_JAILS (3rd jail): solver is permanently Banned
    function test_boundary_SolverRegistry_jailCount_max() public {
        bytes32 solverId = _registerAndActivate();

        // Jail 1 → unjail
        registry.jailSolver(solverId);
        registry.unjailSolver(solverId);

        // Jail 2 → unjail
        registry.jailSolver(solverId);
        registry.unjailSolver(solverId);

        // Jail 3 → BANNED
        registry.jailSolver(solverId);
        assertEq(uint256(registry.getSolverStatus(solverId)), uint256(Types.SolverStatus.Banned));
    }

    // ================================================================
    //         SLASH AMOUNT BOUNDARIES (SolverRegistry)
    // ================================================================

    /// @notice Zero-amount slash: reverts (IRSB-SEC-005)
    function test_boundary_SolverRegistry_slashAmount_zero() public {
        bytes32 solverId = _registerAndActivate();
        registry.lockBond(solverId, 0.1 ether);

        vm.expectRevert(abi.encodeWithSignature("ZeroSlashAmount()"));
        registry.slash(solverId, 0, bytes32(uint256(1)), Types.DisputeReason.Timeout, address(0x5));
    }

    /// @notice Slash exact locked amount
    function test_boundary_SolverRegistry_slashAmount_exactLocked() public {
        bytes32 solverId = _registerAndActivate();
        registry.lockBond(solverId, 0.2 ether);

        address recipient = address(0x5);
        registry.slash(solverId, 0.2 ether, bytes32(uint256(1)), Types.DisputeReason.Timeout, recipient);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.lockedBalance, 0, "Locked should be zeroed");
        assertEq(solver.bondBalance, 0.3 ether, "Available should be unchanged");
    }

    /// @notice Slash locked + 1 wei spills to available
    function test_boundary_SolverRegistry_slashAmount_lockedPlusOne() public {
        bytes32 solverId = _registerAndActivate();
        registry.lockBond(solverId, 0.2 ether);
        // bondBalance = 0.3 ether, lockedBalance = 0.2 ether

        address recipient = address(0x6);
        registry.slash(solverId, 0.2 ether + 1, bytes32(uint256(2)), Types.DisputeReason.Timeout, recipient);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.lockedBalance, 0, "Locked should be zeroed");
        assertEq(solver.bondBalance, 0.3 ether - 1, "1 wei should spill from available");
    }

    /// @notice Slash exact total bond (locked + available)
    function test_boundary_SolverRegistry_slashAmount_exactTotalBond() public {
        bytes32 solverId = _registerAndActivate();
        registry.lockBond(solverId, 0.2 ether);
        // bondBalance = 0.3, lockedBalance = 0.2, total = 0.5

        address recipient = address(0x7);
        registry.slash(solverId, 0.5 ether, bytes32(uint256(3)), Types.DisputeReason.Timeout, recipient);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.lockedBalance, 0);
        assertEq(solver.bondBalance, 0);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
    }

    /// @notice Slash exceeding total bond: reverts
    function test_boundary_SolverRegistry_slashAmount_exceedsTotalBond() public {
        bytes32 solverId = _registerAndActivate();
        registry.lockBond(solverId, 0.2 ether);

        vm.expectRevert("Insufficient total bond");
        registry.slash(solverId, 0.5 ether + 1, bytes32(uint256(4)), Types.DisputeReason.Timeout, address(0x8));
    }

    // ================================================================
    //      WITHDRAWAL COOLDOWN BOUNDARIES (SolverRegistry)
    // ================================================================

    /// @notice Withdraw at cooldown - 1 second: fails
    function test_boundary_SolverRegistry_withdrawalCooldown_beforeExpiry() public {
        bytes32 solverId = _registerAndActivate();
        vm.startPrank(operator);
        registry.initiateWithdrawal(solverId);

        vm.warp(block.timestamp + 7 days - 1);

        vm.expectRevert(abi.encodeWithSignature("WithdrawalCooldownActive()"));
        registry.withdrawBond(solverId, 0.1 ether);
        vm.stopPrank();
    }

    /// @notice Withdraw at cooldown + 1 second: succeeds
    function test_boundary_SolverRegistry_withdrawalCooldown_afterExpiry() public {
        bytes32 solverId = _registerAndActivate();
        vm.startPrank(operator);
        registry.initiateWithdrawal(solverId);

        vm.warp(block.timestamp + 7 days + 1);

        uint256 balBefore = operator.balance;
        registry.withdrawBond(solverId, 0.1 ether);
        assertEq(operator.balance - balBefore, 0.1 ether);
        vm.stopPrank();
    }

    // ================================================================
    //     CHALLENGER BOND BOUNDARIES (IntentReceiptHub)
    // ================================================================

    /// @notice Challenger bond exactly minimum: passes
    function test_boundary_IntentReceiptHub_challengerBond_exactMinimum() public {
        bytes32 solverId = _registerAndActivate();
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(solverId, keccak256("intent3"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        uint256 bondMin = hub.challengerBondMin();
        vm.prank(challenger);
        hub.openDispute{ value: bondMin }(receiptId, Types.DisputeReason.Timeout, keccak256("ev"));

        assertEq(hub.getChallengerBond(receiptId), bondMin);
    }

    /// @notice Challenger bond minimum - 1: fails
    function test_boundary_IntentReceiptHub_challengerBond_belowMinimum() public {
        bytes32 solverId = _registerAndActivate();
        Types.IntentReceipt memory receipt =
            _createSignedReceipt(solverId, keccak256("intent4"), uint64(block.timestamp + 1 hours));

        vm.prank(operator);
        bytes32 receiptId = hub.postReceipt(receipt);

        uint256 bondMin = hub.challengerBondMin();
        vm.prank(challenger);
        vm.expectRevert(abi.encodeWithSignature("InsufficientChallengerBond()"));
        hub.openDispute{ value: bondMin - 1 }(receiptId, Types.DisputeReason.Timeout, keccak256("ev"));
    }
}
