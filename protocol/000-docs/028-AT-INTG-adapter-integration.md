# Adapter Integration Guide

How to integrate external protocols with IRSB using the adapter pattern.

## Overview

IRSB provides adapter contracts that bridge external intent protocols to the IRSB accountability layer. Adapters:

- Translate protocol-specific events into IRSB receipts
- Map external reputation to IntentScore
- Enable cross-protocol solver accountability

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  External       │     │   Adapter       │     │   IRSB Core     │
│  Protocol       │────▶│   Contract      │────▶│   Contracts     │
│  (Across, etc)  │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
   Protocol Events         Transform             Registry/Hub/
   (fills, disputes)       & Forward             DisputeModule
```

## Contract Initialization Order

When deploying IRSB with extensions, follow this order:

```
1. SolverRegistry
2. IntentReceiptHub (needs Registry address)
3. DisputeModule (needs Hub + Registry addresses)
4. EscrowVault (needs Hub address)
5. Extensions/Adapters (need all core addresses)
```

### Authorization Setup

After deployment, configure authorizations:

```solidity
// Grant Hub permission to slash via Registry
solverRegistry.setAuthorizedHub(address(intentReceiptHub));

// Grant DisputeModule permission to resolve disputes
intentReceiptHub.setDisputeModule(address(disputeModule));

// Grant adapters permission to post receipts (optional)
intentReceiptHub.setAuthorizedAdapter(address(acrossAdapter), true);
```

## Adapter Pattern

### Interface

All adapters implement a common pattern:

```solidity
interface IProtocolAdapter {
    // Called when external protocol completes an intent
    function onIntentFilled(
        bytes32 externalIntentId,
        bytes calldata fillData
    ) external;

    // Called when external protocol reports a dispute
    function onIntentDisputed(
        bytes32 externalIntentId,
        bytes calldata disputeData
    ) external;

