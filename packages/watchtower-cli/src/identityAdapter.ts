import type { ChainProvider } from '@irsb-watchtower/chain';
import type { IdentityEventSource, IdentityRegistrationEvent } from '@irsb-watchtower/watchtower-core';
import { ERC8004_REGISTRY_ABI } from './erc8004Abi.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Adapts a ChainProvider + registry address into the IdentityEventSource interface
 * expected by watchtower-core's identity poller.
 */
export function createIdentityEventSource(
  provider: ChainProvider,
  registryAddress: `0x${string}`,
): IdentityEventSource {
  return {
    async getLatestBlockNumber(): Promise<bigint> {
      return provider.getBlockNumber();
    },

    async getRegistrationEvents(
      fromBlock: bigint,
      toBlock: bigint,
    ): Promise<IdentityRegistrationEvent[]> {
      const events = await provider.getEvents(ERC8004_REGISTRY_ABI, {
        address: registryAddress,
        eventNames: ['Registered', 'Transfer'],
        fromBlock,
        toBlock,
      });

      const results: IdentityRegistrationEvent[] = [];

      for (const event of events) {
        if (event.name === 'Registered') {
          const args = event.args as { agentId: bigint; agentURI: string; owner: string };
          results.push({
            agentTokenId: args.agentId.toString(),
            agentUri: args.agentURI,
            ownerAddress: args.owner,
            eventType: 'Registered',
            blockNumber: event.blockNumber,
            txHash: event.txHash,
            logIndex: event.logIndex,
          });
        } else if (event.name === 'Transfer') {
          const args = event.args as { from: string; to: string; tokenId: bigint };
          // Only include mints (from = 0x0)
          if (args.from.toLowerCase() === ZERO_ADDRESS) {
            results.push({
              agentTokenId: args.tokenId.toString(),
              agentUri: '',
              ownerAddress: args.to,
              eventType: 'Transfer',
              blockNumber: event.blockNumber,
              txHash: event.txHash,
              logIndex: event.logIndex,
            });
          }
        }
      }

      return results;
    },
  };
}
