# 037-AT-GUID: Smart Contract Security Exercise

**Date:** 2026-02-10
**Category:** Architecture & Technical
**Type:** Guide
**Status:** Active

## Purpose

A hands-on exercise for protocol engineers to build intuition around 4 critical smart contract vulnerability classes by:

1. Reading deliberately vulnerable code
2. Running exploit tests that demonstrate each attack
3. Studying the fixed version (SecureVault) that mirrors IRSB production patterns
4. Cross-referencing real IRSB contracts to see how these protections work at scale

All code lives in `protocol/test/security-exercise/`.

## Prerequisites

- Foundry installed (`forge`, `cast`)
- Solidity 0.8.25 fundamentals (storage, msg.sender, call semantics)
- Basic understanding of the EVM execution model

## Files

| File | Purpose |
|------|---------|
| `VulnerableVault.sol` | Deliberately vulnerable escrow+bond contract (~160 lines) |
| `Attacker.sol` | Exploit contracts for reentrancy and flash loan attacks (~130 lines) |
| `SecureVault.sol` | Fixed version with IRSB production patterns (~170 lines) |
| `VulnerableVault.t.sol` | Foundry tests: exploit then fix (~250 lines) |

## Running the Exercise

```bash
# Run all security exercise tests with verbose output
forge test --match-path "test/security-exercise/*.t.sol" -vvv

# Run only exploit tests (demonstrate vulnerabilities)
forge test --match-path "test/security-exercise/*.t.sol" --match-test "test_exploit" -vvv

# Run only fix tests (demonstrate mitigations)
forge test --match-path "test/security-exercise/*.t.sol" --match-test "test_fix" -vvv
```

## Vulnerability Walkthroughs

### 1. Reentrancy

**Vulnerable code** (`VulnerableVault.sol:withdraw`):

```solidity
function withdraw(bytes32 id) external {
    Escrow storage escrow = escrows[id];
    require(escrow.active, "Not active");
    require(escrow.depositor == msg.sender, "Not depositor");

    uint256 amount = escrow.amount;

    // VULNERABILITY: Interaction BEFORE Effects
    (bool sent,) = msg.sender.call{value: amount}("");
    require(sent, "Transfer failed");

    // State update after external call -- too late
    escrow.active = false;
    escrow.amount = 0;
}
```

**How the exploit works:**

