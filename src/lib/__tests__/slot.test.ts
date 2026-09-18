import { describe, expect, it } from "vitest";
import { slotOf } from "../chain/slot";

describe("slotOf", () => {
  it("reads slots through the MCP envelope", () => {
    expect(
      slotOf({ jsonrpc: "2.0", id: 1, result: { slot: 25907199 } }),
    ).toBe("25,907,199");
    expect(
      slotOf({
        result: { content: [{ text: '{"slot":42}' }] },
      }),
    ).toBe("42");
    expect(slotOf({ result: {} })).toBeNull();
    expect(slotOf(null)).toBeNull();
    expect(slotOf("slot 123456")).toBe("123456");
  });

  it("reads the real chain_health shape (nested slots)", () => {
    const live = {
      healthy: true,
      slots: { processed: 25909146, confirmed: 25909146, finalized: 25909114 },
      absoluteSlot: 25909114,
      blockHeight: 25463615,
    };
    expect(slotOf(live)).toBe("25,909,114");
    expect(slotOf({ slots: { finalized: 100 } })).toBe("100");
    expect(slotOf({ healthy: true })).toBeNull();
  });
});
