// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IWalletDelegate } from "../interfaces/IWalletDelegate.sol";
import { ICaveatEnforcer } from "../interfaces/ICaveatEnforcer.sol";
import { TypesDelegation } from "../libraries/TypesDelegation.sol";
import { DelegationLib } from "./DelegationLib.sol";

/// @title WalletDelegate
/// @notice EIP-7702 wallet delegation with ERC-7710 redemption and caveat enforcement
/// @dev EOAs delegate execution to this contract; all calls validate caveats before execution
contract WalletDelegate is IWalletDelegate, Ownable, ReentrancyGuard, Pausable {
    // ============ State ============

    /// @notice Stored delegations indexed by delegation hash
    mapping(bytes32 => TypesDelegation.StoredDelegation) private _delegations;

    /// @notice Cached caveats per delegation for execution-time validation
    mapping(bytes32 => TypesDelegation.Caveat[]) private _caveats;

    /// @notice EIP-712 domain separator (computed once at deployment)
    bytes32 public immutable DOMAIN_SEPARATOR;

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        DOMAIN_SEPARATOR = DelegationLib.computeDomainSeparator(address(this));
    }

    // ============ External Functions ============

    /// @inheritdoc IWalletDelegate
    function setupDelegation(TypesDelegation.Delegation calldata delegation) external whenNotPaused {
        bytes32 delegationHash = TypesDelegation.hashDelegation(delegation);

        // Check delegation doesn't already exist
        if (_delegations[delegationHash].active) {
            revert DelegationAlreadyExists();
        }

        // Verify delegate is this contract
        if (delegation.delegate != address(this)) {
            revert InvalidDelegate();
        }

        // Verify EIP-712 signature
        address signer = DelegationLib.verifySigner(delegation, DOMAIN_SEPARATOR);
        if (signer != delegation.delegator) {
            revert InvalidSignature();
        }

        // Validate caveats
        for (uint256 i = 0; i < delegation.caveats.length; i++) {
            if (delegation.caveats[i].enforcer == address(0)) {
                revert InvalidCaveat();
            }
        }

        // Store delegation
        _delegations[delegationHash] = DelegationLib.toStored(delegation);

        // Store caveats for later execution
        for (uint256 i = 0; i < delegation.caveats.length; i++) {
            _caveats[delegationHash].push(delegation.caveats[i]);
        }

        emit DelegationSetup(delegationHash, delegation.delegator, delegation.caveats.length, delegation.salt);
    }

    /// @inheritdoc IWalletDelegate
    function revokeDelegation(bytes32 delegationHash) external {
        TypesDelegation.StoredDelegation storage stored = _delegations[delegationHash];

        if (stored.delegator == address(0)) {
            revert DelegationNotFound();
        }

        if (!stored.active) {
            revert DelegationNotActive();
        }

        if (msg.sender != stored.delegator) {
            revert NotDelegator();
        }

        // Effects
        stored.active = false;
        stored.revokedAt = uint64(block.timestamp);

        // Clean up caveats
        delete _caveats[delegationHash];

        emit DelegationRevoked(delegationHash, msg.sender);
    }

    /// @inheritdoc IWalletDelegate
    function executeDelegated(bytes32 delegationHash, address target, bytes calldata callData, uint256 value)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (bytes memory result)
    {
        TypesDelegation.StoredDelegation storage stored = _delegations[delegationHash];

        // WD-1: Revert if delegation is revoked
        if (stored.delegator == address(0)) {
            revert DelegationNotFound();
        }
        if (!stored.active) {
            revert DelegationNotActive();
        }

        address delegator = stored.delegator;
        TypesDelegation.Caveat[] storage caveats = _caveats[delegationHash];

        // WD-2: Run all beforeHooks
        for (uint256 i = 0; i < caveats.length; i++) {
            ICaveatEnforcer(caveats[i].enforcer)
                .beforeHook(caveats[i].terms, delegationHash, delegator, target, callData, value);
        }

        // Execute call
        bool success;
        (success, result) = target.call{ value: value }(callData);
        if (!success) {
            revert ExecutionFailed();
        }

        // WD-2: Run all afterHooks
        for (uint256 i = 0; i < caveats.length; i++) {
            ICaveatEnforcer(caveats[i].enforcer)
                .afterHook(caveats[i].terms, delegationHash, delegator, target, callData, value);
        }

        emit DelegatedExecution(delegationHash, delegator, target, value);
    }

    /// @inheritdoc IWalletDelegate
    function redeemDelegations(
        TypesDelegation.Delegation[] calldata delegations,
        uint256[] calldata modes,
        bytes[] calldata executionCalldata
    ) external payable whenNotPaused nonReentrant returns (bytes[] memory results) {
        if (delegations.length != modes.length || modes.length != executionCalldata.length) {
            revert LengthMismatch();
        }

        results = new bytes[](delegations.length);

        for (uint256 i = 0; i < delegations.length; i++) {
            bytes32 delegationHash = TypesDelegation.hashDelegation(delegations[i]);
            TypesDelegation.StoredDelegation storage stored = _delegations[delegationHash];

            if (stored.delegator == address(0)) {
                revert DelegationNotFound();
            }
            if (!stored.active) {
                revert DelegationNotActive();
            }

            // Decode execution params
            TypesDelegation.ExecutionParams memory params =
                abi.decode(executionCalldata[i], (TypesDelegation.ExecutionParams));

            address delegator = stored.delegator;
            TypesDelegation.Caveat[] storage caveats = _caveats[delegationHash];

            // Run all beforeHooks
            for (uint256 j = 0; j < caveats.length; j++) {
                ICaveatEnforcer(caveats[j].enforcer)
                    .beforeHook(
                        caveats[j].terms, delegationHash, delegator, params.target, params.callData, params.value
                    );
            }

            // Execute (mode 0 = call only — delegatecall disabled for safety)
            require(modes[i] == 0, "Only call mode (0) supported");
            bool success;
            (success, results[i]) = params.target.call{ value: params.value }(params.callData);
            if (!success) {
                revert ExecutionFailed();
            }

            // Run all afterHooks
            for (uint256 j = 0; j < caveats.length; j++) {
                ICaveatEnforcer(caveats[j].enforcer)
                    .afterHook(
                        caveats[j].terms, delegationHash, delegator, params.target, params.callData, params.value
                    );
            }

            emit DelegatedExecution(delegationHash, delegator, params.target, params.value);
        }
    }

    // ============ View Functions ============

    /// @inheritdoc IWalletDelegate
    function getDelegation(bytes32 delegationHash) external view returns (TypesDelegation.StoredDelegation memory) {
        return _delegations[delegationHash];
    }

    /// @inheritdoc IWalletDelegate
    function isDelegationActive(bytes32 delegationHash) external view returns (bool) {
        TypesDelegation.StoredDelegation storage stored = _delegations[delegationHash];
        return stored.delegator != address(0) && stored.active;
    }

    // ============ Admin Functions ============

    /// @notice Pause all delegation operations (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause delegation operations
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Fallback ============

    receive() external payable { }
}
