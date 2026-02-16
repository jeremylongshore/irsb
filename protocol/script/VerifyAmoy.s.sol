// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";

/// @title Polygon Amoy Contract Verification Script
/// @notice Verifies deployed contracts on Polygonscan
/// @dev Run after deployment with: forge script script/VerifyAmoy.s.sol --rpc-url $AMOY_RPC_URL
contract VerifyAmoy is Script {
    // These addresses should be updated after deployment
    // Or passed via environment variables
    address constant SOLVER_REGISTRY = address(0); // Update after deploy
    address constant INTENT_RECEIPT_HUB = address(0); // Update after deploy
    address constant DISPUTE_MODULE = address(0); // Update after deploy

    function run() external view {
        // Load addresses from environment if available
        address solverRegistry = vm.envOr("SOLVER_REGISTRY", SOLVER_REGISTRY);
        address receiptHub = vm.envOr("INTENT_RECEIPT_HUB", INTENT_RECEIPT_HUB);
        address disputeModule = vm.envOr("DISPUTE_MODULE", DISPUTE_MODULE);

        console.log("");
        console.log("========================================");
        console.log("  Contract Verification Commands");
        console.log("========================================");
        console.log("");
        console.log("Run these commands to verify contracts on Polygonscan:");
        console.log("");

        if (solverRegistry != address(0)) {
            console.log("# SolverRegistry");
            console.log("forge verify-contract \\");
            console.log("  %s \\", solverRegistry);
            console.log("  src/SolverRegistry.sol:SolverRegistry \\");
            console.log("  --chain amoy \\");
            console.log("  --etherscan-api-key $POLYGONSCAN_API_KEY");
            console.log("");
        }

        if (receiptHub != address(0)) {
            console.log("# IntentReceiptHub");
            console.log("forge verify-contract \\");
            console.log("  %s \\", receiptHub);
            console.log("  src/IntentReceiptHub.sol:IntentReceiptHub \\");
            console.log("  --chain amoy \\");
            console.log("  --constructor-args $(cast abi-encode 'constructor(address)' %s) \\", solverRegistry);
            console.log("  --etherscan-api-key $POLYGONSCAN_API_KEY");
            console.log("");
        }

        if (disputeModule != address(0)) {
            console.log("# DisputeModule");
            console.log(
                "# Note: Replace <DEPLOYER_ADDRESS> with the address that deployed the contracts (initial arbitrator)"
            );
            console.log("forge verify-contract \\");
            console.log("  %s \\", disputeModule);
            console.log("  src/DisputeModule.sol:DisputeModule \\");
            console.log("  --chain amoy \\");
            console.log(
                "  --constructor-args $(cast abi-encode 'constructor(address,address,address)' %s %s <DEPLOYER_ADDRESS>) \\",
                receiptHub,
                solverRegistry
            );
            console.log("  --etherscan-api-key $POLYGONSCAN_API_KEY");
            console.log("");
        }

        console.log("========================================");
        console.log("");
        console.log("Or verify all at once with --verify flag during deployment:");
        console.log("  forge script script/DeployAmoy.s.sol:DeployAmoy \\");
        console.log("    --rpc-url $AMOY_RPC_URL \\");
        console.log("    --broadcast \\");
        console.log("    --verify \\");
        console.log("    --etherscan-api-key $POLYGONSCAN_API_KEY");
        console.log("");
    }
}
