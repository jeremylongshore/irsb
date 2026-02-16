// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ISolverRegistry } from "./interfaces/ISolverRegistry.sol";
import { Types } from "./libraries/Types.sol";
import { IERC8004 } from "./interfaces/IERC8004.sol";

/// @title SolverRegistry
/// @notice Manages solver registration, bonds, and lifecycle
/// @dev Core component of IRSB protocol
contract SolverRegistry is ISolverRegistry, Ownable, ReentrancyGuard, Pausable {
    // ============ Constants ============

    /// @notice Minimum bond required to activate solver
    uint256 public constant MINIMUM_BOND = 0.1 ether;

    /// @notice Cooldown period for withdrawals
    uint64 public constant WITHDRAWAL_COOLDOWN = 7 days;

    /// @notice Maximum jails before permanent ban
    uint8 public constant MAX_JAILS = 3;

    /// @notice Reputation decay half-life (30 days)
    /// @dev Score decays by 50% for every half-life period of inactivity
    uint64 public constant DECAY_HALF_LIFE = 30 days;

    /// @notice Minimum decay multiplier in basis points (10%)
    /// @dev Score never decays below this percentage of original
    uint16 public constant MIN_DECAY_MULTIPLIER_BPS = 1000;

    /// @notice Basis points denominator
    uint16 public constant BPS = 10000;

    // ============ State ============

    /// @notice Solver data by ID
    mapping(bytes32 => Types.Solver) private _solvers;

    /// @notice Operator address to solver ID mapping
    mapping(address => bytes32) private _operatorToSolver;

    /// @notice Jail count per solver
    mapping(bytes32 => uint8) private _jailCount;

    /// @notice Last withdrawal request timestamp
    mapping(bytes32 => uint64) private _withdrawalRequest;

    /// @notice Authorized contracts that can call restricted functions
    mapping(address => bool) public authorizedCallers;

    /// @notice Total registered solvers
    uint256 public totalSolvers;

    /// @notice Total value bonded
    uint256 public totalBonded;

    /// @notice Bond-to-volume ratio in basis points (PM-EC-001 fix)
    /// @dev 500 = 5%, meaning 1 ETH bond covers 20 ETH declared volume
    uint256 public bondRatioBps = 500;

    /// @notice ERC-8004 adapter for publishing validation signals
    address public erc8004Adapter;

    // ============ Events ============

    /// @notice Emitted when ERC-8004 adapter is updated
    event ERC8004AdapterUpdated(address indexed oldAdapter, address indexed newAdapter);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) { }

    // ============ Modifiers ============

    modifier onlyOperator(bytes32 solverId) {
        if (_solvers[solverId].operator != msg.sender) {
            revert NotSolverOperator();
        }
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    modifier solverExists(bytes32 solverId) {
        if (_solvers[solverId].registeredAt == 0) {
            revert SolverNotFound();
        }
        _;
    }

    modifier solverActive(bytes32 solverId) {
        Types.SolverStatus status = _solvers[solverId].status;
        if (status == Types.SolverStatus.Inactive) revert SolverNotActive();
        if (status == Types.SolverStatus.Jailed) revert SolverJailed();
        if (status == Types.SolverStatus.Banned) revert SolverBanned();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc ISolverRegistry
    function registerSolver(string calldata metadataURI, address operator)
        external
        whenNotPaused
        returns (bytes32 solverId)
    {
        if (operator == address(0)) revert InvalidOperatorAddress();
        if (_operatorToSolver[operator] != bytes32(0)) revert SolverAlreadyRegistered();

        // Generate unique solver ID
        solverId = keccak256(abi.encodePacked(operator, block.timestamp, totalSolvers));

        // Initialize solver
        _solvers[solverId] = Types.Solver({
            operator: operator,
            metadataURI: metadataURI,
            bondBalance: 0,
            lockedBalance: 0,
            status: Types.SolverStatus.Inactive,
            score: Types.IntentScore({
                totalFills: 0,
                successfulFills: 0,
                disputesOpened: 0,
                disputesLost: 0,
                volumeProcessed: 0,
                totalSlashed: 0
            }),
            registeredAt: uint64(block.timestamp),
            lastActivityAt: uint64(block.timestamp)
        });

        _operatorToSolver[operator] = solverId;
        totalSolvers++;

        emit SolverRegistered(solverId, operator, metadataURI);
    }

    /// @inheritdoc ISolverRegistry
    function depositBond(bytes32 solverId) external payable whenNotPaused solverExists(solverId) nonReentrant {
        require(msg.value > 0, "Zero deposit");

        Types.Solver storage solver = _solvers[solverId];

        // Only operator or owner can deposit
        require(msg.sender == solver.operator || msg.sender == owner(), "Not authorized to deposit");

        solver.bondBalance += msg.value;
        totalBonded += msg.value;

        // Activate solver if minimum bond met and currently inactive
        if (solver.status == Types.SolverStatus.Inactive && solver.bondBalance >= MINIMUM_BOND) {
            solver.status = Types.SolverStatus.Active;
            emit SolverStatusChanged(solverId, Types.SolverStatus.Inactive, Types.SolverStatus.Active);
        }

        emit BondDeposited(solverId, msg.value, solver.bondBalance);
    }

    /// @notice Initiate withdrawal cooldown
    /// @param solverId Solver to initiate withdrawal for
    function initiateWithdrawal(bytes32 solverId) external whenNotPaused solverExists(solverId) onlyOperator(solverId) {
        Types.Solver storage solver = _solvers[solverId];
        if (solver.lockedBalance > 0) revert BondLocked();
        if (_withdrawalRequest[solverId] != 0) revert WithdrawalCooldownActive();

        _withdrawalRequest[solverId] = uint64(block.timestamp);
    }

    /// @inheritdoc ISolverRegistry
    function withdrawBond(bytes32 solverId, uint256 amount)
        external
        whenNotPaused
        solverExists(solverId)
        onlyOperator(solverId)
        nonReentrant
    {
        Types.Solver storage solver = _solvers[solverId];

        // Cannot withdraw if bond is locked
        if (solver.lockedBalance > 0) revert BondLocked();

        // Check available balance
        uint256 available = solver.bondBalance;
        if (amount > available) revert InsufficientBond();

        // Check cooldown - must have been initiated
        uint64 requestTime = _withdrawalRequest[solverId];
        if (requestTime == 0) {
            revert WithdrawalCooldownActive();
        }
        if (block.timestamp < requestTime + WITHDRAWAL_COOLDOWN) {
            revert WithdrawalCooldownActive();
        }

        // Reset cooldown
        _withdrawalRequest[solverId] = 0;

        // Update balances
        solver.bondBalance -= amount;
        totalBonded -= amount;

        // Deactivate if below minimum
        if (solver.bondBalance < MINIMUM_BOND && solver.status == Types.SolverStatus.Active) {
            solver.status = Types.SolverStatus.Inactive;
            emit SolverStatusChanged(solverId, Types.SolverStatus.Active, Types.SolverStatus.Inactive);
        }

        // Transfer
        (bool success,) = payable(solver.operator).call{ value: amount }("");
        require(success, "Transfer failed");

        emit BondWithdrawn(solverId, amount, solver.bondBalance);
    }

    /// @inheritdoc ISolverRegistry
    function setSolverKey(bytes32 solverId, address newOperator)
        external
        solverExists(solverId)
        onlyOperator(solverId)
    {
        if (newOperator == address(0)) revert InvalidOperatorAddress();
        if (_operatorToSolver[newOperator] != bytes32(0)) revert SolverAlreadyRegistered();

        Types.Solver storage solver = _solvers[solverId];
        address oldOperator = solver.operator;

        // Update mappings
        delete _operatorToSolver[oldOperator];
        _operatorToSolver[newOperator] = solverId;
        solver.operator = newOperator;

        emit OperatorKeyRotated(solverId, oldOperator, newOperator);
    }

    /// @inheritdoc ISolverRegistry
    function lockBond(bytes32 solverId, uint256 amount) external onlyAuthorized solverExists(solverId) {
        Types.Solver storage solver = _solvers[solverId];
        require(solver.bondBalance >= amount, "Insufficient bond");

        solver.bondBalance -= amount;
        solver.lockedBalance += amount;
    }

    /// @inheritdoc ISolverRegistry
    function unlockBond(bytes32 solverId, uint256 amount) external onlyAuthorized solverExists(solverId) {
        Types.Solver storage solver = _solvers[solverId];
        require(solver.lockedBalance >= amount, "Insufficient locked");

        solver.lockedBalance -= amount;
        solver.bondBalance += amount;
    }

    /// @inheritdoc ISolverRegistry
    /// @dev IRSB-SEC-005: Validates that slash amount is non-zero to prevent silent failures
    function slash(bytes32 solverId, uint256 amount, bytes32 receiptId, Types.DisputeReason reason, address recipient)
        external
        onlyAuthorized
        solverExists(solverId)
        nonReentrant
    {
        // IRSB-SEC-005: Prevent zero-amount slashes that would be silent no-ops
        if (amount == 0) revert ZeroSlashAmount();

        Types.Solver storage solver = _solvers[solverId];

        // Slash from locked balance first, then available
        uint256 slashAmount = amount;
        if (solver.lockedBalance >= slashAmount) {
            solver.lockedBalance -= slashAmount;
        } else {
            slashAmount -= solver.lockedBalance;
            solver.lockedBalance = 0;
            require(solver.bondBalance >= slashAmount, "Insufficient total bond");
            solver.bondBalance -= slashAmount;
        }

        totalBonded -= amount;

        // Update score
        solver.score.disputesLost++;
        solver.score.totalSlashed += amount;

        // Transfer slashed amount to recipient
        (bool success,) = payable(recipient).call{ value: amount }("");
        require(success, "Slash transfer failed");

        emit SolverSlashed(solverId, amount, receiptId, reason);

        // Publish to ERC-8004 adapter (non-reverting)
        _publishToERC8004(receiptId, solverId, amount);

        // Check if should be deactivated or jailed
        if (solver.bondBalance < MINIMUM_BOND && solver.status == Types.SolverStatus.Active) {
            solver.status = Types.SolverStatus.Inactive;
            emit SolverStatusChanged(solverId, Types.SolverStatus.Active, Types.SolverStatus.Inactive);
        }
    }

    /// @inheritdoc ISolverRegistry
    function jailSolver(bytes32 solverId) external onlyAuthorized solverExists(solverId) {
        Types.Solver storage solver = _solvers[solverId];
        Types.SolverStatus oldStatus = solver.status;

        _jailCount[solverId]++;

        // Permanent ban after max jails
        if (_jailCount[solverId] >= MAX_JAILS) {
            solver.status = Types.SolverStatus.Banned;
            emit SolverStatusChanged(solverId, oldStatus, Types.SolverStatus.Banned);
        } else {
            solver.status = Types.SolverStatus.Jailed;
            emit SolverStatusChanged(solverId, oldStatus, Types.SolverStatus.Jailed);
        }
    }

    /// @inheritdoc ISolverRegistry
    function unjailSolver(bytes32 solverId) external onlyOwner solverExists(solverId) {
        Types.Solver storage solver = _solvers[solverId];
        require(solver.status == Types.SolverStatus.Jailed, "Not jailed");

        Types.SolverStatus newStatus =
            solver.bondBalance >= MINIMUM_BOND ? Types.SolverStatus.Active : Types.SolverStatus.Inactive;

        solver.status = newStatus;
        emit SolverStatusChanged(solverId, Types.SolverStatus.Jailed, newStatus);
    }

    /// @inheritdoc ISolverRegistry
    function banSolver(bytes32 solverId) external onlyOwner solverExists(solverId) {
        Types.Solver storage solver = _solvers[solverId];
        Types.SolverStatus oldStatus = solver.status;

        solver.status = Types.SolverStatus.Banned;
        emit SolverStatusChanged(solverId, oldStatus, Types.SolverStatus.Banned);
    }

    // ============ View Functions ============

    /// @inheritdoc ISolverRegistry
    function getSolver(bytes32 solverId) external view returns (Types.Solver memory) {
        return _solvers[solverId];
    }

    /// @inheritdoc ISolverRegistry
    function getSolverStatus(bytes32 solverId) external view returns (Types.SolverStatus) {
        return _solvers[solverId].status;
    }

    /// @inheritdoc ISolverRegistry
    function isValidSolver(bytes32 solverId, uint256 requiredBond) external view returns (bool) {
        Types.Solver storage solver = _solvers[solverId];
        return solver.status == Types.SolverStatus.Active && solver.bondBalance >= requiredBond;
    }

    /// @inheritdoc ISolverRegistry
    function getIntentScore(bytes32 solverId) external view returns (Types.IntentScore memory) {
        return _solvers[solverId].score;
    }

    /// @notice Get solver's reputation score with time-based decay applied
    /// @param solverId Solver to query
    /// @return decayedSuccessfulFills Decayed successful fills count
    /// @return decayedVolumeProcessed Decayed volume processed
    /// @return decayMultiplierBps Current decay multiplier in basis points
    function getDecayedScore(bytes32 solverId)
        external
        view
        returns (uint64 decayedSuccessfulFills, uint256 decayedVolumeProcessed, uint16 decayMultiplierBps)
    {
        Types.Solver storage solver = _solvers[solverId];
        decayMultiplierBps = getDecayMultiplier(solver.lastActivityAt);

        // Apply decay to positive reputation metrics
        decayedSuccessfulFills = uint64((uint256(solver.score.successfulFills) * decayMultiplierBps) / BPS);
        decayedVolumeProcessed = (solver.score.volumeProcessed * decayMultiplierBps) / BPS;
    }

    /// @notice Calculate decay multiplier based on time since last activity
    /// @param lastActivityAt Timestamp of last activity
    /// @return multiplierBps Decay multiplier in basis points (10000 = 100%)
    function getDecayMultiplier(uint64 lastActivityAt) public view returns (uint16) {
        if (lastActivityAt == 0) return MIN_DECAY_MULTIPLIER_BPS;
        if (block.timestamp <= lastActivityAt) return BPS;

        uint256 elapsed = block.timestamp - lastActivityAt;
        uint256 halfLives = elapsed / DECAY_HALF_LIFE;

        // After 13+ half-lives, return minimum
        if (halfLives >= 13) return MIN_DECAY_MULTIPLIER_BPS;

        // Calculate 2^(-halfLives) by repeated division
        uint256 result = BPS;
        for (uint256 i = 0; i < halfLives; i++) {
            result = result / 2;
        }

        // Apply fractional decay (linear approximation)
        uint256 remainder = elapsed % DECAY_HALF_LIFE;
        if (remainder > 0) {
            result = result - (result * remainder) / (DECAY_HALF_LIFE * 2);
        }

        // Enforce minimum floor
        return result < MIN_DECAY_MULTIPLIER_BPS ? MIN_DECAY_MULTIPLIER_BPS : uint16(result);
    }

    /// @inheritdoc ISolverRegistry
    function getSolverByOperator(address operator) external view returns (bytes32) {
        return _operatorToSolver[operator];
    }

    /// @inheritdoc ISolverRegistry
    function getMinimumBond() external pure returns (uint256) {
        return MINIMUM_BOND;
    }

    /// @notice Calculate required bond for a given declared volume (PM-EC-001)
    /// @param volume Declared transaction volume in wei
    /// @return required The required bond amount (max of MINIMUM_BOND and volume * bondRatioBps / BPS)
    function requiredBondForVolume(uint256 volume) public view returns (uint256) {
        uint256 volumeRequired = (volume * bondRatioBps) / BPS;
        return volumeRequired > MINIMUM_BOND ? volumeRequired : MINIMUM_BOND;
    }

    // ============ Admin Functions ============

    /// @notice Set authorized caller (IntentReceiptHub, DisputeModule)
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    /// @notice Update solver score (called by IntentReceiptHub)
    function updateScore(bytes32 solverId, bool success, uint256 volume)
        external
        onlyAuthorized
        solverExists(solverId)
    {
        Types.Solver storage solver = _solvers[solverId];
        solver.score.totalFills++;
        if (success) {
            solver.score.successfulFills++;
        }
        solver.score.volumeProcessed += volume;
        solver.lastActivityAt = uint64(block.timestamp);
    }

    /// @notice Increment disputes opened counter
    function incrementDisputes(bytes32 solverId) external onlyAuthorized solverExists(solverId) {
        _solvers[solverId].score.disputesOpened++;
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Set bond-to-volume ratio (PM-EC-001, governable via timelock)
    /// @param _bps New ratio in basis points (e.g. 500 = 5%)
    function setBondRatioBps(uint256 _bps) external onlyOwner {
        require(_bps > 0, "Ratio must be > 0");
        require(_bps <= BPS, "Ratio exceeds 100%");
        bondRatioBps = _bps;
    }

    /// @notice Set ERC-8004 adapter for validation signals
    /// @param _adapter New adapter address (can be zero to disable)
    function setERC8004Adapter(address _adapter) external onlyOwner {
        address oldAdapter = erc8004Adapter;
        erc8004Adapter = _adapter;
        emit ERC8004AdapterUpdated(oldAdapter, _adapter);
    }

    // ============ Internal Functions ============

    /// @notice Publish slash event to ERC-8004 adapter
    /// @dev Non-reverting - adapter failures don't block core slashing operations
    function _publishToERC8004(bytes32 receiptId, bytes32 solverId, uint256 slashAmount) internal {
        if (erc8004Adapter == address(0)) return;

        try IERC8004(erc8004Adapter)
            .emitValidationSignal(
                IERC8004.ValidationSignal({
                    taskId: receiptId,
                    agentId: solverId,
                    outcome: IERC8004.ValidationOutcome.Slashed,
                    timestamp: block.timestamp,
                    evidenceHash: bytes32(0),
                    metadata: abi.encode(slashAmount)
                })
            ) { }
            catch {
            // Adapter call failed - continue without reverting
            // Core IRSB operations are never blocked by adapter issues
        }
    }
}
