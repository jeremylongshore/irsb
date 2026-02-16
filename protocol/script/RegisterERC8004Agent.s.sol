// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";

/// @title Minimal IIdentityRegistry interface for ERC-8004 registration
interface IIdentityRegistry {
    struct MetadataEntry {
        string key;
        bytes value;
    }

    /// @notice Register a new agent, minting an agentId NFT to msg.sender
    function register(string calldata agentURI, MetadataEntry[] calldata metadata) external returns (uint256 agentId);

    /// @notice Update the URI for an existing agent (only owner)
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /// @notice Standard ERC-721 tokenURI
    function tokenURI(uint256 tokenId) external view returns (string memory);

    /// @notice Standard ERC-721 ownerOf
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title Register IRSB Solver on ERC-8004 IdentityRegistry (Sepolia)
/// @notice Registers the IRSB reference solver as an ERC-8004 agent with a data URI
contract RegisterERC8004Agent is Script {
    /// @dev ERC-8004 IdentityRegistry on Sepolia
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("");
        console.log("========================================");
        console.log("  ERC-8004 Agent Registration");
        console.log("========================================");
        console.log("");
        console.log("Registry:  ", IDENTITY_REGISTRY);
        console.log("Registrant:", deployer);
        console.log("Balance:   ", deployer.balance / 1e15, "finney");
        console.log("");

        // Build registration JSON
        string memory json = _buildRegistrationJson();
        console.log("Registration JSON length:", bytes(json).length);

        // Base64-encode into a data URI
        string memory dataURI = string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
        console.log("Data URI length:", bytes(dataURI).length);
        console.log("");

        // Register on-chain
        IIdentityRegistry registry = IIdentityRegistry(IDENTITY_REGISTRY);
        IIdentityRegistry.MetadataEntry[] memory metadata = new IIdentityRegistry.MetadataEntry[](0);

        vm.startBroadcast(deployerPrivateKey);
        uint256 agentId = registry.register(dataURI, metadata);
        vm.stopBroadcast();

        // Log results
        console.log("========================================");
        console.log("  REGISTRATION SUCCESSFUL!");
        console.log("========================================");
        console.log("");
        console.log("Agent ID (uint256):", agentId);
        console.log("Owner:             ", deployer);
        console.log("");
        console.log("Verify with:");
        console.log("  cast call", IDENTITY_REGISTRY);
        console.log('  "ownerOf(uint256)" ', agentId, " --rpc-url sepolia");
        console.log("");
        console.log("View on 8004scan: https://www.8004scan.io/");
        console.log("========================================");
    }

    /// @dev Builds the ERC-8004 registration JSON for the IRSB Solver
    function _buildRegistrationJson() internal pure returns (string memory) {
        // Using abi.encodePacked to concatenate JSON string parts
        // Avoids string memory limitations with long literals
        return string(
            abi.encodePacked(
                '{"type":"https://eips.ethereum.org/EIPS/eip-8004#registration-v1",',
                '"name":"IRSB Solver",',
                '"description":"IRSB Protocol reference solver. Executes intents, produces evidence bundles, ',
                'and submits on-chain receipts with cryptographic accountability.",',
                '"services":[{"name":"web","endpoint":"https://github.com/intent-solutions-io/irsb-solver"}],',
                '"x402Support":false,',
                '"active":true,',
                '"supportedTrust":["reputation","crypto-economic"]}'
            )
        );
    }
}

/// @title Update IRSB Solver URI on ERC-8004 IdentityRegistry (Sepolia)
/// @notice Updates the agent URI with the registrations field populated (agentId known)
contract UpdateERC8004AgentURI is Script {
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    uint256 constant AGENT_ID = 967;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IIdentityRegistry registry = IIdentityRegistry(IDENTITY_REGISTRY);

        // Verify ownership
        require(registry.ownerOf(AGENT_ID) == deployer, "Not agent owner");

        console.log("");
        console.log("========================================");
        console.log("  ERC-8004 Agent URI Update");
        console.log("========================================");
        console.log("");
        console.log("Agent ID:", AGENT_ID);
        console.log("Owner:  ", deployer);

        // Build updated JSON with registrations field
        string memory json = _buildUpdatedJson();
        string memory dataURI = string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));

        console.log("Updated URI length:", bytes(dataURI).length);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);
        registry.setAgentURI(AGENT_ID, dataURI);
        vm.stopBroadcast();

        console.log("URI updated successfully!");
        console.log("========================================");
    }

    function _buildUpdatedJson() internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '{"type":"https://eips.ethereum.org/EIPS/eip-8004#registration-v1",',
                '"name":"IRSB Solver",',
                '"description":"IRSB Protocol reference solver. Executes intents, produces evidence bundles, ',
                'and submits on-chain receipts with cryptographic accountability.",',
                '"services":[{"name":"web","endpoint":"https://github.com/intent-solutions-io/irsb-solver"}],',
                '"x402Support":false,',
                '"active":true,',
                '"registrations":[{"agentId":967,"agentRegistry":"eip155:11155111:0x8004A818BFB912233c491871b3d84c89A494BD9e"}],',
                '"supportedTrust":["reputation","crypto-economic"]}'
            )
        );
    }
}