1. Attacker deposits 1 ETH into the vault (other users have 5 ETH already deposited)
2. Attacker calls `withdraw()` from a contract with a malicious `receive()` callback
3. The vault sends 1 ETH to the attacker contract, triggering `receive()`
4. Inside `receive()`, the attacker calls `withdraw()` again
5. The vault still shows `escrow.active = true` and `escrow.amount = 1 ETH` (state hasn't updated)
6. The vault sends another 1 ETH, triggering another re-entry
7. This repeats until the vault is drained (attacker gets 6 ETH total from a 1 ETH deposit)

**Test:** `test_exploit_reentrancy` -- attacker drains vault from 6 ETH to 0.

**Fix** (`SecureVault.sol:withdraw`):

```solidity
function withdraw(bytes32 id) external nonReentrant whenNotPaused {
    Escrow storage escrow = escrows[id];
    require(escrow.active, "Not active");
    require(escrow.depositor == msg.sender, "Not depositor");

    uint256 amount = escrow.amount;

    // EFFECT: Update state BEFORE external call
    escrow.active = false;
    escrow.amount = 0;

    // INTERACTION: Transfer after state update
    (bool sent,) = msg.sender.call{value: amount}("");
    require(sent, "Transfer failed");
}
```

**Two layers of defense:**
- **CEI (Checks-Effects-Interactions):** State updated before the external call
- **`nonReentrant` modifier:** OpenZeppelin's ReentrancyGuard blocks re-entrant calls entirely

**Test:** `test_fix_reentrancy` -- attack reverts, Alice's 5 ETH is safe.

**IRSB production reference:** `EscrowVault.sol:127-151` (`release()` function uses identical CEI + `nonReentrant` pattern).

---

### 2. Flash Loan (Balance-Based Bond Check)

**Vulnerable code** (`VulnerableVault.sol:registerSolver`):

```solidity
function registerSolver(bytes32 solverId) external {
    require(!registeredSolvers[solverId], "Already registered");

    // VULNERABILITY: Checks msg.sender's ETH balance (a snapshot)
    require(msg.sender.balance >= MIN_BOND, "Insufficient bond");

    registeredSolvers[solverId] = true;
}
```

**How the exploit works:**

1. Attacker has 0 ETH
2. Attacker borrows 1 ETH from a flash loan pool (MockLendingPool)
3. Attacker calls `registerSolver()` -- their balance is 1 ETH, passing the check
4. Attacker repays the flash loan in the same transaction
5. Result: Attacker is a registered solver with zero actual bond at risk

**Test:** `test_exploit_flashLoan` -- attacker registers as solver spending nothing.

**Fix** (`SecureVault.sol:registerSolver`):

```solidity
function registerSolver(bytes32 solverId) external payable whenNotPaused {
    require(!registeredSolvers[solverId], "Already registered");
    require(msg.value >= MIN_BOND, "Insufficient bond");

    registeredSolvers[solverId] = true;
    depositedBonds[solverId] = msg.value;  // Internal accounting
}
```

**Key insight:** Check `msg.value` (ETH actually deposited into the contract), not `msg.sender.balance` (a point-in-time snapshot that can be manipulated with flash loans). Track bonds in contract storage, not by inspecting external balances.

**Test:** `test_fix_flashLoan` -- registration requires deposited bond, tracked internally.

**IRSB production reference:** `SolverRegistry.sol` uses `bondBalance` and `lockedBalance` internal accounting. Bonds are deposited via `depositBond{value: amount}()`, never checked via `address.balance`.

---

### 3. Integer Overflow

**Vulnerable code** (`VulnerableVault.sol:claimReward`):

```solidity
function claimReward(uint256 amount) external {
    uint256 reward;
    // VULNERABILITY: unchecked arithmetic allows overflow
    unchecked {
        reward = amount * REWARD_MULTIPLIER;  // 1e18
    }

    require(reward <= rewardPool, "Exceeds pool");
    rewardPool -= reward;
    // ... transfer reward
}
```

**How the exploit works:**

1. `REWARD_MULTIPLIER` is `1e18`
2. Attacker passes `amount = (type(uint256).max / 1e18) + 1`
3. In the `unchecked` block, `amount * 1e18` overflows `uint256`, wrapping to a small number
4. The small overflow result passes the `reward <= rewardPool` check
5. Attacker claims rewards they shouldn't be entitled to

**Test:** `test_exploit_overflow` -- attacker claims ~0.4 ETH from the pool using overflow.

**Fix** (`SecureVault.sol:claimReward`):

```solidity
function claimReward(uint256 amount) external whenNotPaused {
    // Checked arithmetic: overflows revert automatically (Solidity 0.8 default)
    uint256 reward = amount * REWARD_MULTIPLIER;

    require(reward <= rewardPool, "Exceeds pool");
    rewardPool -= reward;
    // ... transfer reward
}
```

**Key insight:** Solidity 0.8+ has built-in overflow/underflow protection. The `unchecked` keyword explicitly opts out. Never use `unchecked` on user-controlled arithmetic unless you have a mathematical proof that overflow is impossible.

**Test:** `test_fix_overflow` -- arithmetic overflow reverts automatically.

**IRSB production reference:** All IRSB contracts compile with Solidity 0.8.25 and use default checked arithmetic. No `unchecked` blocks appear in any production contract.

---

### 4. Access Control

**Vulnerable code** (`VulnerableVault.sol`):

```solidity
function setTreasury(address _treasury) external {
    // VULNERABILITY: Missing require(msg.sender == owner)
    treasury = _treasury;
}

function pause() external {
    // VULNERABILITY: Missing require(msg.sender == owner)
    paused = true;
}

function sweepBonds() external {
    // VULNERABILITY: Missing require(msg.sender == owner)
    uint256 amount = forfeitedBonds;
    forfeitedBonds = 0;
    (bool sent,) = treasury.call{value: amount}("");
    require(sent, "Transfer failed");
}
```

**How the exploit works:**

1. Attacker calls `setTreasury(attackerAddress)` -- no access check
2. Attacker calls `sweepBonds()` -- forfeited bonds are sent to attacker's treasury
3. Alternatively, attacker calls `pause()` -- DoS against all legitimate users

**Tests:**
- `test_exploit_accessControl` -- attacker hijacks treasury, steals 3 ETH
- `test_exploit_accessControl_pause` -- attacker pauses entire contract

**Fix** (`SecureVault.sol`):

```solidity
error NotOwner();

modifier onlyOwner() {
    if (msg.sender != owner) revert NotOwner();
    _;
}

function setTreasury(address _treasury) external onlyOwner { ... }
function pause() external onlyOwner { ... }
function sweepBonds() external onlyOwner { ... }
```

**Tests:**
- `test_fix_accessControl` -- `NotOwner` reverts unauthorized treasury change
- `test_fix_accessControl_pause` -- `NotOwner` reverts unauthorized pause
- `test_fix_accessControl_sweep` -- `NotOwner` reverts unauthorized sweep

**IRSB production reference:** Three-tier access model:
- **`onlyOwner`** (Ownable): Contract configuration, pausing (e.g., `EscrowVault.setAuthorizedHub`)
- **`onlyAuthorized`**: Whitelisted callers like IntentReceiptHub, DisputeModule (e.g., `SolverRegistry.lockBond`)
- **`onlyOperator`**: Solver-specific operations (e.g., `SolverRegistry.depositBond`)

Custom error types (`revert NotOwner()`) are used instead of `require(msg.sender == owner, "...")` for gas efficiency.

## Key Takeaways

| Pattern | Rule | Why |
|---------|------|-----|
| **CEI** | Update state before external calls | Prevents re-entrant reads of stale state |
| **nonReentrant** | Defense-in-depth for any function with external calls | Belt-and-suspenders with CEI |
| **Internal accounting** | Track balances in storage, never via `address.balance` | External balances can be manipulated (flash loans, selfdestruct) |
| **Checked arithmetic** | Use Solidity 0.8+ defaults; avoid `unchecked` on user input | Silent overflow/underflow enables arbitrary value manipulation |
| **Explicit access control** | Every admin function needs a modifier | Missing checks = anyone can call critical functions |

## Further Reading

- [OWASP Smart Contract Top 10](https://owasp.org/www-project-smart-contract-top-10/)
- [SWC Registry](https://swcregistry.io/) (Smart Contract Weakness Classification)
- [OpenZeppelin ReentrancyGuard](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/ReentrancyGuard.sol)
- IRSB Security Audit: `009-AA-SEC-irsb-security-audit-v1.md`
- EIP-7702 Delegation Architecture: `030-DR-ARCH-eip7702-delegation-architecture.md`
