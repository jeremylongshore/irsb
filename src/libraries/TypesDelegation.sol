// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IRSB Delegation Types Library
/// @notice Data structures for EIP-7702 delegation with caveat enforcers
library TypesDelegation {
    // ============ Structs ============

    /// @notice A single caveat constraint on a delegation
    /// @dev Terms are ABI-encoded and interpreted by the enforcer contract
    struct Caveat {
        address enforcer; // ICaveatEnforcer contract address
        bytes terms; // ABI-encoded enforcer-specific parameters
    }

    /// @notice A delegation granting execution rights with caveats
    /// @dev Signed by the delegator via EIP-712, stored as hash in WalletDelegate
    struct Delegation {
        address delegator; // EOA that delegates execution rights
        address delegate; // WalletDelegate contract address
        bytes32 authority; // Parent delegation hash (bytes32(0) for root)
        Caveat[] caveats; // Ordered list of caveat enforcers
        uint256 salt; // Unique nonce to prevent replay
        bytes signature; // EIP-712 signature from delegator
    }

    /// @notice Parameters for an x402 payment settlement
    /// @dev Used by X402Facilitator for direct and delegated settlement
    struct SettlementParams {
        bytes32 paymentHash; // Unique payment identifier (keccak256 of proof)
        address token; // ERC20 token for payment (e.g., USDC)
        uint256 amount; // Payment amount in token units
        address seller; // Recipient of payment
        address buyer; // Payer (delegator in delegated flow)
        bytes32 receiptId; // IRSB receipt ID to post
        bytes32 intentHash; // Intent hash for receipt
        bytes proof; // x402 payment proof
        uint64 expiry; // Settlement deadline
    }

    /// @notice Execution parameters for a delegated call
    /// @dev Passed to executeDelegated() on WalletDelegate
    struct ExecutionParams {
        address target; // Contract to call
        bytes callData; // Encoded function call
        uint256 value; // ETH value to send
    }

    /// @notice Stored delegation state
    /// @dev Tracks delegation lifecycle in WalletDelegate
    struct StoredDelegation {
        address delegator; // Who created the delegation
        bool active; // Whether delegation is still valid
        uint64 createdAt; // When delegation was set up
        uint64 revokedAt; // When revoked (0 if active)
        bytes32 caveatsHash; // Hash of caveats array for verification
    }

    // ============ Enums ============

    /// @notice Delegation lifecycle states
    enum DelegationStatus {
        None, // Does not exist
        Active, // Valid and executable
        Revoked // Permanently revoked by delegator
    }

    // ============ Constants ============

    /// @notice EIP-712 type hash for Caveat
    bytes32 constant CAVEAT_TYPEHASH = keccak256("Caveat(address enforcer,bytes terms)");

    /// @notice EIP-712 type hash for Delegation
    bytes32 constant DELEGATION_TYPEHASH = keccak256(
        "Delegation(address delegator,address delegate,bytes32 authority,Caveat[] caveats,uint256 salt)"
        "Caveat(address enforcer,bytes terms)"
    );

    /// @notice EIP-712 type hash for ExecutionParams
    bytes32 constant EXECUTION_TYPEHASH = keccak256("ExecutionParams(address target,bytes callData,uint256 value)");

    /// @notice EIP-712 type hash for SettlementParams
    bytes32 constant SETTLEMENT_TYPEHASH = keccak256(
        "SettlementParams(bytes32 paymentHash,address token,uint256 amount,address seller,"
        "address buyer,bytes32 receiptId,bytes32 intentHash,bytes proof,uint64 expiry)"
    );

    // ============ Helper Functions ============

    /// @notice Compute the hash of a Caveat struct for EIP-712
    /// @param caveat The caveat to hash
    /// @return structHash The EIP-712 struct hash
    function hashCaveat(Caveat memory caveat) internal pure returns (bytes32) {
        return keccak256(abi.encode(CAVEAT_TYPEHASH, caveat.enforcer, keccak256(caveat.terms)));
    }

    /// @notice Compute the hash of a Caveat array for EIP-712
    /// @param caveats The array of caveats to hash
    /// @return arrayHash The hash of the encoded caveat hashes
    function hashCaveatArray(Caveat[] memory caveats) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](caveats.length);
        for (uint256 i = 0; i < caveats.length; i++) {
            hashes[i] = hashCaveat(caveats[i]);
        }
        return keccak256(abi.encodePacked(hashes));
    }

    /// @notice Compute the EIP-712 struct hash for a Delegation (excluding signature)
    /// @param delegation The delegation to hash
    /// @return structHash The EIP-712 struct hash
    function hashDelegation(Delegation memory delegation) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                DELEGATION_TYPEHASH,
                delegation.delegator,
                delegation.delegate,
                delegation.authority,
                hashCaveatArray(delegation.caveats),
                delegation.salt
            )
        );
    }

    /// @notice Compute the unique delegation identifier
    /// @param delegation The delegation
    /// @return delegationHash Unique delegation hash
    function computeDelegationId(Delegation memory delegation) internal pure returns (bytes32) {
        return hashDelegation(delegation);
    }

    /// @notice Compute the EIP-712 struct hash for SettlementParams
    /// @param params The settlement parameters
    /// @return structHash The EIP-712 struct hash
    function hashSettlement(SettlementParams memory params) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SETTLEMENT_TYPEHASH,
                params.paymentHash,
                params.token,
                params.amount,
                params.seller,
                params.buyer,
                params.receiptId,
                params.intentHash,
                keccak256(params.proof),
                params.expiry
            )
        );
    }
}
