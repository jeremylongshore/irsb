// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IValidationRegistry } from "../interfaces/IValidationRegistry.sol";

/// @title MockERC8004Registry
/// @notice Mock validation registry for testing the ERC8004Adapter
/// @dev Stores validation records and provides query functions
contract MockERC8004Registry is IValidationRegistry {
    // ============ Structs ============

    struct ValidationRecord {
        bytes32 agentId;
        bool success;
        uint64 timestamp;
        bool exists;
    }

    struct AgentStats {
        uint256 total;
        uint256 successful;
    }

    // ============ State ============

    /// @notice Validation records by task ID
    mapping(bytes32 => ValidationRecord) private _validations;

    /// @notice Agent statistics
    mapping(bytes32 => AgentStats) private _agentStats;

    /// @notice Total validations recorded
    uint256 public totalValidations;

    /// @notice Authorized validation providers
    mapping(address => bool) public authorizedProviders;

    /// @notice Owner (for testing)
    address public owner;

    /// @notice Flag to simulate failures
    bool public shouldFail;

    // ============ Events ============

    event ValidationRecorded(bytes32 indexed taskId, bytes32 indexed agentId, bool success, uint64 timestamp);
    event ProviderAuthorized(address indexed provider, bool authorized);

    // ============ Errors ============

    error UnauthorizedProvider();
    error SimulatedFailure();
    error ValidationAlreadyExists();

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        authorizedProviders[msg.sender] = true;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedProviders[msg.sender]) {
            revert UnauthorizedProvider();
        }
        _;
    }

    // ============ IValidationRegistry Implementation ============

    /// @inheritdoc IValidationRegistry
    function recordValidation(bytes32 taskId, bytes32 agentId, bool success) external onlyAuthorized {
        // Check for simulated failure
        if (shouldFail) {
            revert SimulatedFailure();
        }

        // Check for duplicate (optional - can be removed if overwrites are OK)
        if (_validations[taskId].exists) {
            revert ValidationAlreadyExists();
        }

        // Record validation
        uint64 timestamp = uint64(block.timestamp);
        _validations[taskId] =
            ValidationRecord({ agentId: agentId, success: success, timestamp: timestamp, exists: true });

        // Update agent stats
        _agentStats[agentId].total++;
        if (success) {
            _agentStats[agentId].successful++;
        }

        totalValidations++;

        emit ValidationRecorded(taskId, agentId, success, timestamp);
    }

    /// @inheritdoc IValidationRegistry
    function getValidationCount(bytes32 agentId) external view returns (uint256 total, uint256 successful) {
        AgentStats storage stats = _agentStats[agentId];
        return (stats.total, stats.successful);
    }

    /// @inheritdoc IValidationRegistry
    function getValidation(bytes32 taskId) external view returns (bytes32 agentId, bool success, uint64 timestamp) {
        ValidationRecord storage record = _validations[taskId];
        return (record.agentId, record.success, record.timestamp);
    }

    /// @inheritdoc IValidationRegistry
    function isValidated(bytes32 taskId) external view returns (bool validated) {
        return _validations[taskId].exists;
    }

    // ============ Additional View Functions ============

    /// @notice Get success rate for an agent
    /// @param agentId Agent to query
    /// @return rate Success rate in basis points (0-10000)
    function getSuccessRate(bytes32 agentId) external view returns (uint256 rate) {
        AgentStats storage stats = _agentStats[agentId];
        if (stats.total == 0) return 0;
        return (stats.successful * 10_000) / stats.total;
    }

    /// @notice Get full validation record
    /// @param taskId Task to query
    /// @return record Full validation record
    function getFullValidation(bytes32 taskId) external view returns (ValidationRecord memory record) {
        return _validations[taskId];
    }

    // ============ Admin Functions ============

    /// @notice Authorize a validation provider
    /// @param provider Provider address
    /// @param authorized Whether to authorize
    function setAuthorizedProvider(address provider, bool authorized) external onlyOwner {
        authorizedProviders[provider] = authorized;
        emit ProviderAuthorized(provider, authorized);
    }

    /// @notice Toggle failure simulation (for testing)
    /// @param _shouldFail Whether to simulate failures
    function setShouldFail(bool _shouldFail) external onlyOwner {
        shouldFail = _shouldFail;
    }

    /// @notice Clear a validation (for testing only)
    /// @param taskId Task to clear
    function clearValidation(bytes32 taskId) external onlyOwner {
        ValidationRecord storage record = _validations[taskId];
        if (record.exists) {
            _agentStats[record.agentId].total--;
            if (record.success) {
                _agentStats[record.agentId].successful--;
            }
            delete _validations[taskId];
            totalValidations--;
        }
    }
}
