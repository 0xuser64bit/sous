/**
 * The figures every illustrated ticket on the landing page uses.
 *
 * Taken from a real `get_quote` against Cookie Chain mainnet (10 COOK →
 * bCOOK, both aggregators, 2026-09-21). The previous illustrations showed
 * 10 COOK buying 9.982 bCOOK — a rate near 1:1 that has never existed on
 * this chain; the live rate is about 0.75 bCOOK per COOK because bCOOK
 * accrues staking yield against COOK. Marketing that invents a rate is
 * marketing about a different product.
 *
 * One source so the hero, the how-it-works exhibit and the demo theater
 * cannot drift from each other, and so refreshing them is one edit.
 * Illustrative, not live: the theater is labelled a simulated preview.
 */
export const SAMPLE_TICKET = {
  amount: "10 COOK",
  from: "COOK",
  to: "bCOOK",
  /** Net of the aggregator's cut — what actually lands. */
  receive: "7.480567 bCOOK",
  /** The floor the transaction enforces at the quoted slippage cap. */
  minOut: "7.120780 bCOOK · 5% slippage",
  venue: "cookiebox · cookiebox-clmm",
  alsoQuoted: "cookiescan 7.480567",
  impact: "0.005%",
  /** 20 bps, taken out of the output token. */
  venueFee: "0.014991 bCOOK · 0.2%",
  ticketNo: "004",
  clock: "14:32",
} as const;
