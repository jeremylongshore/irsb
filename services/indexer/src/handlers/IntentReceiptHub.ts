import { IntentReceiptHub } from "generated";

IntentReceiptHub.ReceiptPosted.handler(async ({ event, context }) => {
  context.IntentReceiptHub_ReceiptPosted.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    receiptId: event.params.receiptId,
    intentHash: event.params.intentHash,
    solverId: event.params.solverId,
    expiry: event.params.expiry,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

IntentReceiptHub.DisputeOpened.handler(async ({ event, context }) => {
  context.IntentReceiptHub_DisputeOpened.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    receiptId: event.params.receiptId,
    solverId: event.params.solverId,
    challenger: event.params.challenger,
    reason: event.params.reason,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

IntentReceiptHub.DisputeResolved.handler(async ({ event, context }) => {
  context.IntentReceiptHub_DisputeResolved.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    receiptId: event.params.receiptId,
    solverId: event.params.solverId,
    slashed: event.params.slashed,
    slashAmount: event.params.slashAmount,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

IntentReceiptHub.ReceiptFinalized.handler(async ({ event, context }) => {
  context.IntentReceiptHub_ReceiptFinalized.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    receiptId: event.params.receiptId,
    solverId: event.params.solverId,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

IntentReceiptHub.SettlementProofSubmitted.handler(async ({ event, context }) => {
  context.IntentReceiptHub_SettlementProofSubmitted.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    receiptId: event.params.receiptId,
    proofHash: event.params.proofHash,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
