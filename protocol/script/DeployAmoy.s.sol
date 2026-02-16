// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { DisputeModule } from "../src/DisputeModule.sol";

/// @title Polygon Amoy Deployment Script
/// @notice Deploys IRSB protocol to Polygon Amoy testnet
/// @dev ERC8004Adapter can be deployed separately after Phase 5 is merged
contract DeployAmoy is Script {
    // Polygon Amoy chain ID
    uint256 constant AMOY_CHAIN_ID = 80002;

    struct DeploymentAddresses {
        address solverRegistry;
        address receiptHub;
        address disputeModule;
    }

    function run() external returns (DeploymentAddresses memory) {
        // Verify we're on Amoy
        require(block.chainid == AMOY_CHAIN_ID, "Not on Polygon Amoy!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log("========================================");
        console.log("  IRSB Protocol - Polygon Amoy Deployment");
        console.log("========================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Network:  Polygon Amoy");
        console.log("Deployer:", deployer);
        console.log("Balance: ", deployer.balance / 1e18, "POL");
        console.log("");

        // POL is cheaper than ETH, so lower threshold
        require(deployer.balance >= 0.5 ether, "Insufficient POL for deployment (need 0.5 POL)");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SolverRegistry
        console.log("[1/5] Deploying SolverRegistry...");
        SolverRegistry solverRegistry = new SolverRegistry();
        console.log("      Address:", address(solverRegistry));

        // 2. Deploy IntentReceiptHub
        console.log("[2/5] Deploying IntentReceiptHub...");
        IntentReceiptHub receiptHub = new IntentReceiptHub(address(solverRegistry));
        console.log("      Address:", address(receiptHub));

        // 3. Deploy DisputeModule
        console.log("[3/5] Deploying DisputeModule...");
        DisputeModule disputeModule = new DisputeModule(
            address(receiptHub),
            address(solverRegistry),
            deployer // Deployer is initial arbitrator
        );
        console.log("      Address:", address(disputeModule));

        // 4. Configure cross-references
        console.log("[4/5] Configuring authorizations...");
        solverRegistry.setAuthorizedCaller(address(receiptHub), true);
        solverRegistry.setAuthorizedCaller(address(disputeModule), true);
        receiptHub.setDisputeModule(address(disputeModule));
        console.log("      IntentReceiptHub authorized on SolverRegistry");
        console.log("      DisputeModule authorized on SolverRegistry");
        console.log("      DisputeModule set on IntentReceiptHub");

        // 5. Verify configuration
        console.log("[5/5] Verifying configuration...");
        require(solverRegistry.authorizedCallers(address(receiptHub)), "Hub not authorized");
        require(solverRegistry.authorizedCallers(address(disputeModule)), "Module not authorized");
        require(receiptHub.disputeModule() == address(disputeModule), "Module not set");
        console.log("      All checks passed!");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("");
        console.log("========================================");
        console.log("  DEPLOYMENT SUCCESSFUL!");
        console.log("========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  SolverRegistry:   ", address(solverRegistry));
        console.log("  IntentReceiptHub: ", address(receiptHub));
        console.log("  DisputeModule:    ", address(disputeModule));
        console.log("");
        console.log("Explorer: https://amoy.polygonscan.com");
        console.log("");
        console.log("To verify on Polygonscan, run:");
        console.log("  forge verify-contract <ADDRESS> <CONTRACT> --chain amoy");
        console.log("");
        console.log("NOTE: Deploy ERC8004Adapter separately after Phase 5 merge");
        console.log("");
        console.log("========================================");

        return DeploymentAddresses({
            solverRegistry: address(solverRegistry),
            receiptHub: address(receiptHub),
            disputeModule: address(disputeModule)
        });
    }
}

/// @title Polygon Amoy Deployment with Verification
/// @notice Deploys and verifies in one command (requires POLYGONSCAN_API_KEY)
contract DeployAmoyVerified is Script {
    uint256 constant AMOY_CHAIN_ID = 80002;

    function run() external {
        require(block.chainid == AMOY_CHAIN_ID, "Not on Polygon Amoy!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying IRSB Protocol to Polygon Amoy (with verification)...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy all contracts
        SolverRegistry solverRegistry = new SolverRegistry();
        IntentReceiptHub receiptHub = new IntentReceiptHub(address(solverRegistry));
        DisputeModule disputeModule = new DisputeModule(address(receiptHub), address(solverRegistry), deployer);

        // Configure
        solverRegistry.setAuthorizedCaller(address(receiptHub), true);
        solverRegistry.setAuthorizedCaller(address(disputeModule), true);
        receiptHub.setDisputeModule(address(disputeModule));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Polygon Amoy Deployment ===");
        console.log("SolverRegistry:   ", address(solverRegistry));
        console.log("IntentReceiptHub: ", address(receiptHub));
        console.log("DisputeModule:    ", address(disputeModule));
        console.log("");
        console.log("Run verification:");
        console.log("  forge script script/VerifyAmoy.s.sol --rpc-url $AMOY_RPC_URL");
    }
}
