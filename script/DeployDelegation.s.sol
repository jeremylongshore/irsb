// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { WalletDelegate } from "../src/delegation/WalletDelegate.sol";
import { X402Facilitator } from "../src/X402Facilitator.sol";
import { SpendLimitEnforcer } from "../src/enforcers/SpendLimitEnforcer.sol";
import { TimeWindowEnforcer } from "../src/enforcers/TimeWindowEnforcer.sol";
import { AllowedTargetsEnforcer } from "../src/enforcers/AllowedTargetsEnforcer.sol";
import { AllowedMethodsEnforcer } from "../src/enforcers/AllowedMethodsEnforcer.sol";
import { NonceEnforcer } from "../src/enforcers/NonceEnforcer.sol";

/// @title IRSB Delegation Deployment Script
/// @notice Deploys WalletDelegate, caveat enforcers, and X402Facilitator
contract DeployDelegation is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Existing contract addresses
        address receiptHub = vm.envAddress("INTENT_RECEIPT_HUB");
        require(receiptHub != address(0), "INTENT_RECEIPT_HUB must not be zero address");

        console.log("=== IRSB Delegation Deployment ===");
        console.log("Deployer:", deployer);
        console.log("IntentReceiptHub:", receiptHub);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Caveat Enforcers
        SpendLimitEnforcer spendLimit = new SpendLimitEnforcer();
        console.log("SpendLimitEnforcer:", address(spendLimit));

        TimeWindowEnforcer timeWindow = new TimeWindowEnforcer();
        console.log("TimeWindowEnforcer:", address(timeWindow));

        AllowedTargetsEnforcer allowedTargets = new AllowedTargetsEnforcer();
        console.log("AllowedTargetsEnforcer:", address(allowedTargets));

        AllowedMethodsEnforcer allowedMethods = new AllowedMethodsEnforcer();
        console.log("AllowedMethodsEnforcer:", address(allowedMethods));

        NonceEnforcer nonceEnforcer = new NonceEnforcer();
        console.log("NonceEnforcer:", address(nonceEnforcer));

        // 2. Deploy WalletDelegate
        WalletDelegate walletDelegate = new WalletDelegate();
        console.log("WalletDelegate:", address(walletDelegate));

        // 3. Deploy X402Facilitator
        X402Facilitator facilitator = new X402Facilitator(address(walletDelegate), receiptHub);
        console.log("X402Facilitator:", address(facilitator));

        console.log("=== Deployment Complete ===");
        console.log("Total contracts deployed: 7");

        vm.stopBroadcast();
    }
}
