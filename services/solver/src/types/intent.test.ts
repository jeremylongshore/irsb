import { describe, it, expect } from "vitest";
import { parseIntent, isIntentV0, IntentV0Schema, INTENT_VERSION } from "./intent.js";

const validIntent = {
  intentVersion: "0.1.0",
  requester: "test@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  jobType: "SAFE_REPORT",
  inputs: {
    subject: "Test Report",
    data: { key: "value" },
  },
};

describe("IntentV0Schema", () => {
  it("should accept valid intent", () => {
    const result = IntentV0Schema.safeParse(validIntent);
    expect(result.success).toBe(true);
  });

  it("should accept intent with optional fields", () => {
    const intent = {
      ...validIntent,
      intentId: "custom-id",
      expiresAt: "2026-12-31T23:59:59.999Z",
      constraints: { timeout: 60 },
      acceptanceCriteria: [{ type: "test", description: "desc" }],
      meta: { source: "test" },
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(true);
  });

  it("should reject wrong intentVersion", () => {
    const intent = {
      ...validIntent,
      intentVersion: "0.2.0",
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject missing requester", () => {
    const { requester: _requester, ...intent } = validIntent;

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject empty requester", () => {
    const intent = {
      ...validIntent,
      requester: "",
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject missing createdAt", () => {
    const { createdAt: _createdAt, ...intent } = validIntent;

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject invalid createdAt timestamp", () => {
    const intent = {
      ...validIntent,
      createdAt: "not-a-date",
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject invalid jobType", () => {
    const intent = {
      ...validIntent,
      jobType: "INVALID_JOB",
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject missing inputs", () => {
    const { inputs: _inputs, ...intent } = validIntent;

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject invalid SAFE_REPORT inputs", () => {
    const intent = {
      ...validIntent,
      inputs: {
        // missing subject
        data: {},
      },
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });

  it("should reject empty subject in SAFE_REPORT inputs", () => {
    const intent = {
      ...validIntent,
      inputs: {
        subject: "",
        data: {},
      },
    };

    const result = IntentV0Schema.safeParse(intent);
    expect(result.success).toBe(false);
  });
});

describe("parseIntent", () => {
  it("should parse valid intent", () => {
    const intent = parseIntent(validIntent);
    expect(intent.intentVersion).toBe(INTENT_VERSION);
    expect(intent.requester).toBe("test@example.com");
  });

  it("should throw on invalid intent", () => {
    expect(() => parseIntent({ invalid: true })).toThrow();
  });
});

describe("isIntentV0", () => {
  it("should return true for valid intent", () => {
    expect(isIntentV0(validIntent)).toBe(true);
  });

  it("should return false for invalid intent", () => {
    expect(isIntentV0({ invalid: true })).toBe(false);
    expect(isIntentV0(null)).toBe(false);
    expect(isIntentV0(undefined)).toBe(false);
    expect(isIntentV0("string")).toBe(false);
  });
});

describe("INTENT_VERSION", () => {
  it("should be 0.1.0", () => {
    expect(INTENT_VERSION).toBe("0.1.0");
  });
});
