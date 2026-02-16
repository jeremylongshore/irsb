// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {SolverRegistry} from "../src/SolverRegistry.sol";
import {IntentReceiptHub} from "../src/IntentReceiptHub.sol";

contract TimelockIntegrationTest is Test {
    TimelockController public timelock;
    SolverRegistry public registry;
    IntentReceiptHub public hub;

    uint256 public constant MIN_DELAY = 48 hours;

    function setUp() public {
        // Deploy contracts
        registry = new SolverRegistry();
        hub = new IntentReceiptHub(address(registry));

        // Deploy TimelockController
        address[] memory proposers = new address[](1);
        proposers[0] = address(this);

        address[] memory executors = new address[](1);
        executors[0] = address(this);

        timelock = new TimelockController(MIN_DELAY, proposers, executors, address(0));

        // Transfer ownership to timelock
        registry.transferOwnership(address(timelock));
        hub.transferOwnership(address(timelock));
    }

    function test_DirectAdminCallReverts() public {
        // Direct admin call should revert since owner is now timelock
        vm.expectRevert(
            abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", address(this))
        );
        registry.setAuthorizedCaller(address(0x123), true);
    }

    function test_TimelockExecutesAfterDelay() public {
        address caller = address(0x123);

        // Prepare operation
        address target = address(registry);
        uint256 value = 0;
        bytes memory data =
            abi.encodeWithSelector(SolverRegistry.setAuthorizedCaller.selector, caller, true);
        bytes32 predecessor = bytes32(0);
        bytes32 salt = bytes32(0);

        // Schedule operation
        timelock.schedule(target, value, data, predecessor, salt, MIN_DELAY);

        // Warp past delay
        vm.warp(block.timestamp + MIN_DELAY);

        // Execute operation
        timelock.execute(target, value, data, predecessor, salt);

        // Assert caller is now authorized
        assertTrue(registry.authorizedCallers(caller));
    }

    function test_TimelockRevertsBeforeDelay() public {
        address caller = address(0x123);

        // Prepare operation
        address target = address(registry);
        uint256 value = 0;
        bytes memory data =
            abi.encodeWithSelector(SolverRegistry.setAuthorizedCaller.selector, caller, true);
        bytes32 predecessor = bytes32(0);
        bytes32 salt = bytes32(0);

        // Schedule operation
        timelock.schedule(target, value, data, predecessor, salt, MIN_DELAY);

        // Try to execute immediately without warping - should revert
        bytes32 operationId = timelock.hashOperation(target, value, data, predecessor, salt);
        vm.expectRevert(
            abi.encodeWithSignature(
                "TimelockUnexpectedOperationState(bytes32,bytes32)",
                operationId,
                bytes32(uint256(1 << 2)) // Ready state bitmask expected by execute()
            )
        );
        timelock.execute(target, value, data, predecessor, salt);
    }

    function test_HubAdminViaTimelock() public {
        uint256 newChallengeWindow = 30 minutes;

        // Prepare operation
        address target = address(hub);
        uint256 value = 0;
        bytes memory data =
            abi.encodeWithSelector(IntentReceiptHub.setChallengeWindow.selector, newChallengeWindow);
        bytes32 predecessor = bytes32(0);
        bytes32 salt = bytes32(0);

        // Schedule operation
        timelock.schedule(target, value, data, predecessor, salt, MIN_DELAY);

        // Warp past delay
        vm.warp(block.timestamp + MIN_DELAY);

        // Execute operation
        timelock.execute(target, value, data, predecessor, salt);

        // Assert challenge window was updated
        assertEq(hub.getChallengeWindow(), newChallengeWindow);
    }
}
