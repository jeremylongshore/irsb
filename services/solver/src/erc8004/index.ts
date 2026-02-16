/**
 * ERC-8004 Module
 *
 * Agent discovery and registration for ERC-8004 protocol.
 * This module provides:
 * - Agent card generation (/.well-known/agent-card.json)
 * - Registration payload generation
 * - Register command stub (dry-run only)
 *
 * Note: This is discovery/registration only.
 * No LLM, chat, or payment logic is included.
 */

// Types
export type {
  AgentCard,
  AgentCardEndpoints,
  AgentCardLinks,
  AgentCardConfig,
  RegistrationPayload,
} from "./types.js";

// Agent Card
export {
  generateAgentCard,
  serializeAgentCard,
  generateAgentCardJson,
} from "./agentCard.js";

// Registration
export {
  computeAgentCardChecksum,
  generateRegistration,
  serializeRegistration,
  generateRegistrationJson,
  formatDryRunOutput,
  STUB_REGISTRY_ENDPOINT,
} from "./registration.js";
export type { GenerateRegistrationOptions } from "./registration.js";

// Register Command
export {
  executeRegisterCommand,
} from "./registerStub.js";
export type {
  RegisterCommandOptions,
  RegisterCommandResult,
} from "./registerStub.js";
