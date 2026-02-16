// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Types } from "./Types.sol";

/// @title IRSB Events Library
/// @notice Consolidated events for indexing
library Events {
    /// @notice Emitted for any receipt lifecycle change
    event ReceiptLifecycle(
        bytes32 indexed receiptId,
        bytes32 indexed intentHash,
        bytes32 indexed solverId,
        Types.ReceiptStatus status,
        uint256 timestamp
    );

    /// @notice Emitted for solver reputation updates
    event IntentScoreUpdated(
        bytes32 indexed solverId,
        uint64 totalFills,
        uint64 successfulFills,
        uint64 disputesLost,
        uint256 volumeProcessed
    );

    /// @notice Emitted for protocol-level metrics
    event ProtocolMetrics(
        uint256 totalReceiptsPosted,
        uint256 totalDisputesOpened,
        uint256 totalSlashed,
        uint256 totalBonded,
        uint256 timestamp
    );
}
