import { describe, it, expect } from "vitest";
import { canonicalJson, parseAndCanonicalize } from "./canonicalJson.js";

describe("canonicalJson", () => {
  it("should produce identical output for objects with different key order", () => {
    const obj1 = { b: 1, a: 2, c: 3 };
    const obj2 = { a: 2, c: 3, b: 1 };
    const obj3 = { c: 3, b: 1, a: 2 };

    const result1 = canonicalJson(obj1);
    const result2 = canonicalJson(obj2);
    const result3 = canonicalJson(obj3);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toBe('{"a":2,"b":1,"c":3}');
  });

  it("should sort nested object keys recursively", () => {
    const obj = {
      z: { b: 1, a: 2 },
      a: { y: 3, x: 4 },
    };

    const result = canonicalJson(obj);
    expect(result).toBe('{"a":{"x":4,"y":3},"z":{"a":2,"b":1}}');
  });

  it("should preserve array order", () => {
    const obj = { items: [3, 1, 2] };
    const result = canonicalJson(obj);
    expect(result).toBe('{"items":[3,1,2]}');
  });

  it("should sort object keys within arrays", () => {
    const obj = { items: [{ b: 1, a: 2 }] };
    const result = canonicalJson(obj);
    expect(result).toBe('{"items":[{"a":2,"b":1}]}');
  });

  it("should handle null and undefined", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(undefined)).toBe(undefined);
    expect(canonicalJson({ a: null, b: undefined })).toBe('{"a":null}');
  });

  it("should handle primitive types", () => {
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
  });

  it("should handle empty objects and arrays", () => {
    expect(canonicalJson({})).toBe("{}");
    expect(canonicalJson([])).toBe("[]");
  });

  it("should produce no whitespace", () => {
    const obj = { a: 1, b: { c: 2 } };
    const result = canonicalJson(obj);
    expect(result).not.toContain(" ");
    expect(result).not.toContain("\n");
    expect(result).not.toContain("\t");
  });
});

describe("parseAndCanonicalize", () => {
  it("should parse JSON and return canonical form", () => {
    const json = '{"b": 1, "a": 2}';
    const result = parseAndCanonicalize(json);
    expect(result).toBe('{"a":2,"b":1}');
  });

  it("should produce identical output for equivalent JSON strings", () => {
    const json1 = '{"b": 1, "a": 2}';
    const json2 = '{"a":2,"b":1}';

    expect(parseAndCanonicalize(json1)).toBe(parseAndCanonicalize(json2));
  });
});
