// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

/// @title VulnerableVault — Deliberately Vulnerable Escrow + Bond Contract
/// @notice Educational contract with 4 vulnerability classes. DO NOT deploy to production.
/// @dev Inspired by IRSB's EscrowVault + SolverRegistry patterns, but WITHOUT their protections.
contract VulnerableVault {
    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public treasury;
    bool public paused;

    // Escrow: deposit ETH keyed by an intent ID
    struct Escrow {
        address depositor;
        uint256 amount;
        bool active;
    }
    mapping(bytes32 => Escrow) public escrows;

    // Bonds: solver registration with a minimum bond
    uint256 public constant MIN_BOND = 1 ether;
    mapping(bytes32 => bool) public registeredSolvers;

    // Rewards: solver reward pool
    uint256 public rewardPool;
    uint256 public constant REWARD_MULTIPLIER = 1e18;
    mapping(address => uint256) public rewardsClaimed;

    // Forfeited bonds pool
    uint256 public forfeitedBonds;

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(bytes32 indexed id, address depositor, uint256 amount);
    event Withdrawn(bytes32 indexed id, address depositor, uint256 amount);
    event SolverRegistered(bytes32 indexed solverId);
    event RewardClaimed(address indexed solver, uint256 amount);
    event TreasuryUpdated(address newTreasury);
    event Paused();
    event BondsSwept(uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
    }

    // ─── Deposit ──────────────────────────────────────────────────────────────

    /// @notice Deposit ETH into escrow for a given intent ID.
    function deposit(bytes32 id) external payable {
        require(!paused, "Paused");
        require(msg.value > 0, "Zero deposit");
        require(!escrows[id].active, "Already active");

        escrows[id] = Escrow({
            depositor: msg.sender,
            amount: msg.value,
            active: true
        });

        emit Deposited(id, msg.sender, msg.value);
    }

    // ─── Withdraw ─────────────────────────────────────────────────────────────

    /// @notice Withdraw escrow funds. Only the original depositor may withdraw.
    // VULNERABILITY: Reentrancy — ETH is sent BEFORE state is updated.
    // Compare with IRSB EscrowVault.sol:127-151 which uses CEI + nonReentrant.
    function withdraw(bytes32 id) external {
        require(!paused, "Paused");

        Escrow storage escrow = escrows[id];
        require(escrow.active, "Not active");
        require(escrow.depositor == msg.sender, "Not depositor");

        uint256 amount = escrow.amount;

        // VULNERABILITY: Interaction BEFORE Effects (violates CEI)
        // The external call happens while `escrow.active` is still true and
        // `escrow.amount` still holds the full value. A re-entrant call to
        // withdraw() will pass all checks again.
        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        // State update happens AFTER the external call — too late.
        escrow.active = false;
        escrow.amount = 0;

        emit Withdrawn(id, msg.sender, amount);
    }

    // ─── Solver Registration ──────────────────────────────────────────────────

    /// @notice Register a solver if it holds enough ETH as a bond.
    // VULNERABILITY: Flash Loan — checks the caller's ETH balance (a snapshot)
    // instead of requiring a deposited bond tracked in contract state.
    // Compare with IRSB SolverRegistry which uses internal bondBalance accounting.
    function registerSolver(bytes32 solverId) external {
        require(!paused, "Paused");
        require(!registeredSolvers[solverId], "Already registered");

        // VULNERABILITY: Balance check is meaningless with flash-loaned ETH.
        // An attacker borrows ETH, calls registerSolver, then repays — their
        // balance is high only during the transaction.
        require(msg.sender.balance >= MIN_BOND, "Insufficient bond");

        registeredSolvers[solverId] = true;

        emit SolverRegistered(solverId);
    }

    // ─── Reward Claim ─────────────────────────────────────────────────────────

    /// @notice Claim solver rewards with a multiplier.
    // VULNERABILITY: Integer Overflow — the `unchecked` block allows the
    // multiplication to silently wrap, producing arbitrary reward values.
    // In production, Solidity 0.8.25 default overflow checks prevent this.
    function claimReward(uint256 amount) external {
        require(!paused, "Paused");
        require(amount > 0, "Zero amount");

        uint256 reward;
        // VULNERABILITY: unchecked arithmetic allows overflow.
        // If amount * REWARD_MULTIPLIER > type(uint256).max, it wraps to a
        // small number — or a carefully chosen `amount` can produce any target.
        unchecked {
            reward = amount * REWARD_MULTIPLIER;
        }

        require(reward <= rewardPool, "Exceeds pool");

        rewardPool -= reward;
        rewardsClaimed[msg.sender] += reward;

        (bool sent,) = msg.sender.call{value: reward}("");
        require(sent, "Transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    /// @notice Update the treasury address.
    // VULNERABILITY: Access Control — no `onlyOwner` modifier. Anyone can call.
    // Compare with IRSB's three-tier access model (owner, authorized, operator).
    function setTreasury(address _treasury) external {
        // VULNERABILITY: Missing `require(msg.sender == owner)`.
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @notice Emergency pause.
    // VULNERABILITY: Access Control — no `onlyOwner` modifier. Anyone can pause.
    function pause() external {
        // VULNERABILITY: Missing `require(msg.sender == owner)`.
        paused = true;
        emit Paused();
    }

    /// @notice Sweep forfeited bonds to treasury.
    // VULNERABILITY: Access Control — no `onlyOwner` modifier. Anyone can sweep.
    function sweepBonds() external {
        // VULNERABILITY: Missing `require(msg.sender == owner)`.
        uint256 amount = forfeitedBonds;
        require(amount > 0, "Nothing to sweep");

        forfeitedBonds = 0;

        (bool sent,) = treasury.call{value: amount}("");
        require(sent, "Transfer failed");

        emit BondsSwept(amount);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /// @notice Fund the reward pool.
    function fundRewardPool() external payable {
        rewardPool += msg.value;
    }

    /// @notice Add to forfeited bonds (simulates a slash).
    function addForfeitedBonds() external payable {
        forfeitedBonds += msg.value;
    }

    /// @notice Accept ETH transfers (needed for flash loan repayments, etc.).
    receive() external payable {}
}
