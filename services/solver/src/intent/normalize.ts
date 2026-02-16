/**
 * Intent normalization and deterministic ID computation.
 *
 * intentId formula (if missing):
 * sha256("intent:" + intentVersion + ":" + requester + ":" +
 *        canonicalJson(jobType) + ":" + canonicalJson(inputs) + ":" +
 *        canonicalJson(constraints || {}))
 *
 * Note: createdAt/expiresAt are NOT included in the hash.
 */

import {
  type IntentV0,
  type NormalizedIntent,
  parseIntent,
} from "../types/intent.js";
import { canonicalJson } from "../utils/canonicalJson.js";
import { sha256 } from "../utils/hash.js";

/**
 * Computes the deterministic intentId for an intent.
 * This is always computed the same way regardless of whether
 * the intent already has an intentId.
 */
export function computeIntentId(intent: IntentV0): string {
  const parts = [
    "intent",
    intent.intentVersion,
    intent.requester,
    canonicalJson(intent.jobType),
    canonicalJson(intent.inputs),
    canonicalJson(intent.constraints ?? {}),
  ];

  return sha256(parts.join(":"));
}

/**
 * Normalizes an intent:
 * 1. Validates against schema
 * 2. Computes intentId if missing
 * 3. Returns NormalizedIntent with guaranteed intentId
 *
 * Throws ZodError if validation fails.
 */
export function normalizeIntent(value: unknown): NormalizedIntent {
  // Validate
  const intent = parseIntent(value);

  // Compute intentId if missing
  const intentId = intent.intentId ?? computeIntentId(intent);

  return {
    ...intent,
    intentId,
  };
}

/**
 * Validates and normalizes an intent from a JSON string.
 */
export function normalizeIntentFromJson(json: string): NormalizedIntent {
  const parsed = JSON.parse(json) as unknown;
  return normalizeIntent(parsed);
}
