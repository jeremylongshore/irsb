/**
 * ERC-8004 Registration Generator
 *
 * Generates registration.json for registry submission.
 * This is a stub - no actual chain interaction.
 */

import { createHash } from "node:crypto";
import type { RegistrationPayload } from "./types.js";
import { generateAgentCard, serializeAgentCard } from "./agentCard.js";

/**
 * Computes SHA-256 checksum of the agent card JSON.
 *
 * @param cardJson - The serialized agent card JSON
 * @returns Hex-encoded SHA-256 hash
 */
export function computeAgentCardChecksum(cardJson: string): string {
  return createHash("sha256").update(cardJson, "utf8").digest("hex");
}

/**
 * Options for generating registration payload.
 */
export interface GenerateRegistrationOptions {
  /** Base URL where the agent is hosted */
  baseUrl: string;
  /** Optional timestamp override (for testing) */
  timestamp?: string;
}

/**
 * Generates the registration payload.
 *
 * This payload would be submitted to an ERC-8004 registry.
 * Currently stubbed - no actual submission occurs.
 *
 * @param options - Generation options
 * @returns The registration payload
 */
export function generateRegistration(
  options: GenerateRegistrationOptions
): RegistrationPayload {
  // Generate the agent card
  const card = generateAgentCard();
  const cardJson = serializeAgentCard(card);
  const checksum = computeAgentCardChecksum(cardJson);

  // Build agent card URL
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const agentCardUrl = `${baseUrl}/.well-known/agent-card.json`;

  // Build registration payload
  const payload: RegistrationPayload = {
    agentId: card.agentId,
    name: card.name,
    version: card.version,
    standards: card.standards,
    agentCardUrl,
    agentCardChecksum: checksum,
    registeredAt: options.timestamp ?? new Date().toISOString(),
  };

  return payload;
}

/**
 * Serializes the registration payload to JSON.
 *
 * @param payload - The registration payload
 * @returns JSON string
 */
export function serializeRegistration(payload: RegistrationPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Generates and serializes registration in one step.
 *
 * @param options - Generation options
 * @returns JSON string of the registration payload
 */
export function generateRegistrationJson(
  options: GenerateRegistrationOptions
): string {
  const payload = generateRegistration(options);
  return serializeRegistration(payload);
}

/**
 * Stub registry endpoint for dry-run output.
 */
export const STUB_REGISTRY_ENDPOINT = "https://registry.erc8004.example/v1/agents";

/**
 * Formats the dry-run output showing what would be sent.
 *
 * @param payload - The registration payload
 * @returns Formatted string for CLI output
 */
export function formatDryRunOutput(payload: RegistrationPayload): string {
  const lines = [
    "=== ERC-8004 Registration (Dry Run) ===",
    "",
    `Endpoint: ${STUB_REGISTRY_ENDPOINT}`,
    `Method: POST`,
    "",
    "Payload:",
    serializeRegistration(payload),
    "",
    "---",
    "Note: This is a dry run. No actual registration was performed.",
    "To register for real, implement chain interaction in Phase 8+.",
  ];

  return lines.join("\n");
}
