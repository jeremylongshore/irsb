import { NonceEnforcer } from "generated";

NonceEnforcer.NonceUsed.handler(async ({ event, context }) => {
  context.NonceEnforcer_NonceUsed.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    delegationHash: event.params.delegationHash,
    nonce: event.params.nonce,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
