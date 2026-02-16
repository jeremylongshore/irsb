/**
 * ERC-8004 Agent Card Generator
 *
 * Generates the agent card JSON for discovery.
 * Served at /.well-known/agent-card.json
 */

import type { AgentCard, AgentCardConfig } from "./types.js";

/**
 * Service metadata constants.
 */
const SERVICE_NAME = "irsb-solver";
const SERVICE_VERSION = "0.1.0";
const SERVICE_DESCRIPTION =
  "IRSB Protocol reference solver/executor. Consumes intents, runs allowed workflows off-chain, produces evidence, and submits receipts.";

/**
 * Default agent ID derived from service name and version.
 */
function deriveAgentId(): string {
  return `${SERVICE_NAME}@${SERVICE_VERSION}`;
}

/**
 * Generates the ERC-8004 agent card.
 *
 * The agent card provides discovery metadata and is deterministic -
 * calling this function with the same config always produces the same output.
 *
 * @param config - Optional configuration for the agent card
 * @returns The agent card object
 */
export function generateAgentCard(config?: AgentCardConfig): AgentCard {
  const agentId = config?.agentId ?? deriveAgentId();

  // Build the card with deterministic key ordering
  const card: AgentCard = {
    agentId,
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    version: SERVICE_VERSION,
    capabilities: [
      "intent-execution",
      "evidence-generation",
      "receipt-submission",
    ],
    endpoints: {
      health: "/healthz",
      metrics: "/metrics",
      execute: "N/A", // Non-interactive service
    },
    supportedTrust: [], // Placeholder for future trust mechanisms
    links: {
      documentation: "https://github.com/intent-solutions-io/irsb-solver#readme",
      repository: "https://github.com/intent-solutions-io/irsb-solver",
    },
    standards: ["ERC-8004"],
  };

  return card;
}

/**
 * Serializes the agent card to JSON with deterministic ordering.
 *
 * @param card - The agent card to serialize
 * @returns JSON string with sorted keys
 */
export function serializeAgentCard(card: AgentCard): string {
  // Use replacer to ensure consistent key ordering
  return JSON.stringify(card, null, 2);
}

/**
 * Generates and serializes the agent card in one step.
 *
 * @param config - Optional configuration
 * @returns JSON string of the agent card
 */
export function generateAgentCardJson(config?: AgentCardConfig): string {
  const card = generateAgentCard(config);
  return serializeAgentCard(card);
}
