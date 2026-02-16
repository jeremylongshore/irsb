/**
 * Minimal ABIs for IRSB contracts
 *
 * These are the events and functions needed by the watchtower.
 * Full ABIs should be imported from the IRSB protocol package in production.
 */

export const IntentReceiptHubAbi = [
  // Events
  {
    type: 'event',
    name: 'ReceiptPosted',
    inputs: [
      { name: 'receiptId', type: 'bytes32', indexed: true },
      { name: 'solverId', type: 'bytes32', indexed: true },
      { name: 'intentHash', type: 'bytes32', indexed: false },
      { name: 'challengeDeadline', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReceiptChallenged',
    inputs: [
      { name: 'receiptId', type: 'bytes32', indexed: true },
      { name: 'challenger', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReceiptFinalized',
    inputs: [
      { name: 'receiptId', type: 'bytes32', indexed: true },
      { name: 'solverId', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'DisputeOpened',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'receiptId', type: 'bytes32', indexed: true },
      { name: 'challenger', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'bond', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'slashed', type: 'bool', indexed: false },
    ],
  },
  // View functions
  {
    type: 'function',
    name: 'getReceipt',
    stateMutability: 'view',
    inputs: [{ name: 'receiptId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'intentHash', type: 'bytes32' },
          { name: 'solverId', type: 'bytes32' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'expiry', type: 'uint64' },
          { name: 'challengeDeadline', type: 'uint64' },
          { name: 'status', type: 'uint8' },
          { name: 'finalized', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getDispute',
    stateMutability: 'view',
    inputs: [{ name: 'disputeId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'receiptId', type: 'bytes32' },
          { name: 'challenger', type: 'address' },
          { name: 'reason', type: 'string' },
          { name: 'evidenceHash', type: 'bytes32' },
          { name: 'status', type: 'uint8' },
          { name: 'openedAt', type: 'uint64' },
          { name: 'deadline', type: 'uint64' },
          { name: 'challengerBond', type: 'uint256' },
        ],
      },
    ],
  },
  // Write functions
  {
    type: 'function',
    name: 'openDispute',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiptId', type: 'bytes32' },
      { name: 'reason', type: 'string' },
      { name: 'evidenceHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'disputeId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'submitEvidence',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'disputeId', type: 'bytes32' },
      { name: 'evidenceHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  // Constants
  {
    type: 'function',
    name: 'CHALLENGE_WINDOW',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
] as const;

export const SolverRegistryAbi = [
  // Events
  {
    type: 'event',
    name: 'SolverRegistered',
    inputs: [
      { name: 'solverId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BondDeposited',
    inputs: [
      { name: 'solverId', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SolverSlashed',
    inputs: [
      { name: 'solverId', type: 'bytes32', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SolverJailed',
    inputs: [
      { name: 'solverId', type: 'bytes32', indexed: true },
      { name: 'until', type: 'uint64', indexed: false },
    ],
  },
  // View functions
  {
    type: 'function',
    name: 'getSolver',
    stateMutability: 'view',
    inputs: [{ name: 'solverId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'bondAmount', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'reputation', type: 'uint16' },
          { name: 'jailCount', type: 'uint8' },
          { name: 'registeredAt', type: 'uint64' },
          { name: 'metadataUri', type: 'string' },
        ],
      },
    ],
  },
  // Constants
  {
    type: 'function',
    name: 'MINIMUM_BOND',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const DisputeModuleAbi = [
  // Events
  {
    type: 'event',
    name: 'ArbitrationRequested',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'arbitrator', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ArbitrationDecided',
    inputs: [
      { name: 'disputeId', type: 'bytes32', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'decision', type: 'string', indexed: false },
    ],
  },
] as const;
