// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { ICredibilityRegistry } from "./interfaces/ICredibilityRegistry.sol";
import { IERC8004 } from "./interfaces/IERC8004.sol";

/// @title CredibilityRegistry
/// @notice Comprehensive on-chain credibility system for intent solvers
/// @dev Implements ICredibilityRegistry with full reputation tracking
/// @custom:security This contract is the source of truth for solver reputation
contract CredibilityRegistry is ICredibilityRegistry, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============

    /// @notice Maximum IntentScore (100%)
    uint256 public constant MAX_SCORE = 10_000;

    /// @notice Weight for success rate in IntentScore (40%)
    uint256 public constant WEIGHT_SUCCESS = 4_000;

    /// @notice Weight for dispute win rate in IntentScore (25%)
    uint256 public constant WEIGHT_DISPUTES = 2_500;

    /// @notice Weight for economic stake in IntentScore (20%)
    uint256 public constant WEIGHT_STAKE = 2_000;

    /// @notice Weight for longevity/activity in IntentScore (15%)
    uint256 public constant WEIGHT_LONGEVITY = 1_500;

    /// @notice Minimum tasks for reliable scoring
    uint256 public constant MIN_TASKS_FOR_SCORE = 10;

    /// @notice Time decay factor for reputation (seconds for 50% decay)
    uint256 public constant REPUTATION_HALF_LIFE = 90 days;

    // ============ State ============

    /// @notice Solver identities
    mapping(bytes32 => SolverIdentity) private _identities;

    /// @notice Solver reputations
    mapping(bytes32 => ReputationSnapshot) private _reputations;

    /// @notice Validation records
    mapping(bytes32 => ValidationRecord) private _validations;

    /// @notice Authorized validation providers (IRSB contracts)
    mapping(address => bool) public authorizedProviders;

    /// @notice Cross-chain oracle signers
    mapping(address => bool) public oracleSigners;

    /// @notice Imported cross-chain reputations
    mapping(bytes32 => mapping(uint16 => ReputationSnapshot)) private _crossChainReputations;

    /// @notice Leaderboard tracking (simplified - top 100)
    bytes32[] private _leaderboard;
    mapping(bytes32 => uint256) private _leaderboardIndex;

    /// @notice Total registered solvers
    uint256 public totalSolvers;

    /// @notice Total validations recorded
    uint256 public totalValidations;

    // ============ Events ============

    event ProviderAuthorized(address indexed provider, bool authorized);
    event OracleSignerUpdated(address indexed signer, bool authorized);

    // ============ Errors ============

    error UnauthorizedProvider();
    error SolverAlreadyRegistered();
    error SolverNotFound();
    error InvalidProof();
    error InvalidSignature();
    error ProofExpired();
    error ValidationAlreadyExists();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) { }

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (!authorizedProviders[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedProvider();
        }
        _;
    }

    // ============ Identity Functions ============

    /// @inheritdoc ICredibilityRegistry
    function registerSolver(bytes32 solverId, address operator, bytes32 metadataHash) external onlyAuthorized {
        if (_identities[solverId].registeredAt != 0) {
            revert SolverAlreadyRegistered();
        }

        _identities[solverId] = SolverIdentity({
            solverId: solverId,
            operator: operator,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            lastActiveAt: uint64(block.timestamp),
            status: RegistrationStatus.Active,
            chainId: uint16(block.chainid)
        });

        _reputations[solverId].snapshotAt = uint64(block.timestamp);

        totalSolvers++;

        emit SolverRegistered(solverId, operator, metadataHash, uint64(block.timestamp));
    }

    /// @inheritdoc ICredibilityRegistry
    function getSolverIdentity(bytes32 solverId) external view returns (SolverIdentity memory identity) {
        return _identities[solverId];
    }

    /// @inheritdoc ICredibilityRegistry
    function isSolverActive(bytes32 solverId) external view returns (bool active) {
        return _identities[solverId].status == RegistrationStatus.Active;
    }

    /// @notice Update solver status
    function updateSolverStatus(bytes32 solverId, RegistrationStatus newStatus, bytes32 reason)
        external
        onlyAuthorized
    {
        SolverIdentity storage identity = _identities[solverId];
        if (identity.registeredAt == 0) revert SolverNotFound();

        RegistrationStatus oldStatus = identity.status;
        identity.status = newStatus;

        emit SolverStatusChanged(solverId, oldStatus, newStatus, reason);
    }

    // ============ Validation Functions ============

    /// @inheritdoc ICredibilityRegistry
    function recordValidation(ValidationRecord calldata record) external onlyAuthorized {
        if (_validations[record.taskId].executedAt != 0) {
            revert ValidationAlreadyExists();
        }

        _validations[record.taskId] = record;

        // Update reputation snapshot
        ReputationSnapshot storage rep = _reputations[record.solverId];
        rep.totalTasks++;

        if (record.severity == OutcomeSeverity.Success) {
            rep.successfulTasks++;
        } else {
            rep.failedTasks++;
            if (record.slashAmount > 0) {
                rep.totalSlashed += record.slashAmount;
                rep.slashCount++;
                rep.lastSlashAt = uint64(block.timestamp);
            }
        }

        rep.snapshotAt = uint64(block.timestamp);

        // Update identity last active
        _identities[record.solverId].lastActiveAt = uint64(block.timestamp);

        totalValidations++;

        // Update leaderboard
        _updateLeaderboard(record.solverId);

        emit ValidationRecorded(
            record.taskId, record.solverId, record.severity, record.valueAtRisk, uint64(block.timestamp)
        );

        // Emit reputation update
        emit ReputationUpdated(
            record.solverId,
            rep.totalTasks,
            rep.successfulTasks,
            rep.totalSlashed,
            _calculateIntentScore(record.solverId)
        );
    }

    /// @inheritdoc ICredibilityRegistry
    function getValidation(bytes32 taskId) external view returns (ValidationRecord memory record) {
        return _validations[taskId];
    }

    /// @inheritdoc ICredibilityRegistry
    function recordDisputeResolution(bytes32 taskId, DisputeOutcome outcome, uint128 slashAmount)
        external
        onlyAuthorized
    {
        ValidationRecord storage record = _validations[taskId];
        record.disputeResult = outcome;
        record.slashAmount = slashAmount;
        record.finalizedAt = uint64(block.timestamp);

        ReputationSnapshot storage rep = _reputations[record.solverId];
        rep.disputedTasks++;

        if (outcome == DisputeOutcome.SolverVindicated) {
            rep.disputesWon++;
        } else if (outcome == DisputeOutcome.SolverFaulted) {
            rep.disputesLost++;
            if (slashAmount > 0) {
                rep.totalSlashed += slashAmount;
                rep.slashCount++;
                rep.lastSlashAt = uint64(block.timestamp);
            }
        } else if (outcome == DisputeOutcome.PartialFault) {
            rep.disputesPartial++;
            if (slashAmount > 0) {
                rep.totalSlashed += slashAmount;
            }
        }

        rep.snapshotAt = uint64(block.timestamp);

        _updateLeaderboard(record.solverId);

        emit DisputeResolved(taskId, record.solverId, outcome, slashAmount);
    }

    // ============ Reputation Functions ============

    /// @inheritdoc ICredibilityRegistry
    function getReputation(bytes32 solverId) external view returns (ReputationSnapshot memory snapshot) {
        return _reputations[solverId];
    }

    /// @inheritdoc ICredibilityRegistry
    function getIntentScore(bytes32 solverId) external view returns (uint256 score) {
        return _calculateIntentScore(solverId);
    }

    /// @inheritdoc ICredibilityRegistry
    function getSuccessRate(bytes32 solverId) external view returns (uint256 rate) {
        ReputationSnapshot storage rep = _reputations[solverId];
        if (rep.totalTasks == 0) return 0;
        return (uint256(rep.successfulTasks) * MAX_SCORE) / rep.totalTasks;
    }

    /// @inheritdoc ICredibilityRegistry
    function getDisputeWinRate(bytes32 solverId) external view returns (uint256 rate) {
        ReputationSnapshot storage rep = _reputations[solverId];
        uint256 totalDisputes = rep.disputesWon + rep.disputesLost + rep.disputesPartial;
        if (totalDisputes == 0) return MAX_SCORE; // No disputes = perfect
        return (uint256(rep.disputesWon) * MAX_SCORE) / totalDisputes;
    }

    /// @notice Internal IntentScore calculation
    function _calculateIntentScore(bytes32 solverId) internal view returns (uint256) {
        ReputationSnapshot storage rep = _reputations[solverId];
        SolverIdentity storage identity = _identities[solverId];

        // New solver with insufficient history
        if (rep.totalTasks < MIN_TASKS_FOR_SCORE) {
            return 5_000; // Neutral score
        }

        // 1. Success Rate Component (40%)
        uint256 successScore = (uint256(rep.successfulTasks) * WEIGHT_SUCCESS) / rep.totalTasks;

        // 2. Dispute Win Rate Component (25%)
        uint256 disputeScore;
        uint256 totalDisputes = rep.disputesWon + rep.disputesLost + rep.disputesPartial;
        if (totalDisputes == 0) {
            disputeScore = WEIGHT_DISPUTES; // Full points for no disputes
        } else {
            // Weight: wins = 100%, partial = 50%, losses = 0%
            uint256 weightedWins = rep.disputesWon * 100 + rep.disputesPartial * 50;
            disputeScore = (weightedWins * WEIGHT_DISPUTES) / (totalDisputes * 100);
        }

        // 3. Economic Stake Component (20%)
        uint256 stakeScore;
        if (rep.currentBond > 0) {
            // More stake = higher score, capped at 10 ETH equivalent
            uint256 stakeFactor = rep.currentBond > 10 ether ? 10 ether : rep.currentBond;
            stakeScore = (stakeFactor * WEIGHT_STAKE) / 10 ether;
        }

        // 4. Longevity/Activity Component (15%)
        uint256 longevityScore;
        if (identity.registeredAt > 0) {
            uint256 age = block.timestamp - identity.registeredAt;
            // Cap at 1 year for full points
            uint256 ageFactor = age > 365 days ? 365 days : age;
            longevityScore = (ageFactor * WEIGHT_LONGEVITY) / 365 days;

            // Decay if inactive
            if (identity.lastActiveAt > 0) {
                uint256 inactive = block.timestamp - identity.lastActiveAt;
                if (inactive > REPUTATION_HALF_LIFE) {
                    longevityScore = longevityScore / 2;
                }
            }
        }

        // 5. Slash Penalty
        uint256 slashPenalty = 0;
        if (rep.slashCount > 0) {
            // Each slash reduces score, up to 30% max penalty
            slashPenalty = rep.slashCount * 500; // 5% per slash
            if (slashPenalty > 3_000) slashPenalty = 3_000;
        }

        uint256 totalScore = successScore + disputeScore + stakeScore + longevityScore;

        // Apply penalty
        if (slashPenalty >= totalScore) return 0;
        return totalScore - slashPenalty;
    }

    // ============ Cross-Chain Functions ============

    /// @inheritdoc ICredibilityRegistry
    function verifyCrossChainProof(ReputationProof calldata proof) external view returns (bool valid) {
        // Check proof not expired (max 1 hour old)
        if (block.timestamp > proof.proofTimestamp + 1 hours) {
            return false;
        }

        // Verify signature from authorized oracle
        bytes32 messageHash =
            keccak256(abi.encode(proof.solverId, proof.snapshot, proof.merkleRoot, proof.proofTimestamp));

        address signer = messageHash.toEthSignedMessageHash().recover(proof.signature);
        if (!oracleSigners[signer]) {
            return false;
        }

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encode(proof.solverId, proof.snapshot));
        return MerkleProof.verify(proof.merkleProof, proof.merkleRoot, leaf);
    }

    /// @inheritdoc ICredibilityRegistry
    function importCrossChainReputation(ReputationProof calldata proof) external {
        if (!this.verifyCrossChainProof(proof)) {
            revert InvalidProof();
        }

        // Store cross-chain reputation
        _crossChainReputations[
            proof.solverId
        ][proof.snapshot.snapshotAt > 0 ? uint16(proof.snapshot.snapshotAt) : uint16(block.chainid)] = proof.snapshot;

        emit CrossChainProofVerified(proof.solverId, uint16(block.chainid), proof.merkleRoot, proof.proofTimestamp);
    }

    /// @inheritdoc ICredibilityRegistry
    function generateReputationRoot(bytes32 solverId) external view returns (bytes32 root) {
        ReputationSnapshot memory snapshot = _reputations[solverId];
        return keccak256(abi.encode(solverId, snapshot));
    }

    // ============ Query Functions ============

    /// @inheritdoc ICredibilityRegistry
    function getLeaderboard(uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory solverIds, uint256[] memory scores)
    {
        uint256 total = _leaderboard.length;
        if (offset >= total) {
            return (new bytes32[](0), new uint256[](0));
        }

        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        solverIds = new bytes32[](count);
        scores = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            solverIds[i] = _leaderboard[offset + i];
            scores[i] = _calculateIntentScore(solverIds[i]);
        }
    }

    /// @inheritdoc ICredibilityRegistry
    function meetsCredibilityThreshold(bytes32 solverId, uint256 minScore, uint256 maxSlashRate)
        external
        view
        returns (bool meets)
    {
        uint256 score = _calculateIntentScore(solverId);
        if (score < minScore) return false;

        ReputationSnapshot storage rep = _reputations[solverId];
        if (rep.totalTasks == 0) return true;

        uint256 slashRate = (rep.slashCount * MAX_SCORE) / rep.totalTasks;
        return slashRate <= maxSlashRate;
    }

    // ============ Leaderboard Management ============

    function _updateLeaderboard(bytes32 solverId) internal {
        uint256 score = _calculateIntentScore(solverId);
        uint256 existingIndex = _leaderboardIndex[solverId];

        // Not in leaderboard yet
        if (existingIndex == 0 && (_leaderboard.length == 0 || _leaderboard[0] != solverId)) {
            if (_leaderboard.length < 100) {
                _leaderboard.push(solverId);
                _leaderboardIndex[solverId] = _leaderboard.length;
                _sortLeaderboard();
            } else {
                // Check if score beats last place
                uint256 lastScore = _calculateIntentScore(_leaderboard[99]);
                if (score > lastScore) {
                    _leaderboardIndex[_leaderboard[99]] = 0;
                    _leaderboard[99] = solverId;
                    _leaderboardIndex[solverId] = 100;
                    _sortLeaderboard();
                }
            }
        } else if (existingIndex > 0) {
            // Already in leaderboard, re-sort
            _sortLeaderboard();
        }
    }

    function _sortLeaderboard() internal {
        // Simple bubble sort for small array (max 100)
        uint256 n = _leaderboard.length;
        for (uint256 i = 0; i < n - 1; i++) {
            for (uint256 j = 0; j < n - i - 1; j++) {
                if (_calculateIntentScore(_leaderboard[j]) < _calculateIntentScore(_leaderboard[j + 1])) {
                    bytes32 temp = _leaderboard[j];
                    _leaderboard[j] = _leaderboard[j + 1];
                    _leaderboard[j + 1] = temp;
                    _leaderboardIndex[_leaderboard[j]] = j + 1;
                    _leaderboardIndex[_leaderboard[j + 1]] = j + 2;
                }
            }
        }
    }

    // ============ Admin Functions ============

    /// @notice Authorize a validation provider
    function setAuthorizedProvider(address provider, bool authorized) external onlyOwner {
        authorizedProviders[provider] = authorized;
        emit ProviderAuthorized(provider, authorized);
    }

    /// @notice Set oracle signer for cross-chain proofs
    function setOracleSigner(address signer, bool authorized) external onlyOwner {
        oracleSigners[signer] = authorized;
        emit OracleSignerUpdated(signer, authorized);
    }

    /// @notice Update solver bond (called by SolverRegistry)
    function updateSolverBond(bytes32 solverId, uint128 newBond) external onlyAuthorized {
        ReputationSnapshot storage rep = _reputations[solverId];
        rep.currentBond = newBond;
        if (newBond > rep.peakBond) {
            rep.peakBond = newBond;
        }
        rep.snapshotAt = uint64(block.timestamp);
    }

    /// @notice Record jail event
    function recordJail(bytes32 solverId) external onlyAuthorized {
        _reputations[solverId].jailCount++;
        _reputations[solverId].snapshotAt = uint64(block.timestamp);
    }
}
