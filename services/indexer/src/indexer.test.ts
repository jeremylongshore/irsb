import { describe, it, expect } from "vitest";
import { TestHelpers } from "generated";
import "./handlers/SolverRegistry";

const { MockDb, SolverRegistry, Addresses } = TestHelpers;

describe("IRSB Indexer", () => {
  it("SolverRegistry BondDeposited saves event data", async () => {
    const mockDb = MockDb.createMockDb();

    const mockEvent = SolverRegistry.BondDeposited.createMockEvent({
      solverId: "0x" + "ab".repeat(32),
      amount: 1000n,
      newBalance: 1000n,
    });

    const result = await SolverRegistry.BondDeposited.processEvent({
      event: mockEvent,
      mockDb,
    });

    const entity = result.entities.SolverRegistry_BondDeposited.get(
      `${mockEvent.chainId}-${mockEvent.block.number}-${mockEvent.logIndex}`
    );

    expect(entity).toBeDefined();
    expect(entity?.amount).toBe(1000n);
    expect(entity?.newBalance).toBe(1000n);
  });
});
