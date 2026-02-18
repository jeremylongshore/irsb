import { DisputeModule } from "generated";

DisputeModule.EvidenceSubmitted.handler(async ({ event, context }) => {
  context.DisputeModule_EvidenceSubmitted.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    disputeId: event.params.disputeId,
    submitter: event.params.submitter,
    evidenceHash: event.params.evidenceHash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

DisputeModule.DisputeEscalated.handler(async ({ event, context }) => {
  context.DisputeModule_DisputeEscalated.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    disputeId: event.params.disputeId,
    arbitrator: event.params.arbitrator,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

DisputeModule.ArbitrationResolved.handler(async ({ event, context }) => {
  context.DisputeModule_ArbitrationResolved.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    disputeId: event.params.disputeId,
    solverFault: event.params.solverFault,
    slashAmount: event.params.slashAmount,
    reason: event.params.reason,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

DisputeModule.OwnershipTransferred.handler(async ({ event, context }) => {
  context.DisputeModule_OwnershipTransferred.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
