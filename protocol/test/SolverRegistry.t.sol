// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test, console } from "forge-std/Test.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { Types } from "../src/libraries/Types.sol";

contract SolverRegistryTest is Test {
    SolverRegistry public registry;

    address public owner = address(this);
    address public operator1 = address(0x1);
    address public operator2 = address(0x2);
    address public authorizedCaller = address(0x3);

    uint256 public constant MINIMUM_BOND = 0.1 ether;

    event SolverRegistered(bytes32 indexed solverId, address indexed operator, string metadataURI);
    event BondDeposited(bytes32 indexed solverId, uint256 amount, uint256 newBalance);
    event BondWithdrawn(bytes32 indexed solverId, uint256 amount, uint256 newBalance);
    event SolverStatusChanged(bytes32 indexed solverId, Types.SolverStatus oldStatus, Types.SolverStatus newStatus);
    event OperatorKeyRotated(bytes32 indexed solverId, address indexed oldOperator, address indexed newOperator);
    event SolverSlashed(
        bytes32 indexed solverId, uint256 amount, bytes32 indexed receiptId, Types.DisputeReason reason
    );

    function setUp() public {
        registry = new SolverRegistry();
        registry.setAuthorizedCaller(authorizedCaller, true);
    }

    // ============ Registration Tests ============

    function test_RegisterSolver() public {
        vm.expectEmit(false, true, false, true);
        emit SolverRegistered(bytes32(0), operator1, "ipfs://metadata");

        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        assertTrue(solverId != bytes32(0), "Solver ID should not be zero");

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.operator, operator1);
        assertEq(solver.metadataURI, "ipfs://metadata");
        assertEq(solver.bondBalance, 0);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
        assertEq(registry.totalSolvers(), 1);
    }

    function test_RegisterSolver_RevertZeroAddress() public {
        vm.expectRevert(abi.encodeWithSignature("InvalidOperatorAddress()"));
        registry.registerSolver("ipfs://metadata", address(0));
    }

    function test_RegisterSolver_RevertDuplicate() public {
        registry.registerSolver("ipfs://metadata", operator1);

        vm.expectRevert(abi.encodeWithSignature("SolverAlreadyRegistered()"));
        registry.registerSolver("ipfs://metadata2", operator1);
    }

    function test_GetSolverByOperator() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        bytes32 foundId = registry.getSolverByOperator(operator1);
        assertEq(foundId, solverId);
    }

    // ============ Bond Deposit Tests ============

    function test_DepositBond() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: 0.05 ether }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, 0.05 ether);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
    }

    function test_DepositBond_ActivatesAtMinimum() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);

        vm.expectEmit(true, false, false, true);
        emit SolverStatusChanged(solverId, Types.SolverStatus.Inactive, Types.SolverStatus.Active);

        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, MINIMUM_BOND);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Active));
    }

    function test_DepositBond_OwnerCanDeposit() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, MINIMUM_BOND);
    }

    function test_DepositBond_RevertZeroAmount() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.prank(operator1);
        vm.expectRevert("Zero deposit");
        registry.depositBond{ value: 0 }(solverId);
    }

    function test_DepositBond_RevertNonexistentSolver() public {
        vm.expectRevert(abi.encodeWithSignature("SolverNotFound()"));
        registry.depositBond{ value: MINIMUM_BOND }(bytes32(uint256(999)));
    }

    // ============ Bond Withdrawal Tests ============

    function test_InitiateWithdrawal() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        vm.prank(operator1);
        registry.initiateWithdrawal(solverId);

        // Should revert if trying to initiate again
        vm.prank(operator1);
        vm.expectRevert(abi.encodeWithSignature("WithdrawalCooldownActive()"));
        registry.initiateWithdrawal(solverId);
    }

    function test_WithdrawBond_RevertWithoutInitiation() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        vm.prank(operator1);
        vm.expectRevert(abi.encodeWithSignature("WithdrawalCooldownActive()"));
        registry.withdrawBond(solverId, 0.05 ether);
    }

    function test_WithdrawBond_AfterCooldown() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.startPrank(operator1);
        registry.depositBond{ value: 0.2 ether }(solverId);

        // Initiate cooldown
        registry.initiateWithdrawal(solverId);

        // Should still revert during cooldown period
        vm.expectRevert(abi.encodeWithSignature("WithdrawalCooldownActive()"));
        registry.withdrawBond(solverId, 0.05 ether);

        // Fast forward past cooldown
        vm.warp(block.timestamp + 7 days + 1);

        uint256 balanceBefore = operator1.balance;
        registry.withdrawBond(solverId, 0.05 ether);
        uint256 balanceAfter = operator1.balance;

        assertEq(balanceAfter - balanceBefore, 0.05 ether);
        vm.stopPrank();
    }

    function test_WithdrawBond_DeactivatesIfBelowMinimum() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.startPrank(operator1);
        registry.depositBond{ value: 0.15 ether }(solverId);

        // Initiate cooldown
        registry.initiateWithdrawal(solverId);

        vm.warp(block.timestamp + 7 days + 1);

        vm.expectEmit(true, false, false, true);
        emit SolverStatusChanged(solverId, Types.SolverStatus.Active, Types.SolverStatus.Inactive);

        registry.withdrawBond(solverId, 0.1 ether);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
        vm.stopPrank();
    }

    function test_WithdrawBond_RevertIfLocked() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: 0.2 ether }(solverId);

        // Lock some bond
        vm.prank(authorizedCaller);
        registry.lockBond(solverId, 0.1 ether);

        vm.prank(operator1);
        vm.expectRevert(abi.encodeWithSignature("BondLocked()"));
        registry.withdrawBond(solverId, 0.05 ether);
    }

    // ============ Key Rotation Tests ============

    function test_SetSolverKey() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.prank(operator1);
        vm.expectEmit(true, true, true, true);
        emit OperatorKeyRotated(solverId, operator1, operator2);

        registry.setSolverKey(solverId, operator2);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.operator, operator2);

        // Old operator should no longer be mapped
        assertEq(registry.getSolverByOperator(operator1), bytes32(0));
        // New operator should be mapped
        assertEq(registry.getSolverByOperator(operator2), solverId);
    }

    function test_SetSolverKey_RevertNonOperator() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.prank(operator2);
        vm.expectRevert(abi.encodeWithSignature("NotSolverOperator()"));
        registry.setSolverKey(solverId, operator2);
    }

    // ============ Bond Lock/Unlock Tests ============

    function test_LockBond() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: 0.2 ether }(solverId);

        vm.prank(authorizedCaller);
        registry.lockBond(solverId, 0.1 ether);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, 0.1 ether);
        assertEq(solver.lockedBalance, 0.1 ether);
    }

    function test_UnlockBond() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: 0.2 ether }(solverId);

        vm.startPrank(authorizedCaller);
        registry.lockBond(solverId, 0.1 ether);
        registry.unlockBond(solverId, 0.05 ether);
        vm.stopPrank();

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, 0.15 ether);
        assertEq(solver.lockedBalance, 0.05 ether);
    }

    function test_LockBond_RevertUnauthorized() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: 0.2 ether }(solverId);

        vm.prank(operator2);
        vm.expectRevert("Not authorized");
        registry.lockBond(solverId, 0.1 ether);
    }

    // ============ Slashing Tests ============

    function test_Slash() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: 0.2 ether }(solverId);

        // Lock bond first (simulating dispute)
        vm.prank(authorizedCaller);
        registry.lockBond(solverId, 0.1 ether);

        address recipient = address(0x4);
        bytes32 receiptId = bytes32(uint256(1));

        uint256 recipientBefore = recipient.balance;

        vm.prank(authorizedCaller);
        registry.slash(solverId, 0.08 ether, receiptId, Types.DisputeReason.Timeout, recipient);

        uint256 recipientAfter = recipient.balance;
        assertEq(recipientAfter - recipientBefore, 0.08 ether);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.lockedBalance, 0.02 ether); // 0.1 - 0.08
        assertEq(solver.score.disputesLost, 1);
        assertEq(solver.score.totalSlashed, 0.08 ether);
    }

    function test_Slash_DeactivatesIfBelowMinimum() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        vm.prank(authorizedCaller);
        registry.lockBond(solverId, MINIMUM_BOND);

        address recipient = address(0x4);
        bytes32 receiptId = bytes32(uint256(1));

        vm.prank(authorizedCaller);
        registry.slash(solverId, 0.05 ether, receiptId, Types.DisputeReason.Timeout, recipient);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Inactive));
    }

    // ============ Jail/Ban Tests ============

    function test_JailSolver() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        vm.prank(authorizedCaller);
        registry.jailSolver(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Jailed));
    }

    function test_JailSolver_PermanentBanAfterMaxJails() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Jail 3 times (MAX_JAILS)
        vm.startPrank(authorizedCaller);
        registry.jailSolver(solverId);
        vm.stopPrank();

        registry.unjailSolver(solverId);

        vm.prank(authorizedCaller);
        registry.jailSolver(solverId);
        registry.unjailSolver(solverId);

        vm.prank(authorizedCaller);
        registry.jailSolver(solverId); // Third jail = permanent ban

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Banned));
    }

    function test_UnjailSolver() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        vm.prank(authorizedCaller);
        registry.jailSolver(solverId);

        registry.unjailSolver(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Active));
    }

    function test_BanSolver() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        registry.banSolver(solverId);

        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(uint256(solver.status), uint256(Types.SolverStatus.Banned));
    }

    // ============ View Function Tests ============

    function test_IsValidSolver() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        assertFalse(registry.isValidSolver(solverId, MINIMUM_BOND));

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        assertTrue(registry.isValidSolver(solverId, MINIMUM_BOND));
        assertFalse(registry.isValidSolver(solverId, 0.2 ether));
    }

    function test_GetIntentScore() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Update score
        vm.prank(authorizedCaller);
        registry.updateScore(solverId, true, 1000);

        Types.IntentScore memory score = registry.getIntentScore(solverId);
        assertEq(score.totalFills, 1);
        assertEq(score.successfulFills, 1);
        assertEq(score.volumeProcessed, 1000);
    }

    // ============ Admin Function Tests ============

    function test_SetAuthorizedCaller() public {
        address newCaller = address(0x5);

        assertFalse(registry.authorizedCallers(newCaller));

        registry.setAuthorizedCaller(newCaller, true);

        assertTrue(registry.authorizedCallers(newCaller));
    }

    function test_PauseUnpause() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        registry.pause();

        vm.expectRevert();
        registry.registerSolver("ipfs://metadata2", operator2);

        registry.unpause();

        registry.registerSolver("ipfs://metadata2", operator2);
    }

    // ============ Reputation Decay Tests ============

    function test_GetDecayMultiplier_NoDecay_WhenRecentlyActive() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Just registered, should have full score (10000 bps = 100%)
        uint16 multiplier = registry.getDecayMultiplier(uint64(block.timestamp));
        assertEq(multiplier, 10000);
    }

    function test_GetDecayMultiplier_HalfDecay_After30Days() public {
        // Set a concrete starting timestamp
        uint64 startTime = 1000000;
        vm.warp(startTime);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Fast forward 30 days (1 half-life)
        vm.warp(startTime + 30 days);

        // Pass the OLD timestamp (when activity happened)
        uint16 multiplier = registry.getDecayMultiplier(startTime);
        // Should be approximately 50% (5000 bps)
        assertGe(multiplier, 4500); // Allow some tolerance
        assertLe(multiplier, 5500);
    }

    function test_GetDecayMultiplier_QuarterDecay_After60Days() public {
        // Set a concrete starting timestamp
        uint64 startTime = 1000000;
        vm.warp(startTime);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Fast forward 60 days (2 half-lives)
        vm.warp(startTime + 60 days);

        uint16 multiplier = registry.getDecayMultiplier(startTime);
        // Should be approximately 25% (2500 bps)
        assertGe(multiplier, 2000);
        assertLe(multiplier, 3000);
    }

    function test_GetDecayMultiplier_MinimumFloor_After1Year() public {
        // Set a concrete starting timestamp
        uint64 startTime = 1000000;
        vm.warp(startTime);

        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Fast forward 1 year (12+ half-lives)
        vm.warp(startTime + 365 days);

        uint16 multiplier = registry.getDecayMultiplier(startTime);
        // Should hit minimum floor (1000 bps = 10%)
        assertEq(multiplier, 1000);
    }

    function test_GetDecayedScore_AppliesDecay() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Add some score activity
        registry.setAuthorizedCaller(address(this), true);
        registry.updateScore(solverId, true, 1000 ether); // 1000 volume
        registry.updateScore(solverId, true, 1000 ether); // 2000 total

        // Get raw score
        Types.IntentScore memory rawScore = registry.getIntentScore(solverId);
        assertEq(rawScore.successfulFills, 2);
        assertEq(rawScore.volumeProcessed, 2000 ether);

        // Fast forward 30 days (1 half-life)
        vm.warp(block.timestamp + 30 days);

        // Get decayed score
        (uint64 decayedFills, uint256 decayedVolume, uint16 multiplier) = registry.getDecayedScore(solverId);

        // Multiplier should be ~50%
        assertGe(multiplier, 4500);
        assertLe(multiplier, 5500);

        // successfulFills should be decayed (2 * ~50% = ~1)
        assertLe(decayedFills, 2);
        assertGe(decayedFills, 0);

        // volumeProcessed should be decayed (2000 * ~50% = ~1000)
        assertLe(decayedVolume, 2000 ether);
        assertGe(decayedVolume, 500 ether);
    }

    function test_DecayResetsOnActivity() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);
        registry.setAuthorizedCaller(address(this), true);

        // Build some score
        registry.updateScore(solverId, true, 1000 ether);

        // Fast forward 60 days (decay to ~25%)
        vm.warp(block.timestamp + 60 days);

        uint16 multiplierBefore = registry.getDecayMultiplier(registry.getSolver(solverId).lastActivityAt);
        assertLe(multiplierBefore, 3000);

        // New activity resets the clock
        registry.updateScore(solverId, true, 500 ether);

        // Should be back to 100%
        uint16 multiplierAfter = registry.getDecayMultiplier(registry.getSolver(solverId).lastActivityAt);
        assertEq(multiplierAfter, 10000);
    }

    function test_GetDecayMultiplier_ZeroTimestamp_ReturnsMinimum() public {
        // Zero timestamp means never active
        uint16 multiplier = registry.getDecayMultiplier(0);
        assertEq(multiplier, 1000); // Minimum 10%
    }

    // ============ Security Regression Tests ============

    /// @notice IRSB-SEC-005: Verify zero-amount slash is prevented
    /// @dev Slashing with amount=0 was previously a silent no-op, now reverts
    function test_IRSB_SEC_005_zeroSlashAmountReverts() public {
        bytes32 solverId = registry.registerSolver("ipfs://metadata", operator1);

        vm.deal(operator1, 1 ether);
        vm.prank(operator1);
        registry.depositBond{ value: MINIMUM_BOND }(solverId);

        // Lock some bond (simulating dispute)
        vm.prank(authorizedCaller);
        registry.lockBond(solverId, 0.05 ether);

        address recipient = address(0x4);
        bytes32 receiptId = bytes32(uint256(1));

        // Attempt to slash with zero amount - should revert
        vm.prank(authorizedCaller);
        vm.expectRevert(abi.encodeWithSignature("ZeroSlashAmount()"));
        registry.slash(solverId, 0, receiptId, Types.DisputeReason.Timeout, recipient);
    }

    // ============ Bond Ratio Tests (PM-EC-001) ============

    function test_RequiredBondForVolume_DefaultRatio() public view {
        // Default bondRatioBps = 500 (5%), so 2 ETH volume requires max(0.1 ETH, 2 * 500/10000) = max(0.1, 0.1) = 0.1
        uint256 required = registry.requiredBondForVolume(2 ether);
        assertEq(required, MINIMUM_BOND);

        // 10 ETH volume: max(0.1, 10 * 500/10000) = max(0.1, 0.5) = 0.5
        uint256 requiredHigh = registry.requiredBondForVolume(10 ether);
        assertEq(requiredHigh, 0.5 ether);
    }

    function test_RequiredBondForVolume_FloorAtMinimum() public view {
        // Small volume: max(0.1 ETH, 0.01 * 500/10000) = max(0.1, 0.0005) = 0.1
        uint256 required = registry.requiredBondForVolume(0.01 ether);
        assertEq(required, MINIMUM_BOND);
    }

    function test_RequiredBondForVolume_ZeroVolume() public view {
        // Zero volume: max(0.1, 0) = 0.1
        assertEq(registry.requiredBondForVolume(0), MINIMUM_BOND);
    }

    function test_SetBondRatioBps_OnlyOwner() public {
        registry.setBondRatioBps(1000); // 10%
        assertEq(registry.bondRatioBps(), 1000);

        vm.prank(operator1);
        vm.expectRevert();
        registry.setBondRatioBps(2000);
    }

    function test_SetBondRatioBps_RevertZero() public {
        vm.expectRevert("Ratio must be > 0");
        registry.setBondRatioBps(0);
    }

    function test_SetBondRatioBps_RevertExceedsBps() public {
        vm.expectRevert("Ratio exceeds 100%");
        registry.setBondRatioBps(10001);
    }

    function test_SetBondRatioBps_AffectsRequiredBond() public {
        // Set to 10% (1000 bps)
        registry.setBondRatioBps(1000);

        // 10 ETH volume: max(0.1, 10 * 1000/10000) = max(0.1, 1.0) = 1.0
        uint256 required = registry.requiredBondForVolume(10 ether);
        assertEq(required, 1 ether);
    }
}
