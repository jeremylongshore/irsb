// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IReceiptV2Extension } from "../interfaces/IReceiptV2Extension.sol";
import { ISolverRegistry } from "../interfaces/ISolverRegistry.sol";
import { Types } from "../libraries/Types.sol";
import { TypesV2 } from "../libraries/TypesV2.sol";
import { EIP712ReceiptV2 } from "../libraries/EIP712ReceiptV2.sol";

/// @title ReceiptV2Extension
/// @notice Extension for V2 receipts with dual attestation, commitments, and escrow linking
/// @dev Modular extension that integrates with IntentReceiptHub
contract ReceiptV2Extension is IReceiptV2Extension, Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // ============ Constants ============

    /// @notice Default challenge window duration (1 hour)
    uint64 public constant DEFAULT_CHALLENGE_WINDOW = 1 hours;

    /// @notice Maximum batch size for posting receipts
    uint256 public constant MAX_BATCH_SIZE = 50;

    // ============ Immutables ============

    /// @notice Cached domain separator (computed at deployment)
    bytes32 private immutable _cachedDomainSeparator;

    /// @notice Chain ID at deployment (for domain separator validation)
    uint256 private immutable _cachedChainId;

    // ============ State ============

    /// @notice Reference to SolverRegistry
    ISolverRegistry public solverRegistry;

    /// @notice Challenge window duration
    uint64 public override challengeWindow;

    /// @notice Minimum challenger bond
    uint256 public override challengerBondMin;

    /// @notice V2 Receipt storage by ID
    mapping(bytes32 => TypesV2.IntentReceiptV2) private _receiptsV2;

    /// @notice V2 Receipt status by ID
    mapping(bytes32 => TypesV2.ReceiptV2Status) private _receiptStatusV2;

    /// @notice Challenger info by receipt ID
    mapping(bytes32 => address) private _challengers;

    /// @notice Challenger bonds by receipt ID
    mapping(bytes32 => uint256) private _challengerBonds;

    /// @notice Dispute reason by receipt ID
    mapping(bytes32 => bytes32) private _disputeReasons;

    /// @notice Receipts by solver (solverId => receiptId[])
    mapping(bytes32 => bytes32[]) private _solverReceiptsV2;

    /// @notice Receipts by client (client => receiptId[])
    mapping(address => bytes32[]) private _clientReceiptsV2;

    /// @notice Total V2 receipts posted
    uint256 public totalReceiptsV2;

    /// @notice Total V2 disputes
    uint256 public totalDisputesV2;

    /// @notice Total forfeited challenger bonds available for sweep
    uint256 public totalForfeitedBonds;

    /// @notice Escrow vault address (for integration)
    address public escrowVault;

    /// @notice Optimistic dispute module address (authorized to manage bonds)
    address public optimisticDisputeModule;

    // ============ Constructor ============

    constructor(address _solverRegistry) Ownable(msg.sender) {
        solverRegistry = ISolverRegistry(_solverRegistry);
        challengeWindow = DEFAULT_CHALLENGE_WINDOW;

        // Default challenger bond: 10% of minimum solver bond
        challengerBondMin = (solverRegistry.getMinimumBond() * Types.CHALLENGER_BOND_BPS) / Types.BPS;

        // Cache domain separator
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = EIP712ReceiptV2.computeDomainSeparator(address(this));
    }

    // ============ External Functions ============

    /// @inheritdoc IReceiptV2Extension
    function postReceiptV2(TypesV2.IntentReceiptV2 calldata receipt)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 receiptId)
    {
        // Validate solver
        Types.Solver memory solver = solverRegistry.getSolver(receipt.solverId);
        if (solver.status != Types.SolverStatus.Active) revert SolverNotActive();
        if (solver.operator != msg.sender) revert NotSolverOperator();

        // Validate metadata commitment (must not be zero)
        if (receipt.metadataCommitment == bytes32(0)) revert InvalidMetadataCommitment();

        // Validate ciphertext pointer if provided
        if (bytes(receipt.ciphertextPointer).length > 0) {
            if (!TypesV2.isValidPointer(receipt.ciphertextPointer)) revert InvalidCiphertextPointer();
        }

        // Compute receipt ID
        receiptId = TypesV2.computeReceiptV2Id(receipt);

        // Check for duplicates
        if (_receiptsV2[receiptId].createdAt != 0) revert ReceiptV2AlreadyExists();

        // Verify EIP-712 signatures
        bytes32 digest = _computeDigest(receipt);

        // Verify solver signature (use tryRecover to get custom error)
        (address solverSigner, ECDSA.RecoverError solverErr,) = ECDSA.tryRecover(digest, receipt.solverSig);
        if (solverErr != ECDSA.RecoverError.NoError || solverSigner == address(0) || solverSigner != solver.operator) {
            revert InvalidSolverSignature();
        }

        // Verify client signature (use tryRecover to get custom error)
        (address clientSigner, ECDSA.RecoverError clientErr,) = ECDSA.tryRecover(digest, receipt.clientSig);
        if (clientErr != ECDSA.RecoverError.NoError || clientSigner == address(0) || clientSigner != receipt.client) {
            revert InvalidClientSignature();
        }

        // Store receipt
        _receiptsV2[receiptId] = receipt;
        _receiptStatusV2[receiptId] = TypesV2.ReceiptV2Status.Pending;

        // Index by solver and client
        _solverReceiptsV2[receipt.solverId].push(receiptId);
        _clientReceiptsV2[receipt.client].push(receiptId);

        totalReceiptsV2++;

        emit ReceiptV2Posted(
            receiptId,
            receipt.intentHash,
            receipt.solverId,
            receipt.client,
            receipt.metadataCommitment,
            receipt.privacyLevel,
            receipt.escrowId,
            receipt.expiry
        );
    }

    /// @inheritdoc IReceiptV2Extension
    function finalizeV2(bytes32 receiptId) external nonReentrant {
        TypesV2.ReceiptV2Status status = _receiptStatusV2[receiptId];
        if (status != TypesV2.ReceiptV2Status.Pending) revert ReceiptV2NotPending();

        TypesV2.IntentReceiptV2 storage receipt = _receiptsV2[receiptId];
        if (receipt.createdAt == 0) revert ReceiptV2NotFound();

        // Must be past challenge window
        if (block.timestamp <= receipt.createdAt + challengeWindow) {
            revert ChallengeWindowActive();
        }

        _receiptStatusV2[receiptId] = TypesV2.ReceiptV2Status.Finalized;

        // Update solver score
        solverRegistry.updateScore(receipt.solverId, true, 0);

        emit ReceiptV2Finalized(receiptId, receipt.solverId, receipt.escrowId);
    }

    /// @inheritdoc IReceiptV2Extension
    function openDisputeV2(bytes32 receiptId, bytes32 reasonHash, bytes32 evidenceHash)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        TypesV2.ReceiptV2Status status = _receiptStatusV2[receiptId];
        if (status != TypesV2.ReceiptV2Status.Pending) revert ReceiptV2NotPending();

        TypesV2.IntentReceiptV2 storage receipt = _receiptsV2[receiptId];
        if (receipt.createdAt == 0) revert ReceiptV2NotFound();

        // Check challenge window
        if (block.timestamp > receipt.createdAt + challengeWindow) {
            revert ChallengeWindowExpired();
        }

        // Require challenger bond
        if (msg.value < challengerBondMin) revert InsufficientBond();

        // Store challenger info
        _challengers[receiptId] = msg.sender;
        _challengerBonds[receiptId] = msg.value;
        _disputeReasons[receiptId] = reasonHash;

        // Lock solver bond
        uint256 lockAmount = solverRegistry.getMinimumBond();
        solverRegistry.lockBond(receipt.solverId, lockAmount);

        _receiptStatusV2[receiptId] = TypesV2.ReceiptV2Status.Disputed;
        totalDisputesV2++;

        // Update solver dispute count
        solverRegistry.incrementDisputes(receipt.solverId);

        emit ReceiptV2Disputed(receiptId, receipt.solverId, msg.sender, reasonHash);
    }

    // ============ View Functions ============

    /// @inheritdoc IReceiptV2Extension
    function getReceiptV2(bytes32 receiptId)
        external
        view
        returns (TypesV2.IntentReceiptV2 memory receipt, TypesV2.ReceiptV2Status status)
    {
        return (_receiptsV2[receiptId], _receiptStatusV2[receiptId]);
    }

    /// @inheritdoc IReceiptV2Extension
    function canFinalizeV2(bytes32 receiptId) external view returns (bool) {
        if (_receiptStatusV2[receiptId] != TypesV2.ReceiptV2Status.Pending) return false;
        TypesV2.IntentReceiptV2 storage receipt = _receiptsV2[receiptId];
        if (receipt.createdAt == 0) return false;
        return block.timestamp > receipt.createdAt + challengeWindow;
    }

    /// @inheritdoc IReceiptV2Extension
    function computeReceiptV2Id(TypesV2.IntentReceiptV2 calldata receipt) external pure returns (bytes32) {
        return TypesV2.computeReceiptV2Id(receipt);
    }

    /// @inheritdoc IReceiptV2Extension
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparator();
    }

    /// @notice Get receipts by solver
    /// @param solverId Solver to query
    /// @param offset Pagination offset
    /// @param limit Max results
    /// @return receiptIds Array of receipt IDs
    function getReceiptsV2BySolver(bytes32 solverId, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] storage all = _solverReceiptsV2[solverId];
        return _paginate(all, offset, limit);
    }

    /// @notice Get receipts by client
    /// @param client Client address to query
    /// @param offset Pagination offset
    /// @param limit Max results
    /// @return receiptIds Array of receipt IDs
    function getReceiptsV2ByClient(address client, uint256 offset, uint256 limit)
        external
        view
        returns (bytes32[] memory)
    {
        bytes32[] storage all = _clientReceiptsV2[client];
        return _paginate(all, offset, limit);
    }

    /// @notice Get challenger for a disputed receipt
    /// @param receiptId Receipt to query
    /// @return challenger Challenger address
    function getChallenger(bytes32 receiptId) external view returns (address) {
        return _challengers[receiptId];
    }

    /// @notice Get challenger bond for a receipt
    /// @param receiptId Receipt to query
    /// @return bond Bond amount
    function getChallengerBondV2(bytes32 receiptId) external view returns (uint256) {
        return _challengerBonds[receiptId];
    }

    // ============ Admin Functions ============

    /// @notice Set challenge window duration
    /// @param _challengeWindow New challenge window in seconds
    function setChallengeWindow(uint64 _challengeWindow) external onlyOwner {
        require(_challengeWindow >= 15 minutes, "Window too short");
        require(_challengeWindow <= 24 hours, "Window too long");
        challengeWindow = _challengeWindow;
    }

    /// @notice Set minimum challenger bond
    /// @param _challengerBondMin New minimum bond in wei
    function setChallengerBondMin(uint256 _challengerBondMin) external onlyOwner {
        require(_challengerBondMin > 0, "Bond must be > 0");
        challengerBondMin = _challengerBondMin;
    }

    /// @notice Set solver registry reference
    /// @param _solverRegistry New solver registry address
    function setSolverRegistry(address _solverRegistry) external onlyOwner {
        solverRegistry = ISolverRegistry(_solverRegistry);
    }

    /// @notice Set escrow vault address
    /// @param _escrowVault Escrow vault address
    function setEscrowVault(address _escrowVault) external onlyOwner {
        escrowVault = _escrowVault;
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Sweep forfeited challenger bonds to treasury
    /// @dev Only sweeps bonds explicitly marked as forfeited, not active dispute bonds
    /// @param treasury Address to receive funds
    function sweepForfeitedBonds(address treasury) external onlyOwner nonReentrant {
        uint256 amount = totalForfeitedBonds;
        require(amount > 0, "No forfeited bonds to sweep");
        require(address(this).balance >= amount, "Insufficient balance");

        totalForfeitedBonds = 0;
        (bool sent,) = treasury.call{ value: amount }("");
        require(sent, "Transfer failed");
    }

    /// @notice Mark a challenger bond as forfeited (callable by optimistic dispute module)
    /// @dev Called when a dispute resolves against the challenger
    /// @param receiptId Receipt whose challenger bond is forfeited
    function forfeitChallengerBond(bytes32 receiptId) external nonReentrant {
        require(msg.sender == optimisticDisputeModule || msg.sender == owner(), "Not authorized");

        uint256 bondAmount = _challengerBonds[receiptId];
        require(bondAmount > 0, "No bond to forfeit");
        require(_receiptStatusV2[receiptId] == TypesV2.ReceiptV2Status.Disputed, "Not disputed");

        _challengerBonds[receiptId] = 0;
        totalForfeitedBonds += bondAmount;

        emit ChallengerBondForfeited(receiptId, bondAmount);
    }

    /// @notice Return challenger bond (callable by optimistic dispute module)
    /// @dev Called when a dispute resolves in favor of the challenger
    /// @param receiptId Receipt whose challenger bond should be returned
    function returnChallengerBond(bytes32 receiptId) external nonReentrant {
        require(msg.sender == optimisticDisputeModule || msg.sender == owner(), "Not authorized");

        uint256 bondAmount = _challengerBonds[receiptId];
        address challenger = _challengers[receiptId];
        require(bondAmount > 0, "No bond to return");
        require(challenger != address(0), "No challenger");

        _challengerBonds[receiptId] = 0;
        (bool sent,) = challenger.call{ value: bondAmount }("");
        require(sent, "Transfer failed");

        emit ChallengerBondReturned(receiptId, challenger, bondAmount);
    }

    /// @notice Transfer challenger bond to a specific recipient (callable by optimistic dispute module)
    /// @dev Used when solver wins dispute - bond goes to solver as anti-griefing measure
    /// @param receiptId Receipt whose challenger bond should be transferred
    /// @param recipient Address to receive the bond
    function transferChallengerBondTo(bytes32 receiptId, address recipient) external nonReentrant {
        require(msg.sender == optimisticDisputeModule || msg.sender == owner(), "Not authorized");
        require(recipient != address(0), "Invalid recipient");

        uint256 bondAmount = _challengerBonds[receiptId];
        require(bondAmount > 0, "No bond to transfer");

        _challengerBonds[receiptId] = 0;
        (bool sent,) = recipient.call{ value: bondAmount }("");
        require(sent, "Transfer failed");

        emit ChallengerBondForfeited(receiptId, bondAmount);
    }

    /// @notice Set optimistic dispute module address
    /// @param _optimisticDisputeModule New optimistic dispute module address
    function setOptimisticDisputeModule(address _optimisticDisputeModule) external onlyOwner {
        optimisticDisputeModule = _optimisticDisputeModule;
    }

    // ============ Internal Functions ============

    /// @notice Get domain separator, recomputing if chain ID changed
    function _domainSeparator() internal view returns (bytes32) {
        if (block.chainid == _cachedChainId) {
            return _cachedDomainSeparator;
        }
        return EIP712ReceiptV2.computeDomainSeparator(address(this));
    }

    /// @notice Compute EIP-712 digest for a V2 receipt
    function _computeDigest(TypesV2.IntentReceiptV2 calldata receipt) internal view returns (bytes32) {
        bytes32 structHash = TypesV2.hashReceiptV2(receipt);
        return EIP712ReceiptV2.computeTypedDataHash(_domainSeparator(), structHash);
    }

    /// @notice Paginate an array
    function _paginate(bytes32[] storage all, uint256 offset, uint256 limit) internal view returns (bytes32[] memory) {
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

    /// @notice Receive ETH (for challenger bonds)
    receive() external payable { }
}
