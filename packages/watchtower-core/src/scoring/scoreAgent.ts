import type { Agent, Snapshot, RiskReport, Alert, EvidenceLink, Confidence } from '../schemas/index.js';
import { canonicalJson, sha256Hex } from '../utils/canonical.js';
import { sortSignals, sortEvidence } from '../utils/sort.js';

const SEVERITY_POINTS: Record<string, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 60,
};

export function scoreAgent(
  agent: Agent,
  snapshots: Snapshot[],
  generatedAt: number,
): { report: RiskReport; newAlerts: Alert[] } {
  const allSignals = snapshots.flatMap((snap) => snap.signals);

  // Calculate overall risk: sum(points * weight), capped at 100
  let rawScore = 0;
  let hasCritical = false;
  for (const signal of allSignals) {
    const points = SEVERITY_POINTS[signal.severity] ?? 0;
    rawScore += points * signal.weight;
    if (signal.severity === 'CRITICAL') {
      hasCritical = true;
    }
  }

  const overallRisk = hasCritical ? 100 : Math.min(100, Math.round(rawScore));

  // Confidence calculation
  const uniqueSnapshots = new Set(snapshots.map((s) => s.snapshotId)).size;
  let confidence: Confidence;
  if (allSignals.length >= 5 && uniqueSnapshots >= 2) {
    confidence = 'HIGH';
  } else if (allSignals.length >= 2) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  // Collect reasons (sorted)
  const reasonSet = new Set<string>();
  for (const signal of allSignals) {
    reasonSet.add(`${signal.severity} signal: ${signal.signalId}`);
  }
  if (hasCritical) {
    reasonSet.add('CRITICAL signal detected — risk set to maximum');
  }
  const reasons = [...reasonSet].sort();

  // Collect all evidence links (sorted)
  const allEvidence: EvidenceLink[] = [];
  for (const signal of allSignals) {
    allEvidence.push(...signal.evidence);
  }
  const evidenceLinks = sortEvidence(dedupeEvidence(allEvidence));

  // Sorted signal summaries
  const sortedSignals = sortSignals(allSignals);
  const signalSummaries = sortedSignals.map((s) => ({
    severity: s.severity,
    signalId: s.signalId,
  }));

  // Build report (without generatedAt for ID hashing)
  const reportPayload = {
    agentId: agent.agentId,
    confidence,
    evidenceLinks,
    overallRisk,
    reasons,
    reportVersion: '0.1.0' as const,
    signals: signalSummaries,
  };

  const reportId = sha256Hex(canonicalJson(reportPayload));

  const report: RiskReport = {
    ...reportPayload,
    reportId,
    generatedAt,
  };

  // Generate alerts
  const newAlerts: Alert[] = [];

  if (hasCritical) {
    const criticalSignals = allSignals.filter((s) => s.severity === 'CRITICAL');
    const topEvidenceRefs = sortEvidence(
      criticalSignals.flatMap((s) => s.evidence),
    )
      .slice(0, 5)
      .map((e) => e.ref);

    const alertPayload = {
      agentId: agent.agentId,
      severity: 'CRITICAL' as const,
      topEvidenceRefs,
      type: 'CRITICAL_SIGNAL_DETECTED',
    };
    const alertId = sha256Hex(canonicalJson(alertPayload));

    newAlerts.push({
      alertId,
      agentId: agent.agentId,
      type: 'CRITICAL_SIGNAL_DETECTED',
      severity: 'CRITICAL',
      description: `Critical signal detected for agent ${agent.agentId}. Overall risk: ${overallRisk}`,
      evidenceLinks: sortEvidence(criticalSignals.flatMap((s) => s.evidence)),
      createdAt: generatedAt,
      isActive: true,
    });
  }

  if (overallRisk >= 80 && !hasCritical) {
    const topEvidenceRefs = evidenceLinks.slice(0, 5).map((e) => e.ref);
    const alertPayload = {
      agentId: agent.agentId,
      severity: 'HIGH' as const,
      topEvidenceRefs,
      type: 'HIGH_RISK_SCORE',
    };
    const alertId = sha256Hex(canonicalJson(alertPayload));

    newAlerts.push({
      alertId,
      agentId: agent.agentId,
      type: 'HIGH_RISK_SCORE',
      severity: 'HIGH',
      description: `High risk score (${overallRisk}) for agent ${agent.agentId}`,
      evidenceLinks,
      createdAt: generatedAt,
      isActive: true,
    });
  }

  return { report, newAlerts };
}

function dedupeEvidence(evidence: EvidenceLink[]): EvidenceLink[] {
  const seen = new Set<string>();
  const result: EvidenceLink[] = [];
  for (const e of evidence) {
    const key = `${e.type}:${e.ref}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  }
  return result;
}
