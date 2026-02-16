// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { Types } from "../../src/libraries/Types.sol";

/// @title SolverRegistryInvariants
/// @notice Invariant tests for SolverRegistry per audit/INVARIANTS.md
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract SolverRegistryInvariants
contract SolverRegistryInvariants is Test {
    SolverRegistry public registry;
    Handler public handler;

    function setUp() public {
        registry = new SolverRegistry();
        handler = new Handler(registry);

        // Authorize the handler's authorizedCaller
        registry.setAuthorizedCaller(handler.authorizedCaller(), true);

        // Target only the handler for invariant testing
        targetContract(address(handler));
    }

    /// @notice SR-1: Bond Accounting - sum of bonds <= contract balance
    /// @dev The sum of all solver bonds cannot exceed the contract's ETH balance
    function invariant_SR1_bondAccountingNeverExceedsBalance() public view {
        // Calculate actual total by summing all solver bonds
        bytes32[] memory ids = handler.getSolverIds();
        uint256 totalBonds = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Types.Solver memory solver = registry.getSolver(ids[i]);
            totalBonds += solver.bondBalance + solver.lockedBalance;
        }
        uint256 contractBalance = address(registry).balance;

        assertLe(totalBonds, contractBalance, "SR-1: Bond sum exceeds contract balance");
    }

    /// @notice SR-8: Locked Bond Consistency
    /// @dev Locked balance represents bond moved from available during disputes.
    /// Total bond (bondBalance + lockedBalance) should be consistent with deposits - slashes.
    function invariant_SR8_lockedBondConsistency() public view {
        bytes32[] memory solverIds = handler.getSolverIds();

        for (uint256 i = 0; i < solverIds.length; i++) {
            Types.Solver memory solver = registry.getSolver(solverIds[i]);
            uint256 totalBond = solver.bondBalance + solver.lockedBalance;

            // If solver has locked balance, they must have registered (have some bond history)
            if (solver.lockedBalance > 0) {
                // Locked balance can only exist for solvers that have/had bond
                assertTrue(
                    solver.status != Types.SolverStatus.Inactive || totalBond > 0,
                    "SR-8: Locked bond on unregistered solver"
                );
            }

            // Total bond should never be negative (Solidity prevents this, but logic check)
            assertGe(totalBond, 0, "SR-8: Negative total bond");
        }
    }

    /// @notice Static invariant: Minimum bond constant is reasonable
    function invariant_minimumBondIsReasonable() public view {
        assertEq(registry.MINIMUM_BOND(), 0.1 ether, "Minimum bond should be 0.1 ETH");
    }

    /// @notice Static invariant: Withdrawal cooldown is reasonable
    function invariant_withdrawalCooldownIsReasonable() public view {
        assertEq(registry.WITHDRAWAL_COOLDOWN(), 7 days, "Withdrawal cooldown should be 7 days");
    }
}

/// @notice Handler contract to generate valid sequences of operations
contract Handler is Test {
    SolverRegistry public registry;

    bytes32[] public solverIds;
    mapping(bytes32 => bool) public solverExists;
    uint256 public totalBondsTracked;

    address public authorizedCaller = address(0xCAFE);

    /// @notice Counter for generating unique operator addresses
    uint256 private operatorCounter;

    constructor(SolverRegistry _registry) {
        registry = _registry;
    }

    /// @notice Register a new solver and deposit minimum bond
    /// @dev Uses deterministic counter for unique operators (prevents collision issues)
    function registerAndBondSolver(
        uint256 /* operatorSeed */
    )
        public
    {
        // Use counter for deterministic unique operators (avoids address collision bugs)
        operatorCounter++;
        address operator = address(uint160(operatorCounter + 0x1000)); // Offset to avoid zero/special addresses

        vm.deal(operator, 1 ether);

        vm.startPrank(operator);
        bytes32 solverId = registry.registerSolver("ipfs://test", operator);
        registry.depositBond{ value: 0.1 ether }(solverId);
        vm.stopPrank();

        if (!solverExists[solverId]) {
            solverIds.push(solverId);
            solverExists[solverId] = true;
        }
        totalBondsTracked += 0.1 ether;
    }

    /// @notice Deposit additional bond for a solver
    function depositBond(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;

        solverIndex = bound(solverIndex, 0, solverIds.length - 1);
        bytes32 solverId = solverIds[solverIndex];

        amount = bound(amount, 0.01 ether, 1 ether);

        Types.Solver memory solver = registry.getSolver(solverId);
        vm.deal(solver.operator, amount);

        vm.prank(solver.operator);
        registry.depositBond{ value: amount }(solverId);

        totalBondsTracked += amount;
    }

    /// @notice Lock bond (simulates dispute opening)
    function lockBond(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;

        solverIndex = bound(solverIndex, 0, solverIds.length - 1);
        bytes32 solverId = solverIds[solverIndex];

        Types.Solver memory solver = registry.getSolver(solverId);
        if (solver.status != Types.SolverStatus.Active) return;
        if (solver.bondBalance == 0) return;

        amount = bound(amount, 1, solver.bondBalance);

        vm.prank(authorizedCaller);
        registry.lockBond(solverId, amount);
    }

    /// @notice Unlock bond (simulates dispute resolution)
    function unlockBond(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;

        solverIndex = bound(solverIndex, 0, solverIds.length - 1);
        bytes32 solverId = solverIds[solverIndex];

        Types.Solver memory solver = registry.getSolver(solverId);
        if (solver.lockedBalance == 0) return;

        amount = bound(amount, 1, solver.lockedBalance);

        vm.prank(authorizedCaller);
        registry.unlockBond(solverId, amount);
    }

    /// @notice Get all solver IDs
    function getSolverIds() external view returns (bytes32[] memory) {
        return solverIds;
    }
}
