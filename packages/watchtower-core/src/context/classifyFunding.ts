import type { TransactionInfo, FundingSource, FundingKind } from './contextTypes.js';

export interface AddressTagMap {
  /** Maps lowercase address → tag (CEX, MIXER, BRIDGE) */
  [address: string]: FundingKind;
}

/**
 * Load an allowlist/denylist file (one address per line, optionally: address,tag).
 * Returns a map of lowercase address → FundingKind.
 */
export function parseTagFile(content: string, defaultTag: FundingKind): AddressTagMap {
  const map: AddressTagMap = {};
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(',').map((s) => s.trim());
    const addr = parts[0]!.toLowerCase();
    if (addr) {
      const tag = (parts[1] as FundingKind | undefined) ?? defaultTag;
      map[addr] = tag;
    }
  }
  return map;
}

/**
 * Classify the funding source of an agent address.
 *
 * Finds the first inbound ETH transfer and classifies the sender:
 * - Check allowlist/denylist first (CEX, MIXER, BRIDGE)
 * - If sender is a contract → CONTRACT
 * - If sender is an EOA → EOA
 * - Fallback → UNKNOWN
 */
export function classifyFunding(
  agentAddress: string,
  transactions: TransactionInfo[],
  allowlist?: AddressTagMap,
  denylist?: AddressTagMap,
): FundingSource {
  const addr = agentAddress.toLowerCase();

  // Find first inbound tx (sorted by blockNumber ascending, pick earliest)
  const inbound = transactions
    .filter((tx) => tx.to?.toLowerCase() === addr && tx.value > 0n)
    .sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));

  if (inbound.length === 0) {
    return { kind: 'UNKNOWN' };
  }

  const firstTx = inbound[0]!;
  const senderAddr = firstTx.from.toLowerCase();

  // Check denylist first (more restrictive)
  if (denylist && senderAddr in denylist) {
    return { kind: denylist[senderAddr]!, ref: senderAddr };
  }

  // Check allowlist
  if (allowlist && senderAddr in allowlist) {
    return { kind: allowlist[senderAddr]!, ref: senderAddr };
  }

  // Classify by contract/EOA
  if (firstTx.fromIsContract) {
    return { kind: 'CONTRACT', ref: senderAddr };
  }

  return { kind: 'EOA', ref: senderAddr };
}
