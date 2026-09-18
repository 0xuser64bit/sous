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
});
