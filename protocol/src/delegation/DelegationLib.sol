// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { TypesDelegation } from "../libraries/TypesDelegation.sol";

/// @title DelegationLib
/// @notice EIP-712 hashing, signature verification, and encoding helpers for delegations
library DelegationLib {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice EIP-712 domain separator components
    bytes32 internal constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant NAME_HASH = keccak256("IRSB WalletDelegate");
    bytes32 internal constant VERSION_HASH = keccak256("1");

    /// @notice Compute the EIP-712 domain separator for a given contract
    /// @param contractAddress The verifying contract address
    /// @return domainSeparator The computed domain separator
    function computeDomainSeparator(address contractAddress) internal view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, contractAddress));
    }

    /// @notice Compute the EIP-712 digest for a delegation
    /// @param delegation The delegation to compute the digest for
    /// @param domainSeparator The EIP-712 domain separator
    /// @return digest The EIP-712 typed data hash
    function computeDigest(TypesDelegation.Delegation memory delegation, bytes32 domainSeparator)
        internal
        pure
        returns (bytes32)
    {
        bytes32 structHash = TypesDelegation.hashDelegation(delegation);
        return MessageHashUtils.toTypedDataHash(domainSeparator, structHash);
    }

    /// @notice Verify the EIP-712 signature on a delegation
    /// @param delegation The delegation with signature
    /// @param domainSeparator The EIP-712 domain separator
    /// @return signer The recovered signer address
    function verifySigner(TypesDelegation.Delegation memory delegation, bytes32 domainSeparator)
        internal
        pure
        returns (address)
    {
        bytes32 digest = computeDigest(delegation, domainSeparator);
        return ECDSA.recover(digest, delegation.signature);
    }

    /// @notice Encode a Delegation struct for storage (without dynamic fields)
    /// @param delegation The delegation to encode
    /// @return stored The stored delegation state
    function toStored(TypesDelegation.Delegation memory delegation)
        internal
        view
        returns (TypesDelegation.StoredDelegation memory stored)
    {
        stored.delegator = delegation.delegator;
        stored.active = true;
        stored.createdAt = uint64(block.timestamp);
        stored.revokedAt = 0;
        stored.caveatsHash = TypesDelegation.hashCaveatArray(delegation.caveats);
    }

    /// @notice Verify that an address has EIP-7702 delegate code pointing to expected contract
    /// @dev Uses EXTCODECOPY to read the delegate prefix (0xef0100 + 20-byte address)
    /// @param delegator The EOA to check
    /// @param expectedDelegate The expected delegate contract address
    /// @return valid Whether the delegator's code points to expectedDelegate
    function verifyDelegateCode(address delegator, address expectedDelegate) internal view returns (bool) {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(delegator)
        }

        // EIP-7702 delegate designation is exactly 23 bytes: 0xef0100 + 20-byte address
        if (codeSize != 23) {
            return false;
        }

        bytes memory code = new bytes(23);
        assembly {
            extcodecopy(delegator, add(code, 0x20), 0, 23)
        }

        // Check EIP-7702 prefix: 0xef0100
        if (code[0] != 0xef || code[1] != 0x01 || code[2] != 0x00) {
            return false;
        }

        // Extract delegate address (bytes 3-22)
        address delegateAddr;
        assembly {
            delegateAddr := shr(96, mload(add(code, 0x23)))
        }

        return delegateAddr == expectedDelegate;
    }
}
