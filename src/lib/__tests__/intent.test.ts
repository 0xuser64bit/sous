import { describe, expect, it } from "vitest";
import { parseIntent, isTemplateOrder, EXAMPLE_ORDERS } from "../intent";

describe("parseIntent", () => {
  it("parses arrow swaps with verbs", () => {
    expect(parseIntent("Quote 10 COOK → bCOOK")).toEqual({
      kind: "swap",
      amount: 10,
      from: "COOK",
      to: "BCOOK",
    });
    expect(parseIntent("swap 5 cook for usdc")).toEqual({
      kind: "swap",
      amount: 5,
      from: "COOK",
      to: "USDC",
    });
    expect(parseIntent("Swap 1.5 COOK -> USDC")).toEqual({
      kind: "swap",
      amount: 1.5,
      from: "COOK",
      to: "USDC",
    });
  });

  it("parses buy/sell shorthand with no arrow", () => {
    expect(parseIntent("buy 10 bCOOK")).toEqual({
      kind: "swap",
      amount: 10,
      from: "COOK",
      to: "BCOOK",
    });
    expect(parseIntent("sell 5 COOK")).toEqual({
      kind: "swap",
      amount: 5,
      from: "COOK",
      to: "COOK",
    });
  });

  it("rejects non-positive or missing amounts", () => {
    expect(parseIntent("swap 0 COOK -> USDC").kind).toBe("unknown");
    expect(parseIntent("hello chef").kind).toBe("unknown");
    expect(parseIntent("").kind).toBe("unknown");
  });

  it("parses transfers to addresses and .cook names", () => {
    expect(
      parseIntent("send 2 COOK to alice.cook"),
    ).toMatchObject({ kind: "transfer", amount: 2, token: "COOK", to: "alice.cook" });
    expect(
      parseIntent("transfer 1.5 USDC → 7xKXtg2CW87d97TXJSD"),
    ).toMatchObject({ kind: "transfer", amount: 1.5, token: "USDC" });
  });

  it("parses stake / unstake / stake_info", () => {
    expect(parseIntent("stake 10")).toEqual({ kind: "stake", amount: 10 });
    expect(parseIntent("unstake 5")).toEqual({ kind: "unstake", amount: 5 });
    expect(parseIntent("what is the staking APY?").kind).toBe("stake_info");
    expect(parseIntent("stake").kind).toBe("stake_info");
  });

  it("parses limit orders, listing, and cancel", () => {
    expect(parseIntent("limit buy 5 COOK -> USDC at 0.5")).toEqual({
      kind: "limit",
      amount: 5,
      from: "COOK",
      to: "USDC",
      price: 0.5,
      orderKind: "limit",
    });
    expect(parseIntent("stop sell 5 bCOOK -> COOK at 1.1")).toMatchObject({
      kind: "limit",
      orderKind: "stop",
    });
    expect(parseIntent("stop 5 bCOOK -> COOK at 1.1")).toMatchObject({
      kind: "limit",
      orderKind: "stop",
    });
    expect(parseIntent("show my open orders").kind).toBe("orders");
    expect(parseIntent("cancel order abc123")).toEqual({
      kind: "cancel",
      orderId: "abc123",
    });
    expect(parseIntent("cancel my order").kind).toBe("unknown");
  });

  it("parses bridge, resolve, search, balance, help", () => {
    expect(parseIntent("bridge 5 COOK to solana")).toEqual({
      kind: "bridge",
      amount: 5,
      token: "COOK",
      toChain: "solana",
    });
    expect(parseIntent("resolve alice.cook")).toEqual({
      kind: "resolve",
      name: "alice.cook",
    });
    expect(parseIntent("search COOK")).toEqual({
      kind: "search",
      query: "COOK",
    });
    expect(parseIntent("What is my balance?").kind).toBe("balance");
    expect(parseIntent("help").kind).toBe("help");
  });
});

describe("isTemplateOrder", () => {
  it("keeps examples that name a counterparty or price off the fire path", () => {
    // alice.cook is not registered and 2.0 is nobody's price: tapping these
    // should load the composer, not post a ticket addressed to a comment.
    expect(isTemplateOrder("Send 2 COOK to alice.cook")).toBe(true);
    expect(isTemplateOrder("Limit sell 5 bCOOK → COOK at 2.0")).toBe(true);
    expect(isTemplateOrder("Bridge 5 COOK to solana")).toBe(true);
  });
  it("lets quotes and reads run on tap", () => {
    expect(isTemplateOrder("Quote 10 COOK → bCOOK")).toBe(false);
    expect(isTemplateOrder("What is my balance?")).toBe(false);
  });
  it("classifies every shipped example", () => {
    for (const ex of EXAMPLE_ORDERS) {
      expect(parseIntent(ex).kind).not.toBe("unknown");
    }
  });
});
