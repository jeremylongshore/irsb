// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { CredibilityRegistry } from "../src/CredibilityRegistry.sol";
import { ICredibilityRegistry } from "../src/interfaces/ICredibilityRegistry.sol";

contract CredibilityRegistryTest is Test {
    CredibilityRegistry public registry;

    address public owner = address(this);
    address public provider = address(0x100);
    address public unauthorized = address(0x200);

    bytes32 public solverId = keccak256("solver-1");
    bytes32 public taskId = keccak256("task-1");
    address public operator = address(0x300);
    bytes32 public metadataHash = keccak256("metadata");

    function setUp() public {
        registry = new CredibilityRegistry();
        registry.setAuthorizedProvider(provider, true);
    }

    // ============ Registration Tests ============

    function test_RegisterSolver() public {
        vm.prank(provider);
        registry.registerSolver(solverId, operator, metadataHash);

        ICredibilityRegistry.SolverIdentity memory identity = registry.getSolverIdentity(solverId);
        assertEq(identity.solverId, solverId);
        assertEq(identity.operator, operator);
        assertEq(identity.metadataHash, metadataHash);
        assertTrue(identity.status == ICredibilityRegistry.RegistrationStatus.Active);
        assertEq(registry.totalSolvers(), 1);
    }

    function test_RegisterSolver_RevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(CredibilityRegistry.UnauthorizedProvider.selector);
        registry.registerSolver(solverId, operator, metadataHash);
    }

    function test_RegisterSolver_RevertsDuplicate() public {
        vm.startPrank(provider);
        registry.registerSolver(solverId, operator, metadataHash);

        vm.expectRevert(CredibilityRegistry.SolverAlreadyRegistered.selector);
        registry.registerSolver(solverId, operator, metadataHash);
        vm.stopPrank();
    }

    function test_IsSolverActive() public {
        vm.prank(provider);
        registry.registerSolver(solverId, operator, metadataHash);

        assertTrue(registry.isSolverActive(solverId));
        assertFalse(registry.isSolverActive(keccak256("unknown")));
    }

    // ============ Validation Recording Tests ============

    function test_RecordValidation_Success() public {
        _registerSolver();

        ICredibilityRegistry.ValidationRecord memory record =
            _createValidationRecord(taskId, solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0);

        vm.prank(provider);
        registry.recordValidation(record);

        ICredibilityRegistry.ValidationRecord memory stored = registry.getValidation(taskId);
        assertEq(stored.taskId, taskId);
        assertEq(stored.solverId, solverId);
        assertTrue(stored.severity == ICredibilityRegistry.OutcomeSeverity.Success);
        assertEq(registry.totalValidations(), 1);
    }

    function test_RecordValidation_UpdatesReputation() public {
        _registerSolver();

        // Record 5 successes
        for (uint256 i = 0; i < 5; i++) {
            ICredibilityRegistry.ValidationRecord memory record = _createValidationRecord(
                keccak256(abi.encode("task", i)), solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0
            );
            vm.prank(provider);
            registry.recordValidation(record);
        }

        ICredibilityRegistry.ReputationSnapshot memory rep = registry.getReputation(solverId);
        assertEq(rep.totalTasks, 5);
        assertEq(rep.successfulTasks, 5);
        assertEq(rep.failedTasks, 0);
    }

    function test_RecordValidation_TracksSlashing() public {
        _registerSolver();

        ICredibilityRegistry.ValidationRecord memory record =
            _createValidationRecord(taskId, solverId, ICredibilityRegistry.OutcomeSeverity.SevereFault, 1 ether);

        vm.prank(provider);
        registry.recordValidation(record);

        ICredibilityRegistry.ReputationSnapshot memory rep = registry.getReputation(solverId);
        assertEq(rep.totalTasks, 1);
        assertEq(rep.failedTasks, 1);
        assertEq(rep.totalSlashed, 1 ether);
        assertEq(rep.slashCount, 1);
    }

    // ============ Dispute Resolution Tests ============

    function test_RecordDisputeResolution_SolverVindicated() public {
        _registerSolver();
        _recordValidation(taskId, solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0);

        vm.prank(provider);
        registry.recordDisputeResolution(taskId, ICredibilityRegistry.DisputeOutcome.SolverVindicated, 0);

        ICredibilityRegistry.ReputationSnapshot memory rep = registry.getReputation(solverId);
        assertEq(rep.disputedTasks, 1);
        assertEq(rep.disputesWon, 1);
        assertEq(rep.disputesLost, 0);
    }

    function test_RecordDisputeResolution_SolverFaulted() public {
        _registerSolver();
        _recordValidation(taskId, solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0);

        vm.prank(provider);
        registry.recordDisputeResolution(taskId, ICredibilityRegistry.DisputeOutcome.SolverFaulted, 0.5 ether);

        ICredibilityRegistry.ReputationSnapshot memory rep = registry.getReputation(solverId);
        assertEq(rep.disputesLost, 1);
        assertEq(rep.totalSlashed, 0.5 ether);
    }

    // ============ IntentScore Tests ============

    function test_GetIntentScore_NewSolver() public {
        _registerSolver();

        // New solver with < 10 tasks gets neutral score
        uint256 score = registry.getIntentScore(solverId);
        assertEq(score, 5000); // 50%
    }

    function test_GetIntentScore_PerfectRecord() public {
        _registerSolver();

        // Record 20 successes
        for (uint256 i = 0; i < 20; i++) {
            _recordValidation(
                keccak256(abi.encode("task", i)), solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0
            );
        }

        uint256 score = registry.getIntentScore(solverId);
        // Should be high: 40% success + 25% no disputes + some longevity
        assertGe(score, 6500);
    }

    function test_GetIntentScore_WithSlashes() public {
        _registerSolver();

        // Record 10 successes and 5 slashes
        for (uint256 i = 0; i < 10; i++) {
            _recordValidation(
                keccak256(abi.encode("success", i)), solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0
            );
        }
        for (uint256 i = 0; i < 5; i++) {
            _recordValidation(
                keccak256(abi.encode("fail", i)), solverId, ICredibilityRegistry.OutcomeSeverity.SevereFault, 0.1 ether
            );
        }

        uint256 score = registry.getIntentScore(solverId);
        // Should be lower due to slashes
        assertLt(score, 5000);
    }

    function test_GetSuccessRate() public {
        _registerSolver();

        // 7 successes, 3 failures = 70%
        for (uint256 i = 0; i < 7; i++) {
            _recordValidation(
                keccak256(abi.encode("success", i)), solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0
            );
        }
        for (uint256 i = 0; i < 3; i++) {
            _recordValidation(
                keccak256(abi.encode("fail", i)), solverId, ICredibilityRegistry.OutcomeSeverity.MinorFault, 0
            );
        }

        assertEq(registry.getSuccessRate(solverId), 7000); // 70%
    }

    function test_GetDisputeWinRate() public {
        _registerSolver();

        // Record tasks and disputes
        for (uint256 i = 0; i < 5; i++) {
            bytes32 tid = keccak256(abi.encode("task", i));
            _recordValidation(tid, solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0);

            vm.prank(provider);
            if (i < 3) {
                registry.recordDisputeResolution(tid, ICredibilityRegistry.DisputeOutcome.SolverVindicated, 0);
            } else {
                registry.recordDisputeResolution(tid, ICredibilityRegistry.DisputeOutcome.SolverFaulted, 0);
            }
        }

        // 3 wins out of 5 = 60%
        assertEq(registry.getDisputeWinRate(solverId), 6000);
    }

    // ============ Credibility Threshold Tests ============

    function test_MeetsCredibilityThreshold() public {
        _registerSolver();

        // Build good reputation
        for (uint256 i = 0; i < 20; i++) {
            _recordValidation(
                keccak256(abi.encode("task", i)), solverId, ICredibilityRegistry.OutcomeSeverity.Success, 0
            );
        }

        // Should meet reasonable thresholds
        assertTrue(registry.meetsCredibilityThreshold(solverId, 5000, 1000));

        // Should not meet very high thresholds
        assertFalse(registry.meetsCredibilityThreshold(solverId, 9500, 100));
    }

    // ============ Leaderboard Tests ============

    function test_Leaderboard_AddsSolvers() public {
        // Register multiple solvers with different performance
        for (uint256 i = 0; i < 5; i++) {
            bytes32 sid = keccak256(abi.encode("solver", i));
            vm.prank(provider);
            registry.registerSolver(sid, address(uint160(i + 1)), metadataHash);

            // Each solver gets different number of successes
            for (uint256 j = 0; j <= i * 3; j++) {
                _recordValidation(
                    keccak256(abi.encode("task", i, j)), sid, ICredibilityRegistry.OutcomeSeverity.Success, 0
                );
            }
        }

        (bytes32[] memory ids, uint256[] memory scores) = registry.getLeaderboard(0, 5);
        assertEq(ids.length, 5);

        // Scores should be in descending order
        for (uint256 i = 0; i < scores.length - 1; i++) {
            assertGe(scores[i], scores[i + 1]);
        }
    }

    // ============ Bond Update Tests ============

    function test_UpdateSolverBond() public {
        _registerSolver();

        vm.prank(provider);
        registry.updateSolverBond(solverId, 5 ether);

        ICredibilityRegistry.ReputationSnapshot memory rep = registry.getReputation(solverId);
        assertEq(rep.currentBond, 5 ether);
        assertEq(rep.peakBond, 5 ether);

        // Decrease bond
        vm.prank(provider);
        registry.updateSolverBond(solverId, 3 ether);

        rep = registry.getReputation(solverId);
        assertEq(rep.currentBond, 3 ether);
        assertEq(rep.peakBond, 5 ether); // Peak unchanged
    }

    // ============ Jail Recording Tests ============

    function test_RecordJail() public {
        _registerSolver();

        vm.prank(provider);
        registry.recordJail(solverId);

        ICredibilityRegistry.ReputationSnapshot memory rep = registry.getReputation(solverId);
        assertEq(rep.jailCount, 1);
    }

    // ============ Admin Tests ============

    function test_SetAuthorizedProvider() public {
        address newProvider = address(0x500);
        registry.setAuthorizedProvider(newProvider, true);
        assertTrue(registry.authorizedProviders(newProvider));
    }

    function test_SetOracleSigner() public {
        address signer = address(0x600);
        registry.setOracleSigner(signer, true);
        assertTrue(registry.oracleSigners(signer));
    }

    // ============ Helper Functions ============

    function _registerSolver() internal {
        vm.prank(provider);
        registry.registerSolver(solverId, operator, metadataHash);
    }

    function _recordValidation(
        bytes32 _taskId,
        bytes32 _solverId,
        ICredibilityRegistry.OutcomeSeverity severity,
        uint128 slashAmount
    ) internal {
        ICredibilityRegistry.ValidationRecord memory record =
            _createValidationRecord(_taskId, _solverId, severity, slashAmount);
        vm.prank(provider);
        registry.recordValidation(record);
    }

    function _createValidationRecord(
        bytes32 _taskId,
        bytes32 _solverId,
        ICredibilityRegistry.OutcomeSeverity severity,
        uint128 slashAmount
    ) internal view returns (ICredibilityRegistry.ValidationRecord memory) {
        return ICredibilityRegistry.ValidationRecord({
            taskId: _taskId,
            solverId: _solverId,
            intentHash: keccak256("intent"),
            evidenceHash: keccak256("evidence"),
            severity: severity,
            disputeResult: ICredibilityRegistry.DisputeOutcome.Pending,
            valueAtRisk: 1 ether,
            slashAmount: slashAmount,
            executedAt: uint64(block.timestamp),
            finalizedAt: 0,
            chainId: uint16(block.chainid)
        });
    }
}
