// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Types } from "../libraries/Types.sol";

/// @title IDisputeModule
/// @notice Interface for dispute resolution (v0.2 - pluggable arbitration)
interface IDisputeModule {
    // ============ Events ============

    /// @notice Emitted when evidence is submitted
    event EvidenceSubmitted(bytes32 indexed disputeId, address indexed submitter, bytes32 evidenceHash);

    /// @notice Emitted when dispute is escalated to arbitration
    event DisputeEscalated(bytes32 indexed disputeId, address indexed arbitrator);

    /// @notice Emitted when arbitrator resolves dispute
    event ArbitrationResolved(bytes32 indexed disputeId, bool solverFault, uint256 slashAmount, string reason);

    // ============ Errors ============

    error DisputeNotSubjective();
    error NotDisputeParty();
    error EvidenceWindowClosed();
    error AlreadyEscalated();
    error NotAuthorizedArbitrator();
    error InvalidResolution();
    error ArbitrationFeeTooLow();
    error DisputeAlreadyResolved();
    error ArbitrationTimeout();
    error NoFeesToWithdraw();
    error FeeWithdrawalFailed();

    // ============ Events (Additional) ============

    /// @notice Emitted when an escalator's arbitration fee is forfeited
    event ArbitrationFeeForfeited(bytes32 indexed disputeId, address indexed escalator, uint256 amount);

    /// @notice Emitted when forfeited fees are withdrawn to treasury
    event FeesWithdrawn(address indexed treasury, uint256 amount);

    // ============ External Functions ============

    /// @notice Submit additional evidence for a dispute
    /// @param disputeId Dispute to update
    /// @param evidenceHash New evidence hash
    function submitEvidence(bytes32 disputeId, bytes32 evidenceHash) external;

    /// @notice Escalate dispute to arbitration
    /// @param disputeId Dispute to escalate
    function escalate(bytes32 disputeId) external payable;

    /// @notice Resolve a subjective dispute (arbitrator only)
    /// @param disputeId Dispute to resolve
    /// @param solverFault Whether solver is at fault
    /// @param slashPercentage Percentage of bond to slash (0-100)
    /// @param reason Arbitration rationale
    function resolve(bytes32 disputeId, bool solverFault, uint8 slashPercentage, string calldata reason) external;

    // ============ View Functions ============

    /// @notice Get dispute evidence history
    /// @param disputeId Dispute to query
    /// @return evidenceHashes Array of evidence hashes
    /// @return submitters Array of submitter addresses
    /// @return timestamps Array of submission timestamps
    function getEvidenceHistory(bytes32 disputeId)
        external
        view
        returns (bytes32[] memory evidenceHashes, address[] memory submitters, uint64[] memory timestamps);

    /// @notice Check if dispute can be escalated
    /// @param disputeId Dispute to check
    /// @return canEscalate Whether dispute can be escalated
    function canEscalate(bytes32 disputeId) external view returns (bool canEscalate);

    /// @notice Get required arbitration fee
    /// @return fee Fee in wei
    function getArbitrationFee() external view returns (uint256 fee);

    /// @notice Get authorized arbitrator address
    /// @return arbitrator Arbitrator address
    function getArbitrator() external view returns (address arbitrator);

    /// @notice Check if dispute has been escalated
    /// @param disputeId Dispute to check
    /// @return escalated Whether dispute is escalated
    function isEscalated(bytes32 disputeId) external view returns (bool escalated);
}
