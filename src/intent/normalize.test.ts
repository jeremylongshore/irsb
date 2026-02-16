import { describe, it, expect } from "vitest";
import { normalizeIntent, computeIntentId } from "./normalize.js";
import type { IntentV0 } from "../types/intent.js";

const validIntent: IntentV0 = {
  intentVersion: "0.1.0",
  requester: "test@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  jobType: "SAFE_REPORT",
  inputs: {
    subject: "Test Report",
    data: { key: "value" },
  },
};

describe("computeIntentId", () => {
  it("should produce deterministic intentId", () => {
    const id1 = computeIntentId(validIntent);
    const id2 = computeIntentId(validIntent);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("should produce different intentId for different inputs", () => {
    const intent2: IntentV0 = {
      ...validIntent,
      inputs: {
        subject: "Different Report",
        data: { key: "value" },
      },
    };

    const id1 = computeIntentId(validIntent);
    const id2 = computeIntentId(intent2);

    expect(id1).not.toBe(id2);
  });

  it("should NOT include createdAt in hash", () => {
    const intent2: IntentV0 = {
      ...validIntent,
      createdAt: "2026-12-31T23:59:59.999Z",
    };

    const id1 = computeIntentId(validIntent);
    const id2 = computeIntentId(intent2);

    expect(id1).toBe(id2);
  });

  it("should NOT include expiresAt in hash", () => {
    const intent2: IntentV0 = {
      ...validIntent,
      expiresAt: "2026-12-31T23:59:59.999Z",
    };

    const id1 = computeIntentId(validIntent);
    const id2 = computeIntentId(intent2);

    expect(id1).toBe(id2);
  });

  it("should include requester in hash", () => {
    const intent2: IntentV0 = {
      ...validIntent,
      requester: "other@example.com",
    };

    const id1 = computeIntentId(validIntent);
    const id2 = computeIntentId(intent2);

    expect(id1).not.toBe(id2);
  });

  it("should include constraints in hash", () => {
    const intent2: IntentV0 = {
      ...validIntent,
      constraints: { timeout: 60 },
    };

    const id1 = computeIntentId(validIntent);
    const id2 = computeIntentId(intent2);

    expect(id1).not.toBe(id2);
  });

  it("should produce same hash regardless of object key order in inputs", () => {
    const intent1: IntentV0 = {
      ...validIntent,
      inputs: {
        subject: "Test",
        data: { b: 2, a: 1 },
      },
    };

    const intent2: IntentV0 = {
      ...validIntent,
      inputs: {
        data: { a: 1, b: 2 },
        subject: "Test",
      },
    };

    const id1 = computeIntentId(intent1);
    const id2 = computeIntentId(intent2);

    expect(id1).toBe(id2);
  });
});

describe("normalizeIntent", () => {
  it("should add intentId if missing", () => {
    const normalized = normalizeIntent(validIntent);

    expect(normalized.intentId).toBeDefined();
    expect(normalized.intentId).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should preserve provided intentId", () => {
    const intentWithId: IntentV0 = {
      ...validIntent,
      intentId: "custom-id-123",
    };

    const normalized = normalizeIntent(intentWithId);

    expect(normalized.intentId).toBe("custom-id-123");
  });

  it("should throw on invalid intent", () => {
    expect(() => normalizeIntent({ invalid: true })).toThrow();
  });

  it("should throw on wrong intentVersion", () => {
    const badIntent = {
      ...validIntent,
      intentVersion: "0.2.0",
    };

    expect(() => normalizeIntent(badIntent)).toThrow();
  });

  it("should throw on missing required fields", () => {
    expect(() =>
      normalizeIntent({
        intentVersion: "0.1.0",
        // missing requester, createdAt, jobType, inputs
      })
    ).toThrow();
  });

  it("should produce deterministic result across calls", () => {
    const norm1 = normalizeIntent(validIntent);
    const norm2 = normalizeIntent(validIntent);

    expect(norm1.intentId).toBe(norm2.intentId);
  });
});
