// SPDX-License-Identifier: MIT
pragma solidity 0.8.25;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SecureVault — Fixed Version with IRSB Production Patterns
/// @notice Mirrors VulnerableVault's API but applies all 4 fixes:
///   1. CEI + nonReentrant (cf. IRSB EscrowVault.sol:127-151)
///   2. Internal bond accounting (cf. IRSB SolverRegistry bondBalance)
///   3. Checked arithmetic (Solidity 0.8.25 default)
///   4. Owner-gated admin functions (cf. IRSB three-tier access model)
contract SecureVault is ReentrancyGuard {
    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public treasury;
    bool public paused;

    struct Escrow {
        address depositor;
        uint256 amount;
        bool active;
    }
    mapping(bytes32 => Escrow) public escrows;

    // FIX #2: Internal bond accounting — deposited bonds tracked in contract state
    uint256 public constant MIN_BOND = 1 ether;
    mapping(bytes32 => bool) public registeredSolvers;
    mapping(bytes32 => uint256) public depositedBonds;

    uint256 public rewardPool;
    uint256 public constant REWARD_MULTIPLIER = 1e18;
    mapping(address => uint256) public rewardsClaimed;

    uint256 public forfeitedBonds;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error NotOwner();
    error ContractPaused();

    // ─── Events ───────────────────────────────────────────────────────────────

    event Deposited(bytes32 indexed id, address depositor, uint256 amount);
    event Withdrawn(bytes32 indexed id, address depositor, uint256 amount);
    event SolverRegistered(bytes32 indexed solverId, uint256 bond);
    event RewardClaimed(address indexed solver, uint256 amount);
    event TreasuryUpdated(address newTreasury);
    event Paused();
    event BondsSwept(uint256 amount);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    // FIX #4: Access control modifier (cf. IRSB onlyOwner/onlyAuthorized)
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
    }

    // ─── Deposit ──────────────────────────────────────────────────────────────

    function deposit(bytes32 id) external payable whenNotPaused {
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

    // FIX #1: CEI pattern + nonReentrant guard
    // (cf. IRSB EscrowVault.sol:127-151 release() function)
    function withdraw(bytes32 id) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[id];
        require(escrow.active, "Not active");
        require(escrow.depositor == msg.sender, "Not depositor");

        uint256 amount = escrow.amount;

        // EFFECT: Update state BEFORE the external call
        escrow.active = false;
        escrow.amount = 0;

        // INTERACTION: Transfer after state update
        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit Withdrawn(id, msg.sender, amount);
    }

    // ─── Solver Registration ──────────────────────────────────────────────────

    // FIX #2: Require deposited bond tracked in contract state, not balance snapshot
    // (cf. IRSB SolverRegistry bondBalance/lockedBalance accounting)
    function registerSolver(bytes32 solverId) external payable whenNotPaused {
        require(!registeredSolvers[solverId], "Already registered");
        require(msg.value >= MIN_BOND, "Insufficient bond");

        registeredSolvers[solverId] = true;
        depositedBonds[solverId] = msg.value;

        emit SolverRegistered(solverId, msg.value);
    }

    // ─── Reward Claim ─────────────────────────────────────────────────────────

    // FIX #3: No `unchecked` block — Solidity 0.8.25 default overflow protection
    function claimReward(uint256 amount) external whenNotPaused {
        require(amount > 0, "Zero amount");

        // Checked arithmetic: overflows revert automatically
        uint256 reward = amount * REWARD_MULTIPLIER;

        require(reward <= rewardPool, "Exceeds pool");

        rewardPool -= reward;
        rewardsClaimed[msg.sender] += reward;

        (bool sent,) = msg.sender.call{value: reward}("");
        require(sent, "Transfer failed");

        emit RewardClaimed(msg.sender, reward);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    // FIX #4: onlyOwner modifier on all admin functions
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function sweepBonds() external onlyOwner {
        uint256 amount = forfeitedBonds;
        require(amount > 0, "Nothing to sweep");

        forfeitedBonds = 0;

        (bool sent,) = treasury.call{value: amount}("");
        require(sent, "Transfer failed");

        emit BondsSwept(amount);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function fundRewardPool() external payable {
        rewardPool += msg.value;
    }

    function addForfeitedBonds() external payable {
        forfeitedBonds += msg.value;
    }

    receive() external payable {}
}
