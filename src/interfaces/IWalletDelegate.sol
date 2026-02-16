// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TypesDelegation } from "../libraries/TypesDelegation.sol";

/// @title IWalletDelegate
/// @notice Interface for EIP-7702 wallet delegation with ERC-7710 redemption
/// @dev Manages delegations from EOAs with on-chain caveat enforcement
interface IWalletDelegate {
    // ============ Events ============

    /// @notice Emitted when a delegation is set up
    event DelegationSetup(bytes32 indexed delegationHash, address indexed delegator, uint256 caveatCount, uint256 salt);

    /// @notice Emitted when a delegation is revoked
    event DelegationRevoked(bytes32 indexed delegationHash, address indexed delegator);

    /// @notice Emitted when a delegated call is executed
    event DelegatedExecution(
        bytes32 indexed delegationHash, address indexed delegator, address indexed target, uint256 value
    );

    // ============ Errors ============

    error DelegationNotFound();
    error DelegationNotActive();
    error DelegationAlreadyExists();
    error InvalidDelegator();
    error InvalidSignature();
    error InvalidDelegate();
    error NotDelegator();
    error ExecutionFailed();
    error InvalidCaveat();
    error DelegateCodeMismatch();
    error LengthMismatch();

    // ============ External Functions ============

    /// @notice Set up a new delegation from an EIP-712 signed authorization
    /// @param delegation The delegation struct including signature
    function setupDelegation(TypesDelegation.Delegation calldata delegation) external;

    /// @notice Revoke a delegation (only callable by the delegator)
    /// @param delegationHash Hash of the delegation to revoke
    function revokeDelegation(bytes32 delegationHash) external;

    /// @notice Execute a delegated call after validating all caveats
    /// @param delegationHash Hash of the delegation to execute under
    /// @param target Contract to call
    /// @param callData Encoded function call
    /// @param value ETH value to send
    /// @return result Return data from the executed call
    function executeDelegated(bytes32 delegationHash, address target, bytes calldata callData, uint256 value)
        external
        payable
        returns (bytes memory result);

    /// @notice ERC-7710 redemption interface for batch delegation execution
    /// @param delegations Array of delegations to redeem
    /// @param modes Execution mode per delegation (0 = call only, delegatecall not supported)
    /// @param executionCalldata ABI-encoded ExecutionParams per delegation
    /// @return results Array of return data from each execution
    function redeemDelegations(
        TypesDelegation.Delegation[] calldata delegations,
        uint256[] calldata modes,
        bytes[] calldata executionCalldata
    ) external payable returns (bytes[] memory results);

    // ============ View Functions ============

    /// @notice Get stored delegation details
    /// @param delegationHash Hash of the delegation to query
    /// @return stored The stored delegation state
    function getDelegation(bytes32 delegationHash)
        external
        view
        returns (TypesDelegation.StoredDelegation memory stored);

    /// @notice Check if a delegation is active
    /// @param delegationHash Hash of the delegation to check
    /// @return active Whether the delegation is currently active
    function isDelegationActive(bytes32 delegationHash) external view returns (bool active);
}
