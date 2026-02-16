import { describe, it, expect } from "vitest";
import { VERSION, INTENT_VERSION } from "./index.js";

describe("IRSB Solver", () => {
  it("should export VERSION", () => {
    expect(VERSION).toBe("0.1.0");
  });

  it("should export INTENT_VERSION", () => {
    expect(INTENT_VERSION).toBe("0.1.0");
  });
});
