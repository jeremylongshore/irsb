// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { DisputeModule } from "../src/DisputeModule.sol";

/// @title IRSB Deployment Script
/// @notice Deploys the complete IRSB protocol stack
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying IRSB Protocol...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy SolverRegistry
        SolverRegistry solverRegistry = new SolverRegistry();
        console.log("SolverRegistry deployed at:", address(solverRegistry));

        // 2. Deploy IntentReceiptHub
        IntentReceiptHub receiptHub = new IntentReceiptHub(address(solverRegistry));
        console.log("IntentReceiptHub deployed at:", address(receiptHub));

        // 3. Deploy DisputeModule
        DisputeModule disputeModule = new DisputeModule(
            address(receiptHub),
            address(solverRegistry),
            deployer // Initial arbitrator is deployer
        );
        console.log("DisputeModule deployed at:", address(disputeModule));

        // 4. Configure cross-references
        solverRegistry.setAuthorizedCaller(address(receiptHub), true);
        solverRegistry.setAuthorizedCaller(address(disputeModule), true);
        receiptHub.setDisputeModule(address(disputeModule));

        console.log("Configuration complete!");
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("SolverRegistry:   ", address(solverRegistry));
        console.log("IntentReceiptHub: ", address(receiptHub));
        console.log("DisputeModule:    ", address(disputeModule));

        vm.stopBroadcast();
    }
}

/// @title Local Deployment Script
/// @notice For Anvil/local testing with funded accounts
contract DeployLocal is Script {
    function run() external {
        // Use Anvil's first default account
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        vm.startBroadcast(deployerPrivateKey);

        // Deploy all contracts
        SolverRegistry solverRegistry = new SolverRegistry();
        IntentReceiptHub receiptHub = new IntentReceiptHub(address(solverRegistry));
        DisputeModule disputeModule =
            new DisputeModule(address(receiptHub), address(solverRegistry), vm.addr(deployerPrivateKey));

        // Configure
        solverRegistry.setAuthorizedCaller(address(receiptHub), true);
        solverRegistry.setAuthorizedCaller(address(disputeModule), true);
        receiptHub.setDisputeModule(address(disputeModule));

        console.log("=== Local Deployment ===");
        console.log("SolverRegistry:   ", address(solverRegistry));
        console.log("IntentReceiptHub: ", address(receiptHub));
        console.log("DisputeModule:    ", address(disputeModule));

        vm.stopBroadcast();
    }
}

/// @title Sepolia Testnet Deployment Script
/// @notice Deploys IRSB protocol to Sepolia with verification support
contract DeploySepolia is Script {
    // Sepolia chain ID
    uint256 constant SEPOLIA_CHAIN_ID = 11155111;

    function run() external {
        // Verify we're on Sepolia
        require(block.chainid == SEPOLIA_CHAIN_ID, "Not on Sepolia!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log("========================================");
        console.log("  IRSB Protocol - Sepolia Deployment");
        console.log("========================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Balance: ", deployer.balance / 1e18, "ETH");
        console.log("");

        require(deployer.balance >= 0.1 ether, "Insufficient ETH for deployment");

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
        console.log("To verify on Etherscan, run:");
        console.log("  forge verify-contract <ADDRESS> <CONTRACT> --chain sepolia");
        console.log("");
        console.log("========================================");
    }
}

/// @title Sepolia Deployment with Auto-Verification
/// @notice Deploys and verifies in one command (requires ETHERSCAN_API_KEY)
contract DeploySepoliaVerified is Script {
    uint256 constant SEPOLIA_CHAIN_ID = 11155111;

    struct DeploymentAddresses {
        address solverRegistry;
        address receiptHub;
        address disputeModule;
    }

    function run() external returns (DeploymentAddresses memory) {
        require(block.chainid == SEPOLIA_CHAIN_ID, "Not on Sepolia!");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying IRSB Protocol to Sepolia (with verification)...");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy
        SolverRegistry solverRegistry = new SolverRegistry();
        IntentReceiptHub receiptHub = new IntentReceiptHub(address(solverRegistry));
        DisputeModule disputeModule = new DisputeModule(address(receiptHub), address(solverRegistry), deployer);

        // Configure
        solverRegistry.setAuthorizedCaller(address(receiptHub), true);
        solverRegistry.setAuthorizedCaller(address(disputeModule), true);
        receiptHub.setDisputeModule(address(disputeModule));

        vm.stopBroadcast();

        console.log("SolverRegistry:   ", address(solverRegistry));
        console.log("IntentReceiptHub: ", address(receiptHub));
        console.log("DisputeModule:    ", address(disputeModule));

        return DeploymentAddresses({
            solverRegistry: address(solverRegistry),
            receiptHub: address(receiptHub),
            disputeModule: address(disputeModule)
        });
    }
}
