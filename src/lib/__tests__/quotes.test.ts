import { describe, expect, it, vi, afterEach } from "vitest";
import { extractQuoteFields, quoteBoth } from "../mcp/quotes";
import { resolveMint } from "../mcp/tokens";

/** Captured live from cookie-mcp (10 COOK -> bCOOK, cookiebox). */
const COOKIEBOX_QUOTE = {
  chain: "cookie",
  aggregator: "cookiebox",
  input: { mint: "So11111111111111111111111111111111111111112", symbol: "COOK", amount: "10" },
  output: {
    mint: "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz",
    symbol: "bCOOK",
    expectedOut: "7.519320609",
    outAfterFee: "7.511801289",
    minOut: "7.143354578",
  },
  priceImpactPct: "0.000%",
  aggregatorFee: { bps: 10, amount: "0.00751932" },
  slippageBps: 500,
  route: {
    split: false,
    multiHop: false,
    lowLiquidity: false,
    hops: [
      {
        venue: "cookiebox-damm",
        poolAddress: "GHfzn5A59d3uKUz2UrR8mQsA612ZyhTjPhTxNcdAiSUx",
        inAmountRaw: "10000000000",
        outAmountRaw: "7519320609",
      },
    ],
  },
};

const CANDYSHOP_QUOTE = {
  ...COOKIEBOX_QUOTE,
  aggregator: "cookiescan",
  output: { ...COOKIEBOX_QUOTE.output, expectedOut: "7.519326655", outAfterFee: "7.504288001" },
};

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractQuoteFields", () => {
  it("reads the real nested quote shape", () => {
    expect(extractQuoteFields(COOKIEBOX_QUOTE)).toMatchObject({
      out: "7.511801289",
      venue: "cookiebox-damm",
      impact: "0.000%",
      aggregator: "cookiebox",
    });
  });
  it("falls back to flat shapes and strings", () => {
    expect(extractQuoteFields({ outAmount: "5", venue: "x" })).toMatchObject({
      out: "5",
      venue: "x",
    });
    expect(extractQuoteFields("hello").out).toBe("hello");
    expect(extractQuoteFields(null)).toEqual({});
  });
});

describe("quoteBoth economics", () => {
  it("carries the floor, the venue's cut, and the slippage cap onto the view", async () => {
    // These three are what a trader needs before signing and what the
    // sign-guard later compares against; dropping them made the ticket read
    // like a promise when it was an estimate.
    vi.stubGlobal("fetch", vi.fn(async () => envelope(COOKIEBOX_QUOTE)));
    const { best } = await quoteBoth({ inputMint: "a", outputMint: "b", amount: 10 });
    expect(best.out).toBe("7.511801289"); // net of the aggregator fee
    expect(best.grossOut).toBe("7.519320609");
    expect(best.minOut).toBe("7.143354578");
    expect(best.feeAmount).toBe("0.00751932");
    expect(best.feeBps).toBe(10);
    expect(best.slippageBps).toBe(500);
  });

  it("ranks venues on the net payout, not the gross estimate", async () => {
    // A venue can advertise a bigger expectedOut and still pay less after
    // its own fee. Ranking on gross would pick the worse fill.
    const generousGross = {
      ...COOKIEBOX_QUOTE,
      aggregator: "cookiescan",
      output: { ...COOKIEBOX_QUOTE.output, expectedOut: "99", outAfterFee: "1" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: unknown) => {
        const body = JSON.parse(String((init as { body: string }).body));
        return envelope(body.args.aggregator === "cookiebox" ? COOKIEBOX_QUOTE : generousGross);
      }),
    );
    const { best } = await quoteBoth({ inputMint: "a", outputMint: "b", amount: 10 });
    expect(best.aggregator).toBe("cookiebox");
  });
});

describe("quoteBoth", () => {
  it("picks the better venue and keeps the loser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: unknown) => {
        const body = JSON.parse(String((init as { body: string }).body));
        const agg = body.args.aggregator;
        return envelope(agg === "cookiebox" ? COOKIEBOX_QUOTE : CANDYSHOP_QUOTE);
      }),
    );
    const { best, alt } = await quoteBoth({
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz",
      amount: 10,
    });
    expect(best.aggregator).toBe("cookiebox");
    expect(best.out).toBe("7.511801289");
    expect(alt?.aggregator).toBe("cookiescan");
  });

  it("survives one dead venue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: unknown) => {
        const body = JSON.parse(String((init as { body: string }).body));
        if (body.args.aggregator === "cookiebox") {
          return new Response("boom", { status: 502 });
        }
        return envelope(CANDYSHOP_QUOTE);
      }),
    );
    const { best, alt } = await quoteBoth({
      inputMint: "a",
      outputMint: "b",
      amount: 1,
    });
    expect(best.aggregator).toBe("cookiescan");
    expect(alt).toBeUndefined();
  });

  it("throws when neither venue quotes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
    await expect(
      quoteBoth({ inputMint: "a", outputMint: "b", amount: 1 }),
    ).rejects.toThrow("No venue would quote");
  });
});

describe("resolveMint", () => {
  it("short-circuits well-known tokens and raw mints", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await resolveMint("cook")).mint).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect((await resolveMint("bcook")).symbol).toBe("bCOOK");
    expect(
      (await resolveMint("EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz")).mint,
    ).toBe("EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves via search and refuses ambiguity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        envelope({
          results: [
            { symbol: "FOO", mint: "11111111111111111111111111111111" },
            { symbol: "FOOBAR", mint: "22222222222222222222222222222222" },
          ],
        }),
      ),
    );
    expect((await resolveMint("foo")).mint).toBe("11111111111111111111111111111111");
    await expect(resolveMint("ba")).rejects.toThrow("ambiguous");
  });
});
