import type { Rule } from './rule.js';
import { SampleRule, MockAlwaysFindRule } from './sampleRule.js';
import { createDelegationPaymentRule, type DelegationPaymentRuleConfig } from './delegationPaymentRule.js';

export { SampleRule, MockAlwaysFindRule } from './sampleRule.js';
export { ReceiptStaleRule, createReceiptStaleRule, type ReceiptStaleRuleConfig } from './receiptStaleRule.js';
export { DelegationPaymentRule, createDelegationPaymentRule, type DelegationPaymentRuleConfig } from './delegationPaymentRule.js';

/**
 * Rule registry - maps rule IDs to rule instances
 */
export class RuleRegistry {
  private rules: Map<string, Rule> = new Map();

  /**
   * Register a rule
   */
  register(rule: Rule): void {
    if (this.rules.has(rule.metadata.id)) {
      throw new Error(`Rule with ID ${rule.metadata.id} is already registered`);
    }
    this.rules.set(rule.metadata.id, rule);
  }

  /**
   * Get a rule by ID
   */
  get(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all registered rules
   */
  getAll(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get all enabled rules (those with enabledByDefault=true)
   */
  getEnabled(): Rule[] {
    return this.getAll().filter((rule) => rule.metadata.enabledByDefault);
  }

  /**
   * Get rule IDs
   */
  getIds(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Check if a rule is registered
   */
  has(id: string): boolean {
    return this.rules.has(id);
  }

  /**
   * Remove a rule
   */
  remove(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules.clear();
  }
}

/**
 * Create a registry with default rules
 */
export function createDefaultRegistry(config?: {
  delegationPayment?: DelegationPaymentRuleConfig;
}): RuleRegistry {
  const registry = new RuleRegistry();

  // Register built-in rules
  registry.register(new SampleRule());
  registry.register(new MockAlwaysFindRule());

  // Register delegation payment rule if config provided
  if (config?.delegationPayment) {
    registry.register(createDelegationPaymentRule(config.delegationPayment));
  }

  return registry;
}
