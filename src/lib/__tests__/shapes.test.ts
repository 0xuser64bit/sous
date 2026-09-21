import { describe, expect, it } from "vitest";
import { shortAddr, fmtNum, pickKey, trimAmount } from "../utils/format";
import {
  unwrapMcp,
  toRows,
  str,
  mcpErrorMessage,
  balanceRows,
  balanceOf,
  poolBoard,
  stakeRows,
  limitOrderRows,
  domainRows,
  tokenSearchRows,
} from "../mcp/shapes";
import {
  BALANCE,
  BCOOK_MINT,
  DOMAIN_AVAILABLE,
  EMPTY_LIMIT_ORDERS,
  STAKE_INFO,
} from "./fixtures/sidecar";

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
  it("trims amounts for display without overstating", () => {
    expect(trimAmount("7.506496794")).toBe("7.506496");
    expect(trimAmount("9.982")).toBe("9.982");
    expect(trimAmount(undefined)).toBe("—");
    expect(trimAmount("not-a-number")).toBe("not-a-number");
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

describe("balanceOf", () => {
  it("reads native COOK and SPL tokens (live shapes)", () => {
    const raw = {
      wallet: "Ek",
      cook: { amount: "12.5", usdValue: 0 },
      tokens: [{ symbol: "bCOOK", uiAmount: "3.2" }],
      totalUsd: 0,
    };
    expect(balanceOf(raw, "COOK")).toBe(12.5);
    expect(balanceOf(raw, "wcook")).toBe(12.5);
    expect(balanceOf(raw, "bcook")).toBe(3.2);
  });
  it("returns null — never zero — for unknown or unreadable balances", () => {
    expect(balanceOf({ cook: { amount: "0" }, tokens: [] }, "COOK")).toBe(0);
    expect(balanceOf({ cook: { amount: "0" }, tokens: [] }, "USDC")).toBeNull();
    expect(balanceOf({ cook: { amount: "n/a" }, tokens: [] }, "COOK")).toBeNull();
    expect(balanceOf(null, "COOK")).toBeNull();
  });
});

describe("poolBoard", () => {
  it("disambiguates same-pair pools by venue (live shape)", () => {
    const payload = {
      count: 20,
      pools: [
        { poolId: "Dmzx", venue: "COOKIESWAP CPAMM", base: { symbol: "bCOOK" }, quote: { symbol: "wCOOK" }, tvlUsd: 1222.34 },
        { poolId: "GHfz", venue: "COOKIEBOX DAMM", base: { symbol: "bCOOK" }, quote: { symbol: "wCOOK" }, tvlUsd: 900.1 },
      ],
    };
    const { pools, more } = poolBoard(payload, 5);
    // Same pair, different venue: the venue has to survive to tell them
    // apart, and it gets its own line rather than a truncating suffix.
    expect(pools).toEqual([
      { id: "Dmzx", pair: "bCOOK/wCOOK", venue: "COOKIESWAP CPAMM", tvl: "$1,222.34" },
      { id: "GHfz", pair: "bCOOK/wCOOK", venue: "COOKIEBOX DAMM", tvl: "$900.10" },
    ]);
    expect(new Set(pools.map((p) => p.id)).size).toBe(pools.length);
    expect(more).toBe(0);
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

describe("live payload rendering", () => {
  it("names an unnamed mint by its address instead of 'token'", () => {
    // get_balance sends symbol: null for mints with no metadata. pickKey used
    // to treat that null as present, so the mint fallback never ran and the
    // ledger showed anonymous rows.
    const { rows } = balanceRows(BALANCE);
    expect(rows).toEqual([
      { label: "COOK", value: "0.007962162" },
      { label: "bCOOK", value: "13,639,797.5205" },
      { label: "3UZt…f7kk", value: "1" },
    ]);
  });

  it("trims balances to a width the rail can hold", () => {
    // "13639797.520541906" in a 300px column is a truncated blur.
    expect(balanceRows(BALANCE).rows[1].value).toBe("13,639,797.5205");
    // ...while a dust balance keeps every digit it has, because there the
    // decimals are the whole number.
    expect(balanceRows(BALANCE).rows[0].value).toBe("0.007962162");
  });

  it("leads stake_info with the numbers, not three program addresses", () => {
    const rows = stakeRows(STAKE_INFO);
    expect(rows.map((r) => r.label)).toEqual(["APY", "1 bCOOK", "Pool TVL", "Fees"]);
    expect(rows[0].value).toBe("173.89%");
    expect(rows[1].value).toBe("1.364449 COOK");
    expect(rows[3].value).toBe("0.5% in · 2% out");
    // Nothing a reader cannot act on.
    expect(rows.some((r) => r.value.includes(STAKE_INFO.program))).toBe(false);
  });

  it("reports an empty order book as empty", () => {
    // The payload still carries owner/fees/count, so the generic renderer
    // produced one meaningless "fees …" row and the honest empty state never
    // fired.
    expect(limitOrderRows(EMPTY_LIMIT_ORDERS)).toEqual([]);
    expect(toRows(EMPTY_LIMIT_ORDERS).rows).toEqual([{ label: "fees", value: "…" }]);
  });

  it("labels a resting order with its terms", () => {
    const orders = limitOrderRows({
      orders: [
        { orderId: "abc", kind: "stop", amount: "5", from: "bCOOK", to: "COOK", price: "2" },
      ],
    });
    expect(orders).toEqual([{ id: "abc", label: "stop 5 bCOOK → COOK @ 2" }]);
  });

  it("prices a .cook name in COOK, and keeps the sidecar's own answer", () => {
    // The nested price used to collapse to its priceUsd: a bare "1.5" for a
    // name that costs 15,000 COOK. `note` was dropped entirely.
    const { rows, note } = domainRows(DOMAIN_AVAILABLE);
    expect(rows).toContainEqual({ label: "Status", value: "available" });
    expect(rows).toContainEqual({ label: "Price", value: "15.00K COOK (≈ $1.5)" });
    expect(note).toMatch(/is available/);
  });

  it("hands search results a mint to order with", () => {
    const { rows } = tokenSearchRows({
      results: [{ mint: BCOOK_MINT, symbol: "bCOOK", liquidityCook: 2510.8 }],
    });
    expect(rows).toEqual([{ label: "bCOOK · 2,510.8 COOK liq", value: BCOOK_MINT }]);
  });
});
