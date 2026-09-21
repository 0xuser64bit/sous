import { describe, expect, it, vi, afterEach } from "vitest";
import { fundsPreflight, buildStakeTicket, buildUnstakeTicket } from "../pass/tickets";
import { BALANCE } from "./fixtures/sidecar";

/**
 * An unfunded wallet fails fire-time simulation with the sidecar's
 * "Swap simulation failed.\nAccountNotFound" + "check the inputs; if it
 * persists the service may be degraded" — which blames the inputs and the
 * service for an empty pantry. These assert the warning lands on the ticket
 * first, while the wallet is still closed.
 */

/** Real payload shape: an account that has never been funded. */
const EMPTY = { wallet: "11111111111111111111111111111112", cook: { amount: "0" }, tokens: [], totalUsd: 0 };

function envelope(payload: unknown) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "x",
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const COOK = { mint: "So11111111111111111111111111111111111111112", symbol: "COOK", native: true };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fundsPreflight", () => {
  it("warns before the wallet opens when the pantry is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => envelope(EMPTY)));
    const warning = await fundsPreflight(COOK, 10, "11111111111111111111111111111112");
    expect(warning).toMatch(/0 COOK/);
    expect(warning).toMatch(/10/);
  });

  it("stays silent when the balance covers the order", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => envelope(BALANCE)));
    expect(await fundsPreflight({ ...COOK, symbol: "bCOOK", native: false }, 5, "w")).toBeNull();
  });

  it("warns when the whole balance would go, leaving nothing for fees", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => envelope(BALANCE)));
    // BALANCE holds 0.007962162 COOK; firing all of it strands the account.
    expect(await fundsPreflight(COOK, 0.007962162, "w")).toMatch(/nothing stays for fees/i);
  });

  it("says nothing without a wallet — browsing is free", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fundsPreflight(COOK, 10, undefined)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("tickets declare what they spend", () => {
  // The funds check only runs for tickets carrying `preflight`; a builder that
  // forgets it silently loses the warning, which is how swaps went uncovered.
  it("stake spends COOK, unstake spends bCOOK", () => {
    const stake = buildStakeTicket({ kind: "stake", amount: 5 } as never);
    const unstake = buildUnstakeTicket({ kind: "unstake", amount: 5 } as never);
    expect(stake.kind === "ticket" && stake.preflight?.symbol).toBe("COOK");
    expect(unstake.kind === "ticket" && unstake.preflight?.symbol).toBe("bCOOK");
  });
});
