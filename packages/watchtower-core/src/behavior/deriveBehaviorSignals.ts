import type { Signal, EvidenceLink } from '../schemas/index.js';
import type { NormalizedReceipt } from '../integrations/index.js';
import type { VerificationResult, FailureCode } from './verifyEvidence.js';
import { sortEvidence } from '../utils/sort.js';

interface SignalDef {
  signalId: string;
  severity: Signal['severity'];
  weight: number;
  /** Failure codes that trigger this signal. Empty = special handling. */
  codes: FailureCode[];
}

const SIGNAL_DEFS: SignalDef[] = [
  { signalId: 'BE_MANIFEST_NOT_FOUND', severity: 'CRITICAL', weight: 1.0, codes: ['MANIFEST_NOT_FOUND'] },
  { signalId: 'BE_MANIFEST_HASH_MISMATCH', severity: 'CRITICAL', weight: 1.0, codes: ['MANIFEST_HASH_MISMATCH'] },
  { signalId: 'BE_MANIFEST_PARSE_FAIL', severity: 'HIGH', weight: 0.8, codes: ['MANIFEST_PARSE_FAIL', 'MANIFEST_READ_ERROR'] },
  { signalId: 'BE_MANIFEST_SCHEMA_INVALID', severity: 'HIGH', weight: 0.8, codes: ['MANIFEST_SCHEMA_INVALID'] },
  { signalId: 'BE_MANIFEST_TOO_LARGE', severity: 'HIGH', weight: 0.8, codes: ['MANIFEST_TOO_LARGE'] },
  { signalId: 'BE_ARTIFACT_MISSING', severity: 'CRITICAL', weight: 1.0, codes: ['ARTIFACT_NOT_FOUND'] },
  { signalId: 'BE_ARTIFACT_HASH_MISMATCH', severity: 'CRITICAL', weight: 1.0, codes: ['ARTIFACT_HASH_MISMATCH'] },
  { signalId: 'BE_ARTIFACT_SIZE_MISMATCH', severity: 'HIGH', weight: 0.8, codes: ['ARTIFACT_SIZE_MISMATCH'] },
  { signalId: 'BE_UNSAFE_PATH', severity: 'CRITICAL', weight: 1.0, codes: ['UNSAFE_PATH'] },
  { signalId: 'BE_DELIVERED_MISMATCH', severity: 'CRITICAL', weight: 1.0, codes: ['DELIVERED_MISMATCH'] },
];

/**
 * Derive deterministic behavior signals from a verification result.
 *
 * Multiple failures of the same type produce one signal with all evidence refs collected.
 */
export function deriveBehaviorSignals(
  result: VerificationResult,
  receipt: NormalizedReceipt,
  observedAt: number,
): Signal[] {
  const signals: Signal[] = [];

  // Base evidence for every signal
  const baseEvidence: EvidenceLink[] = [
    { type: 'receiptId', ref: receipt.receiptId },
    { type: 'manifestSha256', ref: receipt.manifestSha256 },
  ];

  if (result.ok) {
    signals.push({
      signalId: 'BE_VERIFIED_OK',
      severity: 'LOW',
      weight: 0.1,
      observedAt,
      evidence: sortEvidence([...baseEvidence, ...result.evidenceLinks]),
    });
    return signals;
  }

  // Map failure codes to their matching failures
  const failuresByCode = new Map<FailureCode, typeof result.failures>();
  for (const failure of result.failures) {
    const existing = failuresByCode.get(failure.code) ?? [];
    existing.push(failure);
    failuresByCode.set(failure.code, existing);
  }

  for (const def of SIGNAL_DEFS) {
    const matchingFailures = def.codes.flatMap((code) => failuresByCode.get(code) ?? []);
    if (matchingFailures.length === 0) continue;

    // Collect evidence from matching failures
    const failureEvidence: EvidenceLink[] = matchingFailures
      .filter((f) => f.path)
      .map((f) => ({ type: 'failurePath', ref: f.path! }));

    signals.push({
      signalId: def.signalId,
      severity: def.severity,
      weight: def.weight,
      observedAt,
      evidence: sortEvidence([...baseEvidence, ...failureEvidence]),
    });
  }

  return signals;
}
