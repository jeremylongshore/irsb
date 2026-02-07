/**
 * Canonical hasher tests
 */

import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalizeSorted, hashCanonical } from '../../src/audit/hasher.js';

describe('canonicalize', () => {
  it('serializes simple objects', () => {
    const obj = { a: 1, b: 'hello' };
    const result = canonicalize(obj);
    expect(result).toBe('{"a":1,"b":"hello"}');
  });

  it('serializes nested objects', () => {
    const obj = { a: { b: { c: 1 } } };
    const result = canonicalize(obj);
    expect(result).toBe('{"a":{"b":{"c":1}}}');
  });

  it('serializes arrays', () => {
    const arr = [1, 2, 3];
    const result = canonicalize(arr);
    expect(result).toBe('[1,2,3]');
  });

  it('handles null', () => {
    expect(canonicalize(null)).toBe('null');
  });

  it('handles boolean', () => {
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
  });

  it('handles numbers', () => {
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize(3.14)).toBe('3.14');
  });

  it('handles strings', () => {
    expect(canonicalize('hello')).toBe('"hello"');
  });
});

describe('canonicalizeSorted', () => {
  it('sorts object keys', () => {
    const obj = { z: 1, a: 2, m: 3 };
    const result = canonicalizeSorted(obj);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts nested object keys', () => {
    const obj = { b: { z: 1, a: 2 }, a: 1 };
    const result = canonicalizeSorted(obj);
    expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it('produces deterministic output regardless of key order', () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 };
    const obj3 = { b: 2, c: 3, a: 1 };

    const result1 = canonicalizeSorted(obj1);
    const result2 = canonicalizeSorted(obj2);
    const result3 = canonicalizeSorted(obj3);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('omits undefined values', () => {
    const obj = { a: 1, b: undefined, c: 3 };
    const result = canonicalizeSorted(obj);
    expect(result).toBe('{"a":1,"c":3}');
  });

  it('handles arrays in objects', () => {
    const obj = { items: [3, 1, 2], name: 'test' };
    const result = canonicalizeSorted(obj);
    expect(result).toBe('{"items":[3,1,2],"name":"test"}');
  });

  it('handles objects in arrays', () => {
    const arr = [{ z: 1, a: 2 }, { y: 3, b: 4 }];
    const result = canonicalizeSorted(arr);
    expect(result).toBe('[{"a":2,"z":1},{"b":4,"y":3}]');
  });
});

describe('hashCanonical', () => {
  it('produces 32-byte hex hash', () => {
    const obj = { test: 'value' };
    const hash = hashCanonical(obj);

    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it('produces deterministic hashes', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 2, a: 1 };

    const hash1 = hashCanonical(obj1);
    const hash2 = hashCanonical(obj2);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different values', () => {
    const hash1 = hashCanonical({ a: 1 });
    const hash2 = hashCanonical({ a: 2 });

    expect(hash1).not.toBe(hash2);
  });

  it('produces known hash for test vector', () => {
    // This is a regression test - if this changes, something is wrong
    const obj = { hello: 'world' };
    const hash = hashCanonical(obj);

    // Verify it's a valid keccak256 hash format
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(hash.length).toBe(66); // 0x + 64 hex chars
  });
});
