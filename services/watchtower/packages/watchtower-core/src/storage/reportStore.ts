import type Database from 'better-sqlite3';
import type { RiskReport } from '../schemas/index.js';

export function insertRiskReport(db: Database.Database, report: RiskReport): void {
  db.prepare(
    `INSERT OR IGNORE INTO risk_reports (report_id, agent_id, generated_at, overall_risk, confidence, report_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    report.reportId,
    report.agentId,
    report.generatedAt,
    report.overallRisk,
    report.confidence,
    JSON.stringify(report),
  );
}

export function getLatestRiskReport(
  db: Database.Database,
  agentId: string,
): RiskReport | undefined {
  const row = db
    .prepare(
      `SELECT report_json FROM risk_reports WHERE agent_id = ? ORDER BY generated_at DESC LIMIT 1`,
    )
    .get(agentId) as { report_json: string } | undefined;

  if (!row) return undefined;
  return JSON.parse(row.report_json) as RiskReport;
}
