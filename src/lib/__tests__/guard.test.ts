import { describe, expect, it } from "vitest";
import {
  guardSummary,
  transferMatches,
  sameRef,
  resolvedDestination,
} from "../tx/guard";
import type { QuoteData } from "../store/usePilotStore";

const ADDR = "7rQTSWbk1nMRPve2q3wcS1rT6g2shkXkNDGnZX53zEzR";
const OTHER = "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz";

function transfer(over: Partial<QuoteData> = {}): QuoteData {
  return {
    orderKind: "transfer",
    amount: 2,
    from: "COOK",
    to: "alice.cook",
    fireTool: "transfer",
    fireArgs: {},
    state: "proposed",
    ...over,
  };
}

describe("sameRef", () => {
  it("matches symbols case-insensitively, addresses exactly, never cross-type", () => {
    expect(sameRef("COOK", "cook")).toBe(true);
    expect(sameRef(ADDR, ADDR)).toBe(true);
    expect(sameRef(ADDR, "alice.cook")).toBe(false); // address vs name — cannot equate
    expect(sameRef(ADDR, OTHER)).toBe(false);
  });
});

describe("guardSummary transfer to .cook name", () => {
  it("does NOT refuse when the sidecar resolves a name to an address", () => {
    // Regression B4: 'Send 2 COOK to alice.cook' was always refused because the
    // guard compared the resolved address to the typed name.
    const summary = { amount: "2", symbol: "COOK", to: ADDR };
    expect(guardSummary(summary, transfer()).ok).toBe(true);
  });
  it("still refuses a tampered amount or token for a name transfer", () => {
    expect(guardSummary({ amount: "9", symbol: "COOK", to: ADDR }, transfer()).ok).toBe(false);
    expect(guardSummary({ amount: "2", symbol: "USDC", to: ADDR }, transfer()).ok).toBe(false);
  });
  it("still enforces address-equality when the order named an address", () => {
    const toAddr = transfer({ to: ADDR });
    expect(guardSummary({ amount: "2", symbol: "COOK", to: ADDR }, toAddr).ok).toBe(true);
    // A swapped destination address must be refused.
    expect(guardSummary({ amount: "2", symbol: "COOK", to: OTHER }, toAddr).ok).toBe(false);
  });
});

describe("guardSummary swap (mints, not symbols)", () => {
  const swap: QuoteData = {
    orderKind: "swap",
    amount: 10,
    from: "COOK",
    to: "bCOOK",
    expectFrom: "So11111111111111111111111111111111111111112",
    expectTo: OTHER,
    fireTool: "trade",
    fireArgs: {},
    state: "proposed",
  };
  it("passes when summary mints match the resolved expectations", () => {
    expect(
      guardSummary(
        { inputMint: "So11111111111111111111111111111111111111112", outputMint: OTHER, amount: "10" },
        swap,
      ).ok,
    ).toBe(true);
  });
  it("refuses when the output mint disagrees", () => {
    expect(
      guardSummary(
        { inputMint: "So11111111111111111111111111111111111111112", outputMint: ADDR, amount: "10" },
        swap,
      ).ok,
    ).toBe(false);
  });
});

describe("transferMatches + resolvedDestination", () => {
  it("treats an absent summary as nothing-to-contradict", () => {
    expect(transferMatches(undefined, { amount: 1, token: "COOK", to: "x" }).ok).toBe(true);
  });
  it("extracts a resolved address from the summary", () => {
    expect(resolvedDestination({ to: ADDR })).toBe(ADDR);
    expect(resolvedDestination({ to: "alice.cook" })).toBeNull();
    expect(resolvedDestination(null)).toBeNull();
  });
});
