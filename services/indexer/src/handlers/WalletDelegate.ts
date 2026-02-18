import { WalletDelegate } from "generated";

WalletDelegate.DelegationSetup.handler(async ({ event, context }) => {
  context.WalletDelegate_DelegationSetup.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    delegationHash: event.params.delegationHash,
    delegator: event.params.delegator,
    caveatCount: event.params.caveatCount,
    salt: event.params.salt,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

WalletDelegate.DelegationRevoked.handler(async ({ event, context }) => {
  context.WalletDelegate_DelegationRevoked.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    delegationHash: event.params.delegationHash,
    delegator: event.params.delegator,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

WalletDelegate.DelegatedExecution.handler(async ({ event, context }) => {
  context.WalletDelegate_DelegatedExecution.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    delegationHash: event.params.delegationHash,
    delegator: event.params.delegator,
    target: event.params.target,
    value: event.params.value,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
