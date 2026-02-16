// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { DisputeModule } from "../src/DisputeModule.sol";
import { OptimisticDisputeModule } from "../src/modules/OptimisticDisputeModule.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { ReceiptV2Extension } from "../src/extensions/ReceiptV2Extension.sol";

/// @title DeployTimelock
/// @notice Deploys TimelockController and transfers ownership of all IRSB contracts
/// @dev Requires env vars: SAFE_ADDRESS, SOLVER_REGISTRY, INTENT_RECEIPT_HUB, DISPUTE_MODULE,
///      OPTIMISTIC_DISPUTE_MODULE, ESCROW_VAULT, RECEIPT_V2_EXTENSION, PRIVATE_KEY
contract DeployTimelock is Script {
    // Timelock parameters
    uint256 constant MIN_DELAY = 48 hours; // 172800 seconds

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address safeAddress = vm.envAddress("SAFE_ADDRESS");

        // Load existing contract addresses
        address solverRegistry = vm.envAddress("SOLVER_REGISTRY");
        address intentReceiptHub = vm.envAddress("INTENT_RECEIPT_HUB");
        address disputeModule = vm.envAddress("DISPUTE_MODULE");
        address optimisticDisputeModule = vm.envAddress("OPTIMISTIC_DISPUTE_MODULE");
        address escrowVault = vm.envAddress("ESCROW_VAULT");
        address receiptV2Extension = vm.envAddress("RECEIPT_V2_EXTENSION");

        console.log("");
        console.log("========================================");
        console.log("  IRSB TimelockController Deployment");
        console.log("========================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Safe Address:", safeAddress);
        console.log("Min Delay:", MIN_DELAY, "seconds (48 hours)");
        console.log("");
        console.log("Existing Contracts:");
        console.log("  SolverRegistry:           ", solverRegistry);
        console.log("  IntentReceiptHub:         ", intentReceiptHub);
        console.log("  DisputeModule:            ", disputeModule);
        console.log("  OptimisticDisputeModule:  ", optimisticDisputeModule);
        console.log("  EscrowVault:              ", escrowVault);
        console.log("  ReceiptV2Extension:       ", receiptV2Extension);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy TimelockController
        console.log("[1/7] Deploying TimelockController...");
        address[] memory proposers = new address[](1);
        proposers[0] = safeAddress;

        address[] memory executors = new address[](1);
        executors[0] = safeAddress;

        TimelockController timelock = new TimelockController(
            MIN_DELAY,
            proposers,    // Safe can propose
            executors,    // Safe can execute
            address(0)    // No admin (timelock self-administers)
        );
        console.log("      TimelockController deployed at:", address(timelock));
        console.log("");

        // Step 2-7: Transfer ownership of all contracts to TimelockController
        console.log("[2/7] Transferring SolverRegistry ownership...");
        Ownable(solverRegistry).transferOwnership(address(timelock));
        console.log("      Owner:", Ownable(solverRegistry).owner());

        console.log("[3/7] Transferring IntentReceiptHub ownership...");
        Ownable(intentReceiptHub).transferOwnership(address(timelock));
        console.log("      Owner:", Ownable(intentReceiptHub).owner());

        console.log("[4/7] Transferring DisputeModule ownership...");
        Ownable(disputeModule).transferOwnership(address(timelock));
        console.log("      Owner:", Ownable(disputeModule).owner());

        console.log("[5/7] Transferring OptimisticDisputeModule ownership...");
        Ownable(optimisticDisputeModule).transferOwnership(address(timelock));
        console.log("      Owner:", Ownable(optimisticDisputeModule).owner());

        console.log("[6/7] Transferring EscrowVault ownership...");
        Ownable(escrowVault).transferOwnership(address(timelock));
        console.log("      Owner:", Ownable(escrowVault).owner());

        console.log("[7/7] Transferring ReceiptV2Extension ownership...");
        Ownable(receiptV2Extension).transferOwnership(address(timelock));
        console.log("      Owner:", Ownable(receiptV2Extension).owner());

        vm.stopBroadcast();

        // Print final summary
        console.log("");
        console.log("========================================");
        console.log("  TIMELOCK DEPLOYMENT SUCCESSFUL!");
        console.log("========================================");
        console.log("");
        console.log("TimelockController:       ", address(timelock));
        console.log("Min Delay:                 48 hours");
        console.log("Proposer/Executor:         Safe", safeAddress);
        console.log("");
        console.log("All contracts now owned by TimelockController.");
        console.log("Admin operations require:");
        console.log("  1. Safe proposes tx via timelock.schedule()");
        console.log("  2. Wait 48 hours");
        console.log("  3. Safe executes via timelock.execute()");
        console.log("");
        console.log("========================================");
    }
}
