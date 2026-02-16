// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IIntentReceiptHub } from "./interfaces/IIntentReceiptHub.sol";
import { ISolverRegistry } from "./interfaces/ISolverRegistry.sol";
import { Types } from "./libraries/Types.sol";
import { IERC8004 } from "./interfaces/IERC8004.sol";

/// @title IntentReceiptHub
/// @notice Core contract for posting and managing intent receipts
/// @dev Handles receipt lifecycle, disputes, and settlement
contract IntentReceiptHub is IIntentReceiptHub, Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============

    /// @notice Default challenge window duration
    uint64 public constant DEFAULT_CHALLENGE_WINDOW = 1 hours;

    /// @notice Maximum batch size for posting receipts
    uint256 public constant MAX_BATCH_SIZE = 50;

    // ============ State ============

    /// @notice Reference to SolverRegistry
    ISolverRegistry public solverRegistry;

    /// @notice Challenge window duration
    uint64 public challengeWindow;

    /// @notice Receipt storage by ID
    mapping(bytes32 => Types.IntentReceipt) private _receipts;

    /// @notice Receipt status by ID
    mapping(bytes32 => Types.ReceiptStatus) private _receiptStatus;

    /// @notice Dispute storage by receipt ID
    mapping(bytes32 => Types.Dispute) private _disputes;

    /// @notice Settlement proofs by receipt ID
    mapping(bytes32 => bytes32) private _settlementProofs;

    /// @notice Receipts by solver (solverId => receiptId[])
    mapping(bytes32 => bytes32[]) private _solverReceipts;

    /// @notice Receipts by intent (intentHash => receiptId[])
    mapping(bytes32 => bytes32[]) private _intentReceipts;

    /// @notice DisputeModule address (v0.2)
    address public disputeModule;

    /// @notice Total receipts posted
    uint256 public totalReceipts;

    /// @notice Total disputes opened
    uint256 public totalDisputes;

    /// @notice Total amount slashed
    uint256 public totalSlashed;

    /// @notice Total forfeited bonds available for withdrawal
    /// @dev Tracks bonds from rejected disputes, safe to sweep without affecting active disputes
    uint256 public totalForfeitedBonds;

    /// @notice Challenger bonds by receipt ID
    mapping(bytes32 => uint256) private _challengerBonds;

    /// @notice Minimum challenger bond (10% of minimum solver bond)
    uint256 public challengerBondMin;

    /// @notice IRSB-SEC-006: Nonces for same-chain replay protection
    /// @dev Each solver's nonce increments with each receipt posted
    mapping(bytes32 => uint256) public solverNonces;

    /// @notice IRSB-SEC-006: Nonce used for each receipt (for signature re-verification)
    mapping(bytes32 => uint256) private _receiptNonces;

    /// @notice Declared volume per receipt for bond validation (PM-EC-001)
    mapping(bytes32 => uint256) private _receiptVolumes;

    /// @notice ERC-8004 adapter for publishing credibility signals (optional)
    address public erc8004Adapter;

    // ============ Events for ERC-8004 ============

    /// @notice Emitted when ERC-8004 adapter is updated
    event ERC8004AdapterUpdated(address indexed oldAdapter, address indexed newAdapter);

    // ============ Constructor ============

    constructor(address _solverRegistry) Ownable(msg.sender) {
        solverRegistry = ISolverRegistry(_solverRegistry);
        challengeWindow = DEFAULT_CHALLENGE_WINDOW;
        // Default challenger bond: 10% of minimum solver bond
        challengerBondMin = (solverRegistry.getMinimumBond() * Types.CHALLENGER_BOND_BPS) / Types.BPS;
    }

    // ============ Modifiers ============

    modifier receiptExists(bytes32 receiptId) {
        if (_receiptStatus[receiptId] == Types.ReceiptStatus.Pending && _receipts[receiptId].createdAt == 0) {
            revert ReceiptNotFound();
        }
        _;
    }

    modifier onlyDisputeModule() {
        require(msg.sender == disputeModule || msg.sender == owner(), "Not dispute module");
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IIntentReceiptHub
    function postReceipt(Types.IntentReceipt calldata receipt, uint256 declaredVolume)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 receiptId)
    {
        // Validate solver
        Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);
        if (solver.status != Types.SolverStatus.Active) revert InvalidSolver();
        if (solver.operator != msg.sender) revert InvalidSolver();

        // PM-EC-001: Validate solver has sufficient bond for declared volume
        uint256 requiredBond = solverRegistry.requiredBondForVolume(declaredVolume);
        if (solver.bondBalance < requiredBond) revert InsufficientBondForVolume();

        // Compute receipt ID
        receiptId = computeReceiptId(receipt);

        // Check for duplicates
        if (_receipts[receiptId].createdAt != 0) revert ReceiptAlreadyExists();

        // Verify signature (IRSB-SEC-001 + IRSB-SEC-006: chainId, contract address, and nonce for replay protection)
        uint256 currentNonce = solverNonces[receipt.solverId];
        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
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
        address signer = ethSignedHash.recover(receipt.solverSig);
        if (signer != solver.operator) revert InvalidReceiptSignature();

        // IRSB-SEC-006: Store nonce used and increment for next receipt
        _receiptNonces[receiptId] = currentNonce;
        solverNonces[receipt.solverId] = currentNonce + 1;

        // Store receipt
        _receipts[receiptId] = receipt;
        _receiptStatus[receiptId] = Types.ReceiptStatus.Pending;

        // PM-EC-001: Store declared volume for dispute reference and finalization
        _receiptVolumes[receiptId] = declaredVolume;

        // Index by solver and intent
        _solverReceipts[receipt.solverId].push(receiptId);
        _intentReceipts[receipt.intentHash].push(receiptId);

        totalReceipts++;

        emit ReceiptPosted(receiptId, receipt.intentHash, receipt.solverId, receipt.expiry);
    }

    /// @inheritdoc IIntentReceiptHub
    function openDispute(bytes32 receiptId, Types.DisputeReason reason, bytes32 evidenceHash)
        external
        payable
        receiptExists(receiptId)
        whenNotPaused
        nonReentrant
    {
        Types.ReceiptStatus status = _receiptStatus[receiptId];
        if (status != Types.ReceiptStatus.Pending) revert ReceiptNotPending();
        if (reason == Types.DisputeReason.None) revert InvalidDisputeReason();

        // Require challenger bond (anti-griefing protection)
        if (msg.value < challengerBondMin) revert InsufficientChallengerBond();

        Types.IntentReceipt storage receipt = _receipts[receiptId];

        // Check challenge window
        if (block.timestamp > receipt.createdAt + challengeWindow) {
            revert ChallengeWindowExpired();
        }

        // Store challenger bond
        _challengerBonds[receiptId] = msg.value;

        // Lock solver bond
        uint256 lockAmount = solverRegistry.getMinimumBond();
        solverRegistry.lockBond(receipt.solverId, lockAmount);

        // Create dispute
        _disputes[receiptId] = Types.Dispute({
            receiptId: receiptId,
            solverId: receipt.solverId,
            challenger: msg.sender,
            reason: reason,
            evidenceHash: evidenceHash,
            openedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 24 hours), // 24h resolution deadline
            resolved: false
        });

        _receiptStatus[receiptId] = Types.ReceiptStatus.Disputed;
        totalDisputes++;

        // Update solver dispute count
        solverRegistry.incrementDisputes(receipt.solverId);

        emit DisputeOpened(receiptId, receipt.solverId, msg.sender, reason);
    }

    /// @inheritdoc IIntentReceiptHub
    function resolveDeterministic(bytes32 receiptId) external receiptExists(receiptId) nonReentrant {
        Types.ReceiptStatus status = _receiptStatus[receiptId];
        if (status != Types.ReceiptStatus.Disputed) revert ReceiptNotPending();

        Types.Dispute storage dispute = _disputes[receiptId];
        if (dispute.resolved) revert DisputeAlreadyResolved();

        Types.IntentReceipt storage receipt = _receipts[receiptId];
        bool shouldSlash = false;
        uint256 slashAmount = solverRegistry.getMinimumBond();

        // Deterministic checks based on reason
        if (dispute.reason == Types.DisputeReason.Timeout) {
            // Check if receipt expired without settlement proof
            if (block.timestamp > receipt.expiry && _settlementProofs[receiptId] == bytes32(0)) {
                shouldSlash = true;
            }
        } else if (dispute.reason == Types.DisputeReason.InvalidSignature) {
            // Re-verify signature (IRSB-SEC-001 + IRSB-SEC-006: must match postReceipt format with stored nonce)
            bytes32 messageHash = keccak256(
                abi.encode(
                    block.chainid,
                    address(this),
                    _receiptNonces[receiptId],
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
            address signer = ethSignedHash.recover(receipt.solverSig);
            Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);
            if (signer != solver.operator) {
                shouldSlash = true;
            }
        }
        // MinOutViolation, WrongToken, etc. require off-chain verification
        // Those are handled by DisputeModule in v0.2

        dispute.resolved = true;
        uint256 challengerBond = _challengerBonds[receiptId];

        if (shouldSlash) {
            _receiptStatus[receiptId] = Types.ReceiptStatus.Slashed;

            // Slash distribution: 80% to user, 15% to challenger, 5% to treasury
            uint256 userShare = (slashAmount * Types.SLASH_USER_BPS) / Types.BPS;
            uint256 challengerShare = (slashAmount * Types.SLASH_CHALLENGER_BPS) / Types.BPS;
            uint256 treasuryShare = slashAmount - userShare - challengerShare;

            // Slash solver and pay user (TODO: should be original intent user, not challenger)
            solverRegistry.slash(receipt.solverId, userShare, receiptId, dispute.reason, dispute.challenger);

            // Slash solver for challenger's reward share - sent directly to challenger
            if (challengerShare > 0) {
                solverRegistry.slash(receipt.solverId, challengerShare, receiptId, dispute.reason, dispute.challenger);
            }

            // Return challenger's bond separately
            _challengerBonds[receiptId] = 0;
            (bool sent,) = dispute.challenger.call{ value: challengerBond }("");
            if (!sent) revert ChallengerBondTransferFailed();

            // Treasury share
            if (treasuryShare > 0) {
                solverRegistry.slash(receipt.solverId, treasuryShare, receiptId, dispute.reason, owner());
            }

            totalSlashed += slashAmount;

            emit DisputeResolved(receiptId, receipt.solverId, true, slashAmount);
        } else {
            // IRSB-SEC-003: Dispute rejected - finalize receipt to prevent re-challenge attacks
            // The receipt has survived a dispute challenge, confirming its validity
            solverRegistry.unlockBond(receipt.solverId, slashAmount);
            _receiptStatus[receiptId] = Types.ReceiptStatus.Finalized;

            // Update solver score for successful dispute defense
            solverRegistry.updateScore(receipt.solverId, true, 0);

            // Challenger loses their bond (griefing protection)
            // Track forfeited amount for safe withdrawal
            totalForfeitedBonds += challengerBond;
            _challengerBonds[receiptId] = 0;

            emit ChallengerBondForfeited(receiptId, dispute.challenger, challengerBond);
            emit ReceiptFinalized(receiptId, receipt.solverId);
            emit DisputeResolved(receiptId, receipt.solverId, false, 0);
        }
    }

    /// @inheritdoc IIntentReceiptHub
    function finalize(bytes32 receiptId) external receiptExists(receiptId) {
        Types.ReceiptStatus status = _receiptStatus[receiptId];
        if (status != Types.ReceiptStatus.Pending) revert ReceiptNotPending();

        Types.IntentReceipt storage receipt = _receipts[receiptId];

        // Must be past challenge window
        if (block.timestamp <= receipt.createdAt + challengeWindow) {
            revert ChallengeWindowActive();
        }

        _receiptStatus[receiptId] = Types.ReceiptStatus.Finalized;

        // Update solver score with declared volume (PM-EC-001: fixes volume=0 TODO)
        solverRegistry.updateScore(receipt.solverId, true, _receiptVolumes[receiptId]);

        // Publish to ERC-8004 adapter if configured (non-reverting)
        _publishToERC8004(receiptId, receipt.solverId, true, 0);

        emit ReceiptFinalized(receiptId, receipt.solverId);
    }

    /// @inheritdoc IIntentReceiptHub
    function submitSettlementProof(bytes32 receiptId, bytes32 proofHash) external receiptExists(receiptId) {
        Types.IntentReceipt storage receipt = _receipts[receiptId];
        Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);

        // Only solver operator can submit proof
        require(msg.sender == solver.operator, "Not solver operator");

        _settlementProofs[receiptId] = proofHash;

        emit SettlementProofSubmitted(receiptId, proofHash);
    }

    /// @inheritdoc IIntentReceiptHub
    /// @dev IRSB-SEC-009: Full validation including signature verification for each receipt
    function batchPostReceipts(Types.IntentReceipt[] calldata receipts, uint256[] calldata declaredVolumes)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32[] memory receiptIds)
    {
        require(receipts.length <= MAX_BATCH_SIZE, "Batch too large");
        require(receipts.length > 0, "Empty batch");
        require(receipts.length == declaredVolumes.length, "Volume array length mismatch");

        receiptIds = new bytes32[](receipts.length);

        for (uint256 i = 0; i < receipts.length; i++) {
            Types.IntentReceipt calldata receipt = receipts[i];

            // IRSB-SEC-009: Full validation for each receipt (same as postReceipt)
            // Validate solver
            Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);
            if (solver.status != Types.SolverStatus.Active) revert InvalidSolver();
            if (solver.operator != msg.sender) revert InvalidSolver();

            // PM-EC-001: Validate solver has sufficient bond for declared volume
            uint256 requiredBond = solverRegistry.requiredBondForVolume(declaredVolumes[i]);
            if (solver.bondBalance < requiredBond) revert InsufficientBondForVolume();

            // Compute receipt ID
            bytes32 receiptId = computeReceiptId(receipt);

            // Skip duplicates
            if (_receipts[receiptId].createdAt != 0) continue;

            // IRSB-SEC-006: Get current nonce for this solver
            uint256 currentNonce = solverNonces[receipt.solverId];

            // Verify signature (IRSB-SEC-001 + IRSB-SEC-006: chainId, contract address, and nonce)
            bytes32 messageHash = keccak256(
                abi.encode(
                    block.chainid,
                    address(this),
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
            address signer = ethSignedHash.recover(receipt.solverSig);
            if (signer != solver.operator) revert InvalidReceiptSignature();

            // IRSB-SEC-006: Store nonce used and increment for next receipt
            _receiptNonces[receiptId] = currentNonce;
            solverNonces[receipt.solverId] = currentNonce + 1;

            // Store receipt
            _receipts[receiptId] = receipt;
            _receiptStatus[receiptId] = Types.ReceiptStatus.Pending;
            _receiptVolumes[receiptId] = declaredVolumes[i];
            _solverReceipts[receipt.solverId].push(receiptId);
            _intentReceipts[receipt.intentHash].push(receiptId);

            receiptIds[i] = receiptId;
            totalReceipts++;

            emit ReceiptPosted(receiptId, receipt.intentHash, receipt.solverId, receipt.expiry);
        }
    }

    // ============ View Functions ============

    /// @inheritdoc IIntentReceiptHub
    function getReceipt(bytes32 receiptId)
        external
        view
        returns (Types.IntentReceipt memory receipt, Types.ReceiptStatus status)
    {
        return (_receipts[receiptId], _receiptStatus[receiptId]);
    }

    /// @inheritdoc IIntentReceiptHub
    function getDispute(bytes32 receiptId) external view returns (Types.Dispute memory) {
        return _disputes[receiptId];
    }

    /// @inheritdoc IIntentReceiptHub
    function canFinalize(bytes32 receiptId) external view returns (bool) {
        if (_receiptStatus[receiptId] != Types.ReceiptStatus.Pending) return false;
        Types.IntentReceipt storage receipt = _receipts[receiptId];
        return block.timestamp > receipt.createdAt + challengeWindow;
    }

    /// @inheritdoc IIntentReceiptHub
    function getReceiptsBySolver(bytes32 solverId, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] storage all = _solverReceipts[solverId];
        uint256 total = all.length;

        if (offset >= total) return new bytes32[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = all[i];
        }

        return result;
    }

    /// @inheritdoc IIntentReceiptHub
    function getReceiptsByIntent(bytes32 intentHash) external view returns (bytes32[] memory) {
        return _intentReceipts[intentHash];
    }

    /// @inheritdoc IIntentReceiptHub
    function getChallengeWindow() external view returns (uint64) {
        return challengeWindow;
    }

    /// @inheritdoc IIntentReceiptHub
    function computeReceiptId(Types.IntentReceipt calldata receipt) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
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
    }

    // ============ Admin Functions ============

    /// @notice Set dispute module address
    function setDisputeModule(address _disputeModule) external onlyOwner {
        disputeModule = _disputeModule;
    }

    /// @notice Update challenge window duration
    function setChallengeWindow(uint64 _challengeWindow) external onlyOwner {
        require(_challengeWindow >= 15 minutes, "Window too short");
        require(_challengeWindow <= 24 hours, "Window too long");
        challengeWindow = _challengeWindow;
    }

    /// @notice Update solver registry reference
    function setSolverRegistry(address _solverRegistry) external onlyOwner {
        solverRegistry = ISolverRegistry(_solverRegistry);
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Update minimum challenger bond
    /// @param _challengerBondMin New minimum bond in wei
    function setChallengerBondMin(uint256 _challengerBondMin) external onlyOwner {
        require(_challengerBondMin > 0, "Bond must be > 0");
        challengerBondMin = _challengerBondMin;
    }

    /// @notice Sweep forfeited challenger bonds to treasury
    /// @dev Only sweeps bonds from rejected disputes, not active challenger bonds
    /// @param treasury Address to receive funds
    function sweepForfeitedBonds(address treasury) external onlyOwner nonReentrant {
        uint256 amount = totalForfeitedBonds;
        if (amount == 0) revert NoForfeitedBonds();

        totalForfeitedBonds = 0;
        (bool sent,) = treasury.call{ value: amount }("");
        if (!sent) revert SweepTransferFailed();

        emit ForfeitedBondsSwept(treasury, amount);
    }

    /// @notice Get challenger bond amount for a receipt
    /// @param receiptId Receipt to query
    /// @return bond Bond amount in wei
    function getChallengerBond(bytes32 receiptId) external view returns (uint256 bond) {
        return _challengerBonds[receiptId];
    }

    /// @notice IRSB-SEC-006: Get the nonce used for a receipt's signature
    /// @param receiptId Receipt to query
    /// @return nonce The nonce used when the receipt was posted
    function getReceiptNonce(bytes32 receiptId) external view returns (uint256 nonce) {
        return _receiptNonces[receiptId];
    }

    /// @notice Resolve an escalated dispute (DisputeModule only)
    /// @param receiptId Receipt under dispute
    /// @param solverFault Whether solver was at fault
    function resolveEscalatedDispute(bytes32 receiptId, bool solverFault)
        external
        onlyDisputeModule
        receiptExists(receiptId)
    {
        Types.ReceiptStatus status = _receiptStatus[receiptId];
        if (status != Types.ReceiptStatus.Disputed) revert ReceiptNotPending();

        Types.Dispute storage dispute = _disputes[receiptId];
        if (dispute.resolved) revert DisputeAlreadyResolved();

        dispute.resolved = true;

        if (solverFault) {
            _receiptStatus[receiptId] = Types.ReceiptStatus.Slashed;
        } else {
            _receiptStatus[receiptId] = Types.ReceiptStatus.Finalized;
        }

        Types.IntentReceipt storage receipt = _receipts[receiptId];
        emit DisputeResolved(receiptId, receipt.solverId, solverFault, 0);

        // Publish to ERC-8004 adapter if configured
        _publishToERC8004(receiptId, receipt.solverId, !solverFault, 0);
    }

    // ============ ERC-8004 Integration ============

    /// @notice Set ERC-8004 adapter address
    /// @param _adapter New adapter address (can be zero to disable)
    function setERC8004Adapter(address _adapter) external onlyOwner {
        address oldAdapter = erc8004Adapter;
        erc8004Adapter = _adapter;
        emit ERC8004AdapterUpdated(oldAdapter, _adapter);
    }

    /// @notice Internal function to publish signals to ERC-8004 adapter
    /// @dev Non-reverting - adapter failures should not block core operations
    function _publishToERC8004(bytes32 receiptId, bytes32 solverId, bool success, uint256 slashAmount) internal {
        if (erc8004Adapter == address(0)) return;

        // Determine outcome based on success and slash amount
        IERC8004.ValidationOutcome outcome;
        if (success) {
            outcome = IERC8004.ValidationOutcome.Finalized;
        } else if (slashAmount > 0) {
            outcome = IERC8004.ValidationOutcome.Slashed;
        } else {
            outcome = IERC8004.ValidationOutcome.DisputeLost;
        }

        // Build metadata with slash amount if applicable
        bytes memory metadata = slashAmount > 0 ? abi.encode(slashAmount) : bytes("");

        // Try to call adapter - don't revert on failure
        try IERC8004(erc8004Adapter)
            .emitValidationSignal(
                IERC8004.ValidationSignal({
                    taskId: receiptId,
                    agentId: solverId,
                    outcome: outcome,
                    timestamp: block.timestamp,
                    evidenceHash: bytes32(0),
                    metadata: metadata
                })
            ) { }
            catch {
            // Adapter call failed - continue without reverting
            // This ensures core IRSB operations are never blocked by adapter issues
        }
    }

    /// @notice Receive ETH (for challenger bonds)
    receive() external payable { }
}
