import { SpendLimitEnforcer } from "generated";

SpendLimitEnforcer.SpendRecorded.handler(async ({ event, context }) => {
  context.SpendLimitEnforcer_SpendRecorded.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    delegationHash: event.params.delegationHash,
    token: event.params.token,
    amount: event.params.amount,
    epochTotal: event.params.epochTotal,
    epoch: event.params.epoch,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
