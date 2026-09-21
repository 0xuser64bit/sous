import { describe, expect, it } from "vitest";
import {
  guardSummary,
  transferMatches,
  sameRef,
  resolvedDestination,
  DRIFT_TOLERANCE,
} from "../tx/guard";
import { readSummary } from "../mcp/summary";
import type { QuoteData } from "../store/usePilotStore";
import {
  BCOOK_MINT,
  BRIDGE_INTERMEDIATE_SUMMARY,
  COOK_MINT,
  LIMIT_SUMMARY,
  TRADE_SUMMARY,
  TRANSFER_SUMMARY,
  WALLET_A,
  WALLET_B,
} from "./fixtures/sidecar";

function transfer(over: Partial<QuoteData> = {}): QuoteData {
  return {
    orderKind: "transfer",
    amount: 0.001,
    from: "COOK",
    to: "alice.cook",
    expectFrom: COOK_MINT,
    fireTool: "transfer",
    fireArgs: {},
    state: "proposed",
    ...over,
  };
}

/** The ticket a user would be reading when TRADE_SUMMARY comes back. */
function swap(over: Partial<QuoteData> = {}): QuoteData {
  return {
    orderKind: "swap",
    amount: 1,
    from: "bCOOK",
    to: "COOK",
    expectFrom: BCOOK_MINT,
    expectTo: COOK_MINT,
    quotedOut: 1.323123983,
    quotedMinOut: 1.256967783,
    slippageBps: 500,
    fireTool: "trade",
    fireArgs: {},
    state: "proposed",
    ...over,
  };
}

function limit(over: Partial<QuoteData> = {}): QuoteData {
  return {
    orderKind: "limit",
    amount: 5,
    from: "bCOOK",
    to: "COOK",
    expectFrom: BCOOK_MINT,
    expectTo: COOK_MINT,
    fireTool: "place_limit_order",
    fireArgs: { price: 2, kind: "limit" },
    state: "proposed",
    ...over,
  };
}

describe("readSummary (real sidecar shapes)", () => {
  it("reads the nested trade summary", () => {
    expect(readSummary(TRADE_SUMMARY)).toMatchObject({
      absent: false,
      inMint: BCOOK_MINT,
      inSymbol: "bCOOK",
      inAmount: 1,
      outMint: COOK_MINT,
      expectedOut: 1.323123983,
      minOut: 1.256967783,
      slippageBps: 500,
    });
  });
  it("reads the flat transfer summary", () => {
    expect(readSummary(TRANSFER_SUMMARY)).toMatchObject({
      inMint: COOK_MINT,
      inSymbol: "COOK",
      inAmount: 0.001,
      to: WALLET_B,
    });
  });
  it("reads the limit summary including its kind", () => {
    expect(readSummary(LIMIT_SUMMARY)).toMatchObject({
      inMint: BCOOK_MINT,
      outMint: COOK_MINT,
      inAmount: 5,
      orderKind: "limit",
    });
  });
  it("reports an absent summary rather than inventing one", () => {
    expect(readSummary(undefined).absent).toBe(true);
    expect(readSummary(null).absent).toBe(true);
    expect(readSummary("nope").absent).toBe(true);
  });
});

describe("sameRef", () => {
  it("matches symbols case-insensitively, addresses exactly, never cross-type", () => {
    expect(sameRef("COOK", "cook")).toBe(true);
    expect(sameRef(WALLET_A, WALLET_A)).toBe(true);
    expect(sameRef(WALLET_A, "alice.cook")).toBe(false);
    expect(sameRef(WALLET_A, BCOOK_MINT)).toBe(false);
  });
});

describe("guardSummary — swap against the real trade payload", () => {
  it("compares the nested legs instead of silently passing", () => {
    // Regression: the flat-only guard found no amount and no string mints in
    // this payload, so every swap sailed through unchecked.
    const res = guardSummary(TRADE_SUMMARY, swap());
    expect(res).toEqual({ ok: true, checked: true });
  });

  it("refuses when the input mint was swapped underneath the ticket", () => {
    const tampered = { ...TRADE_SUMMARY, input: { ...TRADE_SUMMARY.input, mint: COOK_MINT } };
    const res = guardSummary(tampered, swap());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/input mint/);
  });

  it("refuses when the output mint disagrees", () => {
    const tampered = { ...TRADE_SUMMARY, output: { ...TRADE_SUMMARY.output, mint: BCOOK_MINT } };
    expect(guardSummary(tampered, swap()).ok).toBe(false);
  });

  it("refuses when the amount disagrees", () => {
    const tampered = { ...TRADE_SUMMARY, input: { ...TRADE_SUMMARY.input, amount: "9" } };
    const res = guardSummary(tampered, swap());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/amount/);
  });
});

