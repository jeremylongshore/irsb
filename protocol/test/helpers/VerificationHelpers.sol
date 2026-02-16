// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../../src/IntentReceiptHub.sol";
import { EscrowVault } from "../../src/EscrowVault.sol";
import { IEscrowVault } from "../../src/interfaces/IEscrowVault.sol";
import { Types } from "../../src/libraries/Types.sol";

/// @title VerificationHelpers - Moloch DAO-Style State Verification
/// @notice Reusable assertions for checking ALL fields after state transitions
/// @dev Inherit this in test contracts to get comprehensive verification functions
abstract contract VerificationHelpers is Test {
    /// @notice Verify solver state after a bond deposit
    function verifyPostDeposit(
        SolverRegistry registry,
        bytes32 solverId,
        uint256 expectedBond,
        Types.SolverStatus expectedStatus,
        uint256 expectedTotalBonded
    ) internal view {
        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, expectedBond, "Bond balance mismatch");
        assertEq(uint256(solver.status), uint256(expectedStatus), "Status mismatch after deposit");
        assertEq(registry.totalBonded(), expectedTotalBonded, "Total bonded mismatch");
    }

    /// @notice Verify solver state after a slash
    function verifyPostSlash(
        SolverRegistry registry,
        bytes32 solverId,
        uint256 expectedBond,
        uint256 expectedLocked,
        uint64 expectedDisputesLost,
        Types.SolverStatus expectedStatus
    ) internal view {
        Types.Solver memory solver = registry.getSolver(solverId);
        assertEq(solver.bondBalance, expectedBond, "Bond balance mismatch after slash");
        assertEq(solver.lockedBalance, expectedLocked, "Locked balance mismatch after slash");
        assertEq(solver.score.disputesLost, expectedDisputesLost, "Disputes lost mismatch");
        assertEq(uint256(solver.status), uint256(expectedStatus), "Status mismatch after slash");
    }

    /// @notice Verify receipt and dispute state after dispute opening
    function verifyPostDispute(
        IntentReceiptHub hub,
        bytes32 receiptId,
        Types.ReceiptStatus expectedStatus,
        address expectedChallenger,
        uint256 expectedBond
    ) internal view {
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(expectedStatus), "Receipt status mismatch after dispute");

        Types.Dispute memory dispute = hub.getDispute(receiptId);
        assertEq(dispute.challenger, expectedChallenger, "Challenger mismatch");
        assertFalse(dispute.resolved, "Dispute should not be resolved yet");
        assertEq(hub.getChallengerBond(receiptId), expectedBond, "Challenger bond mismatch");
    }

    /// @notice Verify receipt state after finalization
    function verifyPostFinalization(
        IntentReceiptHub hub,
        SolverRegistry registry,
        bytes32 receiptId,
        bytes32 solverId,
        Types.ReceiptStatus expectedStatus,
        uint64 expectedTotalFills
    ) internal view {
        (, Types.ReceiptStatus status) = hub.getReceipt(receiptId);
        assertEq(uint256(status), uint256(expectedStatus), "Receipt status mismatch after finalization");

        Types.IntentScore memory score = registry.getIntentScore(solverId);
        assertEq(score.totalFills, expectedTotalFills, "Total fills mismatch after finalization");
    }

    /// @notice Verify escrow state
    function verifyEscrowState(
        EscrowVault vault,
        bytes32 escrowId,
        IEscrowVault.EscrowStatus expectedStatus,
        uint256 expectedAmount
    ) internal view {
        IEscrowVault.Escrow memory escrow = vault.getEscrow(escrowId);
        assertEq(uint256(escrow.status), uint256(expectedStatus), "Escrow status mismatch");
        assertEq(escrow.amount, expectedAmount, "Escrow amount mismatch");
    }
}
