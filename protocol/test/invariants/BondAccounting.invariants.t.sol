// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { SolverRegistry } from "../../src/SolverRegistry.sol";
import { Types } from "../../src/libraries/Types.sol";

/// @title BondAccountingInvariants
/// @notice Invariant: totalBonded == sum of all solver (bondBalance + lockedBalance)
/// @dev Run with: FOUNDRY_PROFILE=ci forge test --match-contract BondAccountingInvariants
contract BondAccountingInvariants is Test {
    SolverRegistry public registry;
    BondHandler public handler;

    function setUp() public {
        registry = new SolverRegistry();
        handler = new BondHandler(registry);
        registry.setAuthorizedCaller(address(handler), true);
        targetContract(address(handler));
    }

    /// @notice totalBonded must always equal sum of all solver bond + locked balances
    function invariant_totalBondedConsistency() public view {
        bytes32[] memory ids = handler.getSolverIds();
        uint256 sumBonds = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            Types.Solver memory solver = registry.getSolver(ids[i]);
            sumBonds += solver.bondBalance + solver.lockedBalance;
        }

        assertEq(registry.totalBonded(), sumBonds, "totalBonded != sum of solver bonds");
    }

    /// @notice totalBonded must never exceed contract ETH balance
    function invariant_totalBondedNeverExceedsBalance() public view {
        assertLe(registry.totalBonded(), address(registry).balance, "totalBonded > contract balance");
    }

    /// @notice totalSolvers must match number of registered solvers
    function invariant_totalSolversConsistent() public view {
        assertEq(registry.totalSolvers(), handler.registeredCount(), "totalSolvers mismatch");
    }
}

/// @notice Handler for bond accounting invariant testing
contract BondHandler is Test {
    SolverRegistry public registry;

    bytes32[] public solverIds;
    mapping(bytes32 => bool) public tracked;
    mapping(bytes32 => address) public solverOperators;

    uint256 private counter;
    uint256 public registeredCount;

    constructor(SolverRegistry _registry) {
        registry = _registry;
    }

    function registerSolver() public {
        counter++;
        address op = address(uint160(counter + 0x2000));
        vm.deal(op, 10 ether);

        vm.prank(op);
        bytes32 solverId = registry.registerSolver("ipfs://test", op);

        if (!tracked[solverId]) {
            solverIds.push(solverId);
            tracked[solverId] = true;
            solverOperators[solverId] = op;
        }
        registeredCount++;
    }

    function depositBond(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;
        solverIndex = bound(solverIndex, 0, solverIds.length - 1);
        amount = bound(amount, 0.01 ether, 2 ether);

        bytes32 solverId = solverIds[solverIndex];
        address op = solverOperators[solverId];
        vm.deal(op, amount);

        vm.prank(op);
        registry.depositBond{ value: amount }(solverId);
    }

    function lockBond(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;
        solverIndex = bound(solverIndex, 0, solverIds.length - 1);

        bytes32 solverId = solverIds[solverIndex];
        Types.Solver memory solver = registry.getSolver(solverId);
        if (solver.bondBalance == 0) return;

        amount = bound(amount, 1, solver.bondBalance);
        registry.lockBond(solverId, amount);
    }

    function unlockBond(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;
        solverIndex = bound(solverIndex, 0, solverIds.length - 1);

        bytes32 solverId = solverIds[solverIndex];
        Types.Solver memory solver = registry.getSolver(solverId);
        if (solver.lockedBalance == 0) return;

        amount = bound(amount, 1, solver.lockedBalance);
        registry.unlockBond(solverId, amount);
    }

    function slash(uint256 solverIndex, uint256 amount) public {
        if (solverIds.length == 0) return;
        solverIndex = bound(solverIndex, 0, solverIds.length - 1);

        bytes32 solverId = solverIds[solverIndex];
        Types.Solver memory solver = registry.getSolver(solverId);
        uint256 totalBond = solver.bondBalance + solver.lockedBalance;
        if (totalBond == 0) return;

        amount = bound(amount, 1, totalBond);
        address recipient = address(uint160(counter + 0xDEAD));
        registry.slash(solverId, amount, bytes32(counter), Types.DisputeReason.Timeout, recipient);
    }

    function getSolverIds() external view returns (bytes32[] memory) {
        return solverIds;
    }
}
