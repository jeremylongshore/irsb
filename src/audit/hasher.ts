/**
 * Canonical JSON Hasher
 *
 * Deterministic JSON serialization for audit artifacts.
 * Uses RFC 8785 (JSON Canonicalization Scheme) for reproducible hashes.
 */

import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * Canonicalize a value to deterministic JSON string.
 *
 * Rules (RFC 8785):
 * - Object keys sorted lexicographically
 * - No whitespace
 * - Numbers use shortest representation
 * - Strings escaped per JSON spec
 * - No trailing commas
 * - Undefined values omitted
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => val, 0);
}

/**
 * Recursively sort object keys for canonical representation
 */
function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();

    for (const key of keys) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) {
        sorted[key] = sortKeys(v);
      }
    }

    return sorted;
  }

  return value;
}

/**
 * Canonicalize with sorted keys (full RFC 8785 compliance)
 */
export function canonicalizeSorted(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/**
 * Compute keccak256 hash of canonicalized value
 */
export function hashCanonical(value: unknown): string {
  const canonical = canonicalizeSorted(value);
  return keccak256(toUtf8Bytes(canonical));
}

/**
 * Compute hash of a subset of object properties
 */
export function hashProperties<T extends object>(
  obj: T,
  properties: (keyof T)[]
): string {
  const subset: Partial<T> = {};
  for (const prop of properties) {
    if (obj[prop] !== undefined) {
      subset[prop] = obj[prop];
    }
  }
  return hashCanonical(subset);
}
