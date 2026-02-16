import type { Signal, EvidenceLink } from '../schemas/index.js';

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Sort signals: severity descending (CRITICAL > HIGH > MEDIUM > LOW), then signalId ascending.
 */
export function sortSignals<T extends Pick<Signal, 'severity' | 'signalId'>>(signals: T[]): T[] {
  return [...signals].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    if (sevDiff !== 0) return sevDiff;
    return a.signalId.localeCompare(b.signalId);
  });
}

/**
 * Sort evidence links: type ascending, then ref ascending.
 */
export function sortEvidence<T extends Pick<EvidenceLink, 'type' | 'ref'>>(evidence: T[]): T[] {
  return [...evidence].sort((a, b) => {
    const typeDiff = a.type.localeCompare(b.type);
    if (typeDiff !== 0) return typeDiff;
    return a.ref.localeCompare(b.ref);
  });
}
