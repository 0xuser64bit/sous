import { describe, expect, it } from "vitest";
import { shortAddr, fmtNum, pickKey } from "../utils/format";
import { unwrapMcp, toRows, str } from "../mcp/shapes";

describe("format", () => {
  it("shortens addresses", () => {
    expect(shortAddr("7xKXtg2CW87d97TXJSDXFT1234567890", 4)).toBe("7xKX…7890");
    expect(shortAddr("abc", 4)).toBe("abc");
  });
  it("compacts numbers", () => {
    expect(fmtNum(1_500_000)).toBe("1.50M");
    expect(fmtNum("abc")).toBe("—");
  });
  it("picks keys case-insensitively", () => {
    expect(pickKey({ Slot: 12 }, ["slot"])).toBe(12);
    expect(pickKey({}, ["slot"])).toBeUndefined();
  });
});

describe("unwrapMcp", () => {
  it("passes through needs_signature payloads", () => {
    const p = { status: "needs_signature", transactionBase64: "abc" };
    expect(unwrapMcp(p)).toBe(p);
  });
  it("unwraps jsonrpc result + content envelopes", () => {
    expect(
      unwrapMcp({ jsonrpc: "2.0", id: 1, result: { content: [{ text: '{"slot":5}' }] } }),
    ).toEqual({ slot: 5 });
    expect(unwrapMcp({ result: { slot: 9 } })).toEqual({ slot: 9 });
    expect(unwrapMcp({ content: [{ text: "hello" }] })).toBe("hello");
  });
  it("returns scalars as-is", () => {
    expect(unwrapMcp("ok")).toBe("ok");
    expect(unwrapMcp(null)).toBe(null);
  });
});

describe("toRows", () => {
  it("handles arrays, maps, and strings without throwing", () => {
    expect(toRows([{ symbol: "COOK", uiAmount: 10 }]).rows).toEqual([
      { label: "COOK", value: "10" },
    ]);
    const m = toRows({ slot: 5, ok: true }, 8);
    expect(m.rows.length).toBe(2);
    expect(toRows("hello").rows).toEqual([{ label: "result", value: "hello" }]);
    expect(toRows(undefined).rows.length).toBe(1);
  });
  it("str never throws on odd values", () => {
    expect(str(NaN)).toBe("—");
    expect(str(true)).toBe("yes");
  });
});
