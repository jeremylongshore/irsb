/**
 * Canonical JSON serialization for deterministic hashing.
 *
 * Rules:
 * - Object keys sorted lexicographically at every level
 * - Arrays preserved in order
 * - No whitespace
 * - Stable number handling (no type coercion)
 */

/**
 * Recursively sorts object keys and returns a new object.
 * Arrays are preserved in order but their object elements are sorted.
 */
function sortObjectKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Produces canonical JSON string with sorted keys and no whitespace.
 * This is deterministic: same logical object always produces identical output.
 */
export function canonicalJson(value: unknown): string {
  const sorted = sortObjectKeys(value);
  return JSON.stringify(sorted);
}

/**
 * Parses JSON and returns canonicalized form.
 * Useful for normalizing JSON input before comparison or hashing.
 */
export function parseAndCanonicalize(json: string): string {
  const parsed = JSON.parse(json) as unknown;
  return canonicalJson(parsed);
}
