// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TypesV2 } from "./TypesV2.sol";

/// @title EIP-712 Receipt V2 Library
/// @notice EIP-712 typed data hashing for V2 receipts
/// @dev Provides domain separator and signing utilities
library EIP712ReceiptV2 {
    // ============ Constants ============

    /// @notice EIP-712 domain type hash
    bytes32 constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice Protocol name for EIP-712 domain
    string constant DOMAIN_NAME = "IRSB Protocol";

    /// @notice Protocol version for EIP-712 domain
    string constant DOMAIN_VERSION = "2";

    // ============ Functions ============

    /// @notice Compute the EIP-712 domain separator
    /// @param verifyingContract The contract address to include in domain
    /// @return domainSeparator The computed domain separator
    function computeDomainSeparator(address verifyingContract) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                verifyingContract
            )
        );
    }

    /// @notice Compute the EIP-712 typed data hash for signing
    /// @param domainSeparator The domain separator
    /// @param structHash The struct hash of the receipt
    /// @return digest The final digest to sign
    function computeTypedDataHash(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /// @notice Compute the full signing digest for a V2 receipt
    /// @param receipt The V2 receipt
    /// @param verifyingContract The contract address
    /// @return digest The digest to sign
    function computeReceiptDigest(TypesV2.IntentReceiptV2 memory receipt, address verifyingContract)
        internal
        view
        returns (bytes32)
    {
        bytes32 domainSeparator = computeDomainSeparator(verifyingContract);
        bytes32 structHash = TypesV2.hashReceiptV2(receipt);
        return computeTypedDataHash(domainSeparator, structHash);
    }
}
