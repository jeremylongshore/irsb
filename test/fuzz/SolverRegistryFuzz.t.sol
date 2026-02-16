// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { Types } from "../../src/libraries/Types.sol";

/// @title SolverRegistryFuzz
/// @notice Fuzz tests for SolverRegistry invariants
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract SolverRegistryFuzz
contract SolverRegistryFuzz is Test {
    SolverRegistry public registry;

    address public owner = address(this);
    address public authorizedCaller = address(0xABC);
    address public operator;
    uint256 public operatorPrivateKey = 0x1234;

    uint256 public constant MINIMUM_BOND = 0.1 ether;

    bytes32 public solverId;

    function setUp() public {
        operator = vm.addr(operatorPrivateKey);
        vm.deal(address(this), 100 ether);
        vm.deal(operator, 100 ether);

        registry = new SolverRegistry();
        registry.setAuthorizedCaller(authorizedCaller, true);

        // Register a solver for testing
        vm.prank(operator);
        solverId = registry.registerSolver("ipfs://test", operator);
    }

    /// @notice Invariant: bondBalance + lockedBalance = totalDeposited (after any operations)
    function testFuzz_BondInvariant_TotalNeverExceedsDeposits(uint256 depositAmount) public {
        // Bound to reasonable range
        depositAmount = bound(depositAmount, MINIMUM_BOND, 10 ether);

        // Deposit bond
        vm.prank(operator);
        registry.depositBond{ value: depositAmount }(solverId);

        // Get solver state
        Types.Solver memory solver = registry.getSolver(solverId);

        // Invariant: total bond should equal deposited
        assertEq(solver.bondBalance + solver.lockedBalance, depositAmount, "Invariant violated: total != deposited");
    }

    /// @notice Invariant: locking bond maintains total invariant
    function testFuzz_LockMaintainsInvariant(uint256 depositAmount, uint256 lockAmount) public {
        depositAmount = bound(depositAmount, MINIMUM_BOND, 10 ether);

        // Deposit bond
        vm.prank(operator);
        registry.depositBond{ value: depositAmount }(solverId);

        // Lock some amount (must be <= deposit)
        lockAmount = bound(lockAmount, 0, depositAmount);

        vm.prank(authorizedCaller);
        registry.lockBond(solverId, lockAmount);

        // Verify invariant maintained
        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance + solver.lockedBalance, depositAmount, "Lock violated total invariant");
        assertEq(solver.lockedBalance, lockAmount, "Locked amount incorrect");
        assertEq(solver.bondBalance, depositAmount - lockAmount, "Available amount incorrect");
    }

    /// @notice Invariant: unlocking bond maintains total invariant
    function testFuzz_UnlockMaintainsInvariant(uint256 depositAmount, uint256 lockAmount, uint256 unlockAmount) public {
        depositAmount = bound(depositAmount, MINIMUM_BOND, 10 ether);
        lockAmount = bound(lockAmount, 0, depositAmount);

        // Setup: deposit and lock
        vm.prank(operator);
        registry.depositBond{ value: depositAmount }(solverId);

        vm.prank(authorizedCaller);
        registry.lockBond(solverId, lockAmount);

        // Unlock some amount (must be <= locked)
        unlockAmount = bound(unlockAmount, 0, lockAmount);

        vm.prank(authorizedCaller);
        registry.unlockBond(solverId, unlockAmount);

        // Verify invariant maintained
        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance + solver.lockedBalance, depositAmount, "Unlock violated total invariant");
    }

    /// @notice Invariant: slash correctly reduces total bond
    /// @dev IRSB-SEC-005: slashAmount must be > 0 (zero slashes now revert)
    function testFuzz_SlashReducesTotal(uint256 depositAmount, uint256 lockAmount, uint256 slashAmount) public {
        depositAmount = bound(depositAmount, MINIMUM_BOND, 10 ether);
        lockAmount = bound(lockAmount, MINIMUM_BOND / 2, depositAmount);
        // IRSB-SEC-005: slashAmount must be > 0 (zero slashes now revert)
        slashAmount = bound(slashAmount, 1, lockAmount);

        address recipient = address(0x999);

        // Setup
        vm.prank(operator);
        registry.depositBond{ value: depositAmount }(solverId);

        vm.prank(authorizedCaller);
        registry.lockBond(solverId, lockAmount);

        // Slash
        vm.prank(authorizedCaller);
        registry.slash(solverId, slashAmount, keccak256("receipt"), Types.DisputeReason.Timeout, recipient);

        // Verify total reduced by slash amount
        Types.Solver memory solver = registry.getSolver(solverId);
        uint256 finalTotal = solver.bondBalance + solver.lockedBalance;

        assertEq(finalTotal, depositAmount - slashAmount, "Slash did not reduce total correctly");
    }

    /// @notice Invariant: multiple deposits should accumulate correctly
    function testFuzz_MultipleDepositsAccumulate(uint256[5] memory amounts) public {
        uint256 totalDeposited = 0;

        for (uint256 i = 0; i < 5; i++) {
            amounts[i] = bound(amounts[i], 0.01 ether, 1 ether);
            totalDeposited += amounts[i];

            vm.prank(operator);
            registry.depositBond{ value: amounts[i] }(solverId);
        }

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, totalDeposited, "Multiple deposits did not accumulate correctly");
    }

    /// @notice Invariant: withdrawal reduces bond correctly
    function testFuzz_WithdrawalReducesBond(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount = bound(depositAmount, MINIMUM_BOND, 10 ether);
        withdrawAmount = bound(withdrawAmount, 0.01 ether, depositAmount);

        // Deposit
        vm.prank(operator);
        registry.depositBond{ value: depositAmount }(solverId);

        // Initiate and wait for withdrawal
        vm.prank(operator);
        registry.initiateWithdrawal(solverId);
        vm.warp(block.timestamp + 7 days + 1);

        // Withdraw
        vm.prank(operator);
        registry.withdrawBond(solverId, withdrawAmount);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, depositAmount - withdrawAmount, "Withdrawal amount incorrect");
    }

    /// @notice Invariant: score updates should never overflow
    function testFuzz_ScoreUpdatesNoOverflow(uint256 volume, bool success) public {
        volume = bound(volume, 0, type(uint128).max);

        // Deposit minimum bond to activate
        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Update score - should not revert
        vm.prank(authorizedCaller);
        registry.updateScore(solverId, success, volume);

        // Values should be valid
        Types.Solver memory solver = registry.getSolver(solverId);
        assertTrue(solver.score.totalFills > 0 || !success, "Total fills not updated");
        assertTrue(solver.score.volumeProcessed >= volume || !success, "Volume not tracked");
    }

    /// @notice Invariant: status transitions follow rules
    function testFuzz_StatusTransitionsValid(uint8 action) public {
        action = uint8(bound(action, 0, 2));

        // Deposit bond to activate
        vm.prank(operator);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint8(solver.status), uint8(Types.SolverStatus.Active), "Should be active after deposit");

        if (action == 0) {
            // Jail → Jailed
            registry.jailSolver(solverId);
            solver = registry.getSolver(solverId);
            assertEq(uint8(solver.status), uint8(Types.SolverStatus.Jailed), "Should be jailed");
        } else if (action == 1) {
            // Ban → Banned
            registry.banSolver(solverId);
            solver = registry.getSolver(solverId);
            assertEq(uint8(solver.status), uint8(Types.SolverStatus.Banned), "Should be banned");
        } else {
            // Withdraw below minimum → Inactive
            vm.prank(operator);
            registry.initiateWithdrawal(solverId);
            vm.warp(block.timestamp + 7 days + 1);
            vm.prank(operator);
            registry.withdrawBond(solverId, MINIMUM_BOND);

            solver = registry.getSolver(solverId);
            assertEq(uint8(solver.status), uint8(Types.SolverStatus.Inactive), "Should be inactive");
        }
    }
}
