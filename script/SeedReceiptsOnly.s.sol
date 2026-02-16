// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SolverRegistry.sol";
import "../src/IntentReceiptHub.sol";
import "../src/libraries/Types.sol";

contract SeedReceiptsOnly is Script {
    // Sepolia deployed contracts
    SolverRegistry constant registry = SolverRegistry(payable(0xB6ab964832808E49635fF82D1996D6a888ecB745));
    IntentReceiptHub constant hub = IntentReceiptHub(payable(0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c));

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Seeding receipts on Sepolia...");
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        // Get existing solver ID
        bytes32 solverId = registry.getSolverByOperator(deployer);
        require(solverId != bytes32(0), "Solver not registered");
        console.log("Using existing Solver ID:", vm.toString(solverId));

        // Check solver status
        Types.Solver memory solver = registry.getSolver(solverId);
        console.log("Bond balance:", solver.bondBalance);
        console.log("Status:", uint256(solver.status));

        vm.startBroadcast(deployerPrivateKey);

        // Deposit bond if needed
        if (solver.bondBalance < 0.1 ether) {
            uint256 needed = 0.1 ether - solver.bondBalance + 0.01 ether; // Extra buffer
            if (deployer.balance > needed + 0.01 ether) {
                console.log("Depositing additional bond:", needed);
                registry.depositBond{ value: needed }(solverId);
            }
        }

        // Post 3 test receipts
        for (uint256 i = 0; i < 3; i++) {
            bytes32 intentHash = keccak256(abi.encodePacked("seed-intent-", i, block.timestamp));
            bytes32 constraintsHash = keccak256(abi.encodePacked("seed-constraints-", i));
            bytes32 routeHash = keccak256(abi.encodePacked("seed-route-", i));
            bytes32 outcomeHash = keccak256(abi.encodePacked("seed-outcome-", i));
            bytes32 evidenceHash = keccak256(abi.encodePacked("seed-evidence-", i));

            uint64 createdAt = uint64(block.timestamp);
            uint64 expiry = uint64(block.timestamp + 1 hours);

            bytes32 messageHash = keccak256(
                abi.encode(
                    intentHash, constraintsHash, routeHash, outcomeHash, evidenceHash, createdAt, expiry, solverId
                )
            );

            // Sign the eth-prefixed hash
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

        vm.stopBroadcast();

        console.log("");
        console.log("=== Test Data Seeded ===");
        console.log("Solver ID:", vm.toString(solverId));
        console.log("Check dashboard: https://irsb-protocol.web.app");
    }
}
