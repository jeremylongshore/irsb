import type { Finding } from './finding.js';
import { type RuleRegistry, createDefaultRegistry } from './rules/index.js';
import type { Rule, ChainContext } from './rules/rule.js';

/**
 * Options for rule engine execution
 */
export interface EngineOptions {
  /** Rule IDs to execute (if empty, runs all enabled rules) */
  ruleIds?: string[];

  /** Stop on first error (default: false, continue with other rules) */
  stopOnError?: boolean;

  /** Timeout per rule in milliseconds (default: 30000) */
  ruleTimeoutMs?: number;
}

/**
 * Result of a single rule evaluation
 */
export interface RuleResult {
  ruleId: string;
  findings: Finding[];
  error?: Error;
  durationMs: number;
}

/**
 * Result of engine execution
 */
export interface EngineResult {
  /** All findings from all rules */
  findings: Finding[];

  /** Per-rule results */
  ruleResults: RuleResult[];

  /** Total execution time */
  totalDurationMs: number;

  /** Number of rules executed */
  rulesExecuted: number;

  /** Number of rules that failed */
  rulesFailed: number;
}

/**
 * Rule Engine - orchestrates rule evaluation
 *
 * The engine is stateless and can be reused across multiple evaluations.
 * It handles:
 * - Rule selection (all enabled or specific IDs)
 * - Parallel/sequential execution
 * - Error isolation (one rule failing doesn't stop others)
 * - Timing and metrics
 */
export class RuleEngine {
  private registry: RuleRegistry;

  constructor(registry?: RuleRegistry) {
    this.registry = registry ?? createDefaultRegistry();
  }

  /**
   * Execute rules against the given context
   */
  async execute(context: ChainContext, options: EngineOptions = {}): Promise<EngineResult> {
    const startTime = Date.now();
    const { ruleIds, stopOnError = false, ruleTimeoutMs = 30000 } = options;

    // Select rules to run
    const rulesToRun = ruleIds
      ? ruleIds.map((id) => this.registry.get(id)).filter((r): r is Rule => r !== undefined)
      : this.registry.getEnabled();

    const ruleResults: RuleResult[] = [];
    const allFindings: Finding[] = [];

    // Execute rules sequentially (can be made parallel if needed)
    for (const rule of rulesToRun) {
      const ruleStart = Date.now();
      let findings: Finding[] = [];
      let error: Error | undefined;

      try {
        // Execute with timeout
        findings = await Promise.race([
          rule.evaluate(context),
          new Promise<Finding[]>((_, reject) =>
            setTimeout(() => reject(new Error(`Rule ${rule.metadata.id} timed out`)), ruleTimeoutMs)
          ),
        ]);
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        if (stopOnError) {
          ruleResults.push({
            ruleId: rule.metadata.id,
            findings: [],
            error,
            durationMs: Date.now() - ruleStart,
          });
          break;
        }
      }

      ruleResults.push({
        ruleId: rule.metadata.id,
        findings,
        error,
        durationMs: Date.now() - ruleStart,
      });

      allFindings.push(...findings);
    }

    return {
      findings: allFindings,
      ruleResults,
      totalDurationMs: Date.now() - startTime,
      rulesExecuted: ruleResults.length,
      rulesFailed: ruleResults.filter((r) => r.error).length,
    };
  }

  /**
   * Get the rule registry
   */
  getRegistry(): RuleRegistry {
    return this.registry;
  }

  /**
   * Add a rule to the registry
   */
  addRule(rule: Rule): void {
    this.registry.register(rule);
  }
}
