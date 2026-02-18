import { SolverRegistry } from "generated";

SolverRegistry.BondDeposited.handler(async ({ event, context }) => {
  context.SolverRegistry_BondDeposited.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    solverId: event.params.solverId,
    amount: event.params.amount,
    newBalance: event.params.newBalance,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.BondWithdrawn.handler(async ({ event, context }) => {
  context.SolverRegistry_BondWithdrawn.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    solverId: event.params.solverId,
    amount: event.params.amount,
    newBalance: event.params.newBalance,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.OperatorKeyRotated.handler(async ({ event, context }) => {
  context.SolverRegistry_OperatorKeyRotated.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    solverId: event.params.solverId,
    oldOperator: event.params.oldOperator,
    newOperator: event.params.newOperator,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.OwnershipTransferred.handler(async ({ event, context }) => {
  context.SolverRegistry_OwnershipTransferred.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.Paused.handler(async ({ event, context }) => {
  context.SolverRegistry_Paused.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    account: event.params.account,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.SolverRegistered.handler(async ({ event, context }) => {
  context.SolverRegistry_SolverRegistered.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    solverId: event.params.solverId,
    operator: event.params.operator,
    metadataURI: event.params.metadataURI,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.SolverSlashed.handler(async ({ event, context }) => {
  context.SolverRegistry_SolverSlashed.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    solverId: event.params.solverId,
    amount: event.params.amount,
    receiptId: event.params.receiptId,
    reason: event.params.reason,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.SolverStatusChanged.handler(async ({ event, context }) => {
  context.SolverRegistry_SolverStatusChanged.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    solverId: event.params.solverId,
    oldStatus: event.params.oldStatus,
    newStatus: event.params.newStatus,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

SolverRegistry.Unpaused.handler(async ({ event, context }) => {
  context.SolverRegistry_Unpaused.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    account: event.params.account,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
