import { X402Facilitator } from "generated";

X402Facilitator.BatchSettled.handler(async ({ event, context }) => {
  context.X402Facilitator_BatchSettled.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    count: event.params.count,
    totalAmount: event.params.totalAmount,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

X402Facilitator.DelegatedPaymentSettled.handler(async ({ event, context }) => {
  context.X402Facilitator_DelegatedPaymentSettled.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    paymentHash: event.params.paymentHash,
    delegationHash: event.params.delegationHash,
    buyer: event.params.buyer,
    seller: event.params.seller,
    token: event.params.token,
    amount: event.params.amount,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

X402Facilitator.OwnershipTransferred.handler(async ({ event, context }) => {
  context.X402Facilitator_OwnershipTransferred.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

X402Facilitator.Paused.handler(async ({ event, context }) => {
  context.X402Facilitator_Paused.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    account: event.params.account,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

X402Facilitator.PaymentSettled.handler(async ({ event, context }) => {
  context.X402Facilitator_PaymentSettled.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    paymentHash: event.params.paymentHash,
    buyer: event.params.buyer,
    seller: event.params.seller,
    token: event.params.token,
    amount: event.params.amount,
    receiptId: event.params.receiptId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

X402Facilitator.Unpaused.handler(async ({ event, context }) => {
  context.X402Facilitator_Unpaused.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    account: event.params.account,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