    // Map external solver ID to IRSB solver ID
    function mapSolverId(
        bytes32 externalSolverId
    ) external view returns (bytes32 irsbSolverId);
}
```

### Receipt Generation

Adapters transform external data into IRSB receipts:

```solidity
function _buildReceipt(
    bytes32 externalIntentId,
    bytes calldata fillData
) internal view returns (Types.IntentReceipt memory) {
    // Parse fill data from external protocol
    (address recipient, uint256 amount, bytes32 txHash) =
        abi.decode(fillData, (address, uint256, bytes32));

    // Map to IRSB receipt fields
    return Types.IntentReceipt({
        intentHash: keccak256(abi.encode(PROTOCOL_ID, externalIntentId)),
        constraintsHash: keccak256(fillData),
        routeHash: keccak256(abi.encode(block.chainid, address(this))),
        outcomeHash: txHash,
        evidenceHash: bytes32(0), // Filled later if needed
        createdAt: uint64(block.timestamp),
        expiry: uint64(block.timestamp + 1 hours),
        solverId: mapSolverId(externalSolverId),
        solverSig: "" // Adapter signs on behalf
    });
}
```

## Example: ERC8004Adapter

The ERC8004Adapter publishes IntentScore to the ERC-8004 validation registry:

```solidity
contract ERC8004Adapter is IValidationProvider {
    SolverRegistry public immutable registry;
    IntentReceiptHub public immutable hub;

    // IValidationProvider implementation
    function validate(
        address subject,
        bytes32 schemaId
    ) external view returns (bool valid, bytes memory data) {
        // Find solver by operator address
        bytes32 solverId = registry.operatorToSolver(subject);
        if (solverId == bytes32(0)) {
            return (false, "");
        }

        // Get solver stats
        (uint256 successCount, uint256 disputeCount, uint256 stake) =
            _getSolverStats(solverId);

        // Compute IntentScore
        uint256 intentScore = _computeIntentScore(
            successCount, disputeCount, stake
        );

        // Return validation data
        return (intentScore >= MIN_SCORE, abi.encode(intentScore));
    }
}
```

### IntentScore Algorithm

```solidity
function _computeIntentScore(
    uint256 successCount,
    uint256 disputeCount,
    uint256 stake
) internal pure returns (uint256) {
    // 40% success rate + 25% low disputes + 20% stake + 15% longevity
    uint256 successRate = successCount * 100 / (successCount + disputeCount + 1);
    uint256 disputeRate = 100 - (disputeCount * 100 / (successCount + 1));
    uint256 stakeScore = min(stake * 100 / STAKE_TARGET, 100);
    uint256 longevityScore = min(successCount * 5, 100);

    return (successRate * 40 + disputeRate * 25 + stakeScore * 20 + longevityScore * 15) / 100;
}
```

## Example: AcrossAdapter

The AcrossAdapter bridges Across V3 fills to IRSB receipts:

```solidity
contract AcrossAdapter is IProtocolAdapter {
    // Across SpokePool address
    address public immutable spokePool;

    // Map Across relayer to IRSB solver
    mapping(address => bytes32) public relayerToSolver;

    function onFillCompleted(
        bytes32 depositId,
        address relayer,
        uint256 amount
    ) external onlySpokePool {
        bytes32 solverId = relayerToSolver[relayer];
        require(solverId != bytes32(0), "Unknown relayer");

        // Build receipt from Across fill
        Types.IntentReceipt memory receipt = Types.IntentReceipt({
            intentHash: keccak256(abi.encode("across-v3", depositId)),
            constraintsHash: keccak256(abi.encode(amount)),
            routeHash: keccak256(abi.encode(block.chainid)),
            outcomeHash: keccak256(abi.encode(depositId, relayer)),
            evidenceHash: bytes32(0),
            createdAt: uint64(block.timestamp),
            expiry: uint64(block.timestamp + 1 hours),
            solverId: solverId,
            solverSig: "" // Use adapter signature
        });

        // Post to IRSB
        hub.postReceipt(receipt);
    }
}
```

## Creating a New Adapter

### Step 1: Define Protocol Mapping

Map external protocol concepts to IRSB:

| External Concept | IRSB Equivalent |
|------------------|-----------------|
| Intent/Order ID | `intentHash` |
| Fill constraints | `constraintsHash` |
| Route/path | `routeHash` |
| Outcome proof | `outcomeHash` |
| Relayer/Solver | `solverId` |

### Step 2: Implement Adapter Contract

```solidity
contract MyProtocolAdapter {
    IntentReceiptHub public immutable hub;
    SolverRegistry public immutable registry;
    address public immutable externalProtocol;

    constructor(
        address _hub,
        address _registry,
        address _externalProtocol
    ) {
        hub = IntentReceiptHub(_hub);
        registry = SolverRegistry(_registry);
        externalProtocol = _externalProtocol;
    }

    // Implement protocol-specific callbacks
    function onMyProtocolEvent(...) external {
        require(msg.sender == externalProtocol, "Unauthorized");
        // Build receipt
        // Post to hub
    }
}
```

### Step 3: Register Adapter

```solidity
// As governance/owner
intentReceiptHub.setAuthorizedAdapter(address(myAdapter), true);
```

### Step 4: Register Solvers

Solvers from the external protocol must register with IRSB:

```solidity
// Solver registers with IRSB
solverRegistry.registerSolver{value: 0.1 ether}(
    operatorAddress,
    metadataURI
);

// Adapter maps external ID to IRSB ID
myAdapter.registerSolverMapping(
    externalSolverId,
    irsbSolverId
);
```

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Unauthorized receipt posting | Only authorized adapters can post |
| Replay attacks | Include chain ID and nonce in hashes |
| Solver impersonation | Require solver registration before mapping |
| External protocol compromise | Adapters should validate callback sources |

## Deployment Checklist

- [ ] Deploy core contracts in order
- [ ] Configure authorizations
- [ ] Deploy adapter
- [ ] Authorize adapter on Hub
- [ ] Register solver mappings
- [ ] Test receipt flow end-to-end
- [ ] Monitor for unexpected events
