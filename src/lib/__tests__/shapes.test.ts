import { describe, expect, it } from "vitest";
import { shortAddr, fmtNum, pickKey } from "../utils/format";
import { unwrapMcp, toRows, str, mcpErrorMessage, balanceRows } from "../mcp/shapes";

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
  it("does not recurse into empty nested arrays (keeps sibling fields)", () => {
    // Regression: { cook:{…}, tokens:[] } used to render as nothing.
    const rows = toRows({ cook: { amount: "5" }, tokens: [] }).rows;
    expect(rows).toContainEqual({ label: "cook", value: "5" });
  });
  it("renders pool rows with base/quote pair + tvl (live shape)", () => {
    const pools = {
      count: 20,
      totalPools: 168,
      pools: [
        {
          poolId: "DmzxJyiCpoW9FC2iimG2fDm24LW5C8YbFtVJGVKrePkc",
          venue: "COOKIESWAP CPAMM",
          base: { mint: "Ek", symbol: "bCOOK" },
          quote: { mint: "So", symbol: "wCOOK" },
          tvlUsd: 1225.31,
          volume24h: 1.3,
        },
      ],
    };
    expect(toRows(pools, 5).rows[0]).toEqual({ label: "bCOOK/wCOOK", value: "1,225.31" });
  });
});

describe("balanceRows", () => {
  it("keeps native COOK visible even when tokens[] is empty (live shape)", () => {
    // Regression B2: the COOK balance was dropped by recursing into tokens[].
    const raw = { wallet: "Ek", cook: { amount: "0.0014616", usdValue: 1e-7 }, tokens: [], totalUsd: 1e-7 };
    expect(balanceRows(raw).rows).toEqual([{ label: "COOK", value: "0.0014616" }]);
  });
  it("lists COOK then each SPL token", () => {
    const raw = {
      cook: { amount: "12.5" },
      tokens: [{ symbol: "bCOOK", uiAmount: "3.2" }, { mint: "XyZ", amount: "9" }],
    };
    expect(balanceRows(raw).rows).toEqual([
      { label: "COOK", value: "12.5" },
      { label: "bCOOK", value: "3.2" },
      { label: "XyZ", value: "9" },
    ]);
  });
});

describe("mcpErrorMessage", () => {
  it("returns null for normal results", () => {
    expect(
      mcpErrorMessage({ result: { content: [{ text: '{"ok":true}' }] } }),
    ).toBeNull();
    expect(mcpErrorMessage({ result: { slot: 9 } })).toBeNull();
    expect(mcpErrorMessage("ok")).toBeNull();
  });
  it("surfaces tool errors carrying JSON {error,hint}", () => {
    // Captured live: transfer with an unfunded wallet.
    const raw = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [
          { type: "text", text: '{"error":"transfer simulation failed","hint":"check the recipient"}' },
        ],
        isError: true,
      },
    };
    expect(mcpErrorMessage(raw)).toBe("transfer simulation failed — check the recipient");
  });
  it("surfaces tool errors carrying a plain string", () => {
    const raw = {
      result: { content: [{ text: "MCP error -32602: Input validation error" }], isError: true },
    };
    expect(mcpErrorMessage(raw)).toBe("MCP error -32602: Input validation error");
  });
  it("surfaces JSON-RPC protocol errors", () => {
    expect(mcpErrorMessage({ jsonrpc: "2.0", id: 1, error: { code: -32600, message: "bad" } })).toBe(
      "bad",
    );
  });
  it("does not flag needs_signature as an error", () => {
    expect(
      mcpErrorMessage({ result: { content: [{ text: '{"status":"needs_signature"}' }] } }),
    ).toBeNull();
  });
});
