import { IdentityRegistry } from "generated";

IdentityRegistry.Registered.handler(async ({ event, context }) => {
  context.IdentityRegistry_Registered.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    agentId: event.params.agentId,
    agentURI: event.params.agentURI,
    owner: event.params.owner,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

IdentityRegistry.MetadataSet.handler(async ({ event, context }) => {
  context.IdentityRegistry_MetadataSet.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    agentId: event.params.agentId,
    indexedMetadataKey: event.params.indexedMetadataKey,
    metadataKey: event.params.metadataKey,
    metadataValue: event.params.metadataValue,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});

IdentityRegistry.URIUpdated.handler(async ({ event, context }) => {
  context.IdentityRegistry_URIUpdated.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    agentId: event.params.agentId,
    newURI: event.params.newURI,
    updatedBy: event.params.updatedBy,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  });
});
