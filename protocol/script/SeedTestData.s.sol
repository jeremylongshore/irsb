// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SolverRegistry.sol";
import "../src/IntentReceiptHub.sol";
import "../src/libraries/Types.sol";

contract SeedTestData is Script {
    // Sepolia deployed contracts
    SolverRegistry constant registry = SolverRegistry(payable(0xB6ab964832808E49635fF82D1996D6a888ecB745));
    IntentReceiptHub constant hub = IntentReceiptHub(payable(0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c));

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Seeding test data on Sepolia...");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Register as a solver
        string memory metadataURI = "ipfs://QmTestSolverMetadata";
        bytes32 solverId;

        // Check if already registered
        bytes32 existingSolverId = registry.getSolverByOperator(deployer);
        if (existingSolverId == bytes32(0)) {
            console.log("Registering solver...");
            solverId = registry.registerSolver(metadataURI, deployer);
            console.log("Solver registered with ID:", vm.toString(solverId));
        } else {
            solverId = existingSolverId;
            console.log("Solver already registered:", vm.toString(solverId));
        }

        // 2. Deposit bond (use most of available balance, keep 0.01 for gas)
        uint256 bondAmount = deployer.balance > 0.015 ether ? deployer.balance - 0.01 ether : 0;
        if (bondAmount >= 0.01 ether) {
            console.log("Depositing bond:", bondAmount);
            registry.depositBond{ value: bondAmount }(solverId);
            console.log("Bond deposited");
        } else {
            console.log("Insufficient balance for bond deposit");
        }

        // 3. Post some test receipts
        for (uint256 i = 0; i < 3; i++) {
            bytes32 intentHash = keccak256(abi.encodePacked("test-intent-", i, block.timestamp));
            bytes32 constraintsHash = keccak256(abi.encodePacked("constraints-", i));
            bytes32 routeHash = keccak256(abi.encodePacked("route-", i));
            bytes32 outcomeHash = keccak256(abi.encodePacked("outcome-", i));
            bytes32 evidenceHash = keccak256(abi.encodePacked("evidence-", i));

            // Create signature - must match IntentReceiptHub verification exactly
            uint64 createdAt = uint64(block.timestamp);
            uint64 expiry = uint64(block.timestamp + 1 hours);

            bytes32 messageHash = keccak256(
                abi.encode(
                    intentHash, constraintsHash, routeHash, outcomeHash, evidenceHash, createdAt, expiry, solverId
                )
            );
            // Sign the eth-prefixed hash (matches toEthSignedMessageHash in contract)
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(deployerPrivateKey, ethSignedHash);
            bytes memory signature = abi.encodePacked(r, s, v);

            Types.IntentReceipt memory receipt = Types.IntentReceipt({
                intentHash: intentHash,
                constraintsHash: constraintsHash,
                routeHash: routeHash,
                outcomeHash: outcomeHash,
                evidenceHash: evidenceHash,
                createdAt: createdAt,
                expiry: expiry,
                solverId: solverId,
                solverSig: signature
            });

            console.log("Posting receipt", i + 1);
            hub.postReceipt(receipt, 0);
        }

        console.log("Posted 3 test receipts");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Test Data Seeded ===");
        console.log("Solver ID:", vm.toString(solverId));
        console.log("Check dashboard: https://irsb-protocol.web.app");
        console.log("Check subgraph: https://thegraph.com/studio/subgraph/isrb");
    }
}
