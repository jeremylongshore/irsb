// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { AgenticCommerce } from "../src/AgenticCommerce.sol";
import { IRSBHook } from "../src/hooks/IRSBHook.sol";
import { ACPMethodEnforcer } from "../src/enforcers/ACPMethodEnforcer.sol";
import { IntentReceiptHub } from "../src/IntentReceiptHub.sol";
import { SolverRegistry } from "../src/SolverRegistry.sol";

/// @title Deploy ACP — EIP-8183 Agentic Commerce Protocol
/// @notice Deploys AgenticCommerce, IRSBHook, and ACPMethodEnforcer
contract DeployACP is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Existing IRSB contracts (must be set in .env or passed as args)
        address solverRegistry = vm.envAddress("SOLVER_REGISTRY");
        address receiptHub = vm.envAddress("RECEIPT_HUB");

        console.log("Deploying EIP-8183 Agentic Commerce Protocol...");
        console.log("Deployer:", deployer);
        console.log("SolverRegistry:", solverRegistry);
        console.log("IntentReceiptHub:", receiptHub);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy AgenticCommerce
        AgenticCommerce commerce = new AgenticCommerce();
        console.log("AgenticCommerce deployed at:", address(commerce));

        // 2. Deploy IRSBHook (10% bond lock)
        uint256 bondLockBps = 1000;
        IRSBHook irsbHook = new IRSBHook(solverRegistry, receiptHub, address(commerce), bondLockBps);
        console.log("IRSBHook deployed at:", address(irsbHook));

        // 3. Set hook on AgenticCommerce
        commerce.setHook(address(irsbHook));
        console.log("Hook set on AgenticCommerce");

        // 4. Register hook as trusted caller on IntentReceiptHub
        IntentReceiptHub(payable(receiptHub)).setTrustedHook(address(irsbHook), true);
        console.log("IRSBHook registered as trusted hook on IntentReceiptHub");

        // 5. Authorize hook on SolverRegistry (for lockBond/unlockBond)
        SolverRegistry(payable(solverRegistry)).setAuthorizedCaller(address(irsbHook), true);
        console.log("IRSBHook authorized on SolverRegistry");

        // 6. Deploy ACPMethodEnforcer
        ACPMethodEnforcer enforcer = new ACPMethodEnforcer();
        console.log("ACPMethodEnforcer deployed at:", address(enforcer));

        vm.stopBroadcast();

        console.log("");
        console.log("=== ACP Deployment Summary ===");
        console.log("AgenticCommerce:  ", address(commerce));
        console.log("IRSBHook:         ", address(irsbHook));
        console.log("ACPMethodEnforcer:", address(enforcer));
        console.log("Bond Lock BPS:    ", bondLockBps);
    }
}