describe("guardSummary — swap economics", () => {
  it("accepts a fill that moved in the user's favour", () => {
    const better = {
      ...TRADE_SUMMARY,
      output: { ...TRADE_SUMMARY.output, expectedAmount: "1.9", minAmount: "1.8" },
    };
    expect(guardSummary(better, swap()).ok).toBe(true);
  });

  it("tolerates noise inside the drift window", () => {
    const drifted = {
      ...TRADE_SUMMARY,
      output: {
        ...TRADE_SUMMARY.output,
        expectedAmount: String(1.323123983 * (1 - DRIFT_TOLERANCE / 2)),
      },
    };
    expect(guardSummary(drifted, swap()).ok).toBe(true);
  });

  it("refuses a stale ticket once the price moved past the window", () => {
    const moved = {
      ...TRADE_SUMMARY,
      output: { ...TRADE_SUMMARY.output, expectedAmount: "1.1" },
    };
    const res = guardSummary(moved, swap());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/price moved/);
  });

  it("refuses when the guaranteed floor drops below what the ticket promised", () => {
    // The estimate is unchanged, so only the floor check can catch this.
    const loweredFloor = {
      ...TRADE_SUMMARY,
      output: { ...TRADE_SUMMARY.output, minAmount: "0.5" },
    };
    const res = guardSummary(loweredFloor, swap());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/guaranteed minimum/);
  });

  it("refuses when the slippage cap widens beyond the disclosed one", () => {
    const wider = { ...TRADE_SUMMARY, slippageBps: 3000 };
    const res = guardSummary(wider, swap());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/slippage widened/);
  });

  it("does not invent a comparison when the ticket carried no quote", () => {
    const noRef = swap({ quotedOut: undefined, quotedMinOut: undefined, slippageBps: undefined });
    expect(guardSummary({ ...TRADE_SUMMARY, slippageBps: 9999 }, noRef).ok).toBe(true);
  });
});

describe("guardSummary — transfer", () => {
  it("does NOT refuse when the sidecar resolves a name to an address", () => {
    expect(guardSummary(TRANSFER_SUMMARY, transfer())).toEqual({ ok: true, checked: true });
  });
  it("refuses a tampered amount or token for a name transfer", () => {
    expect(guardSummary({ ...TRANSFER_SUMMARY, amount: "9" }, transfer()).ok).toBe(false);
    expect(guardSummary({ ...TRANSFER_SUMMARY, mint: BCOOK_MINT }, transfer()).ok).toBe(false);
  });
  it("enforces address-equality when the order named an address", () => {
    const toAddr = transfer({ to: WALLET_B });
    expect(guardSummary(TRANSFER_SUMMARY, toAddr).ok).toBe(true);
    expect(guardSummary({ ...TRANSFER_SUMMARY, to: WALLET_A }, toAddr).ok).toBe(false);
  });
});

describe("guardSummary — limit orders", () => {
  it("passes the real placement summary", () => {
    expect(guardSummary(LIMIT_SUMMARY, limit()).ok).toBe(true);
  });
  it("refuses a take-profit quietly built as a stop-loss", () => {
    const res = guardSummary({ ...LIMIT_SUMMARY, kind: "stop" }, limit());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/order type/);
  });
  it("refuses a price the ticket never showed", () => {
    const res = guardSummary({ ...LIMIT_SUMMARY, price: "0.5" }, limit());
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/price/);
  });
});

describe("guardSummary — bridge and unsummarised tools", () => {
  it("passes the account-creation leg, which names no amount", () => {
    const bridge: QuoteData = {
      orderKind: "bridge",
      amount: 1,
      from: "COOK",
      to: "solana",
      expectFrom: COOK_MINT,
      fireTool: "bridge",
      fireArgs: {},
      state: "proposed",
    };
    expect(guardSummary(BRIDGE_INTERMEDIATE_SUMMARY, bridge).ok).toBe(true);
  });

  it("reports that nothing was checked when the sidecar sends no summary", () => {
    // stake / unstake return needs_signature with no summary block at all.
    const stake: QuoteData = {
      orderKind: "stake",
      amount: 1,
      from: "COOK",
      to: "bCOOK",
      fireTool: "stake",
      fireArgs: {},
      state: "proposed",
    };
    expect(guardSummary(undefined, stake)).toEqual({ ok: true, checked: false });
  });
});

describe("transferMatches + resolvedDestination", () => {
  it("treats an absent summary as nothing-to-contradict, and says so", () => {
    expect(transferMatches(undefined, { amount: 1, token: "COOK", to: "x" })).toEqual({
      ok: true,
      checked: false,
    });
  });
  it("extracts a resolved address from the summary", () => {
    expect(resolvedDestination(TRANSFER_SUMMARY)).toBe(WALLET_B);
    expect(resolvedDestination({ to: "alice.cook" })).toBeNull();
    expect(resolvedDestination(null)).toBeNull();
  });
});
