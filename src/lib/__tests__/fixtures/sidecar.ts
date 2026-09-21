/**
 * Payloads captured verbatim from a live cookie-mcp 0.5.0 running in
 * external-signer mode against Cookie Chain mainnet.
 *
 * These exist because the first sign-guard was written against an imagined
 * flat summary shape and unit-tested against that same invention, so it
 * passed every test while doing nothing at all on a real swap. Tests that
 * assert on made-up shapes assert nothing. Re-capture with:
 *
 *   COOKIE_SIGNER=external npx -y cookie-mcp --http 8787
 *   curl -s localhost:8787/mcp -H 'content-type: application/json' \
 *     -H 'x-cookie-wallet: <addr>' \
 *     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
 *          "params":{"name":"trade","arguments":{...}}}'
 */

export const COOK_MINT = "So11111111111111111111111111111111111111112";
export const BCOOK_MINT = "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz";
export const WALLET_A = "3A7eMGT2y1XffJYsLuR3RXp4JaQAWRSVXH5hsLHfWEMw";
export const WALLET_B = "EpWfYygki2dwmFDFv8yjTTQgJhbQ13GbhbVe3XCQNUfs";

/** `trade` — note the nested legs and the absent top-level amount. */
export const TRADE_SUMMARY = {
  aggregator: "cookiebox",
  input: { mint: BCOOK_MINT, symbol: "bCOOK", amount: "1" },
  output: {
    mint: COOK_MINT,
    symbol: "COOK",
    expectedAmount: "1.323123983",
    minAmount: "1.256967783",
  },
  slippageBps: 500,
} as const;

/** `transfer` — flat, and `to` is already resolved from any `.cook` name. */
export const TRANSFER_SUMMARY = {
  to: WALLET_B,
  mint: COOK_MINT,
  symbol: "COOK",
  amount: "0.001",
} as const;

/** `place_limit_order` — flat mints, carries `kind`, carries no price. */
export const LIMIT_SUMMARY = {
  kind: "limit",
  inputMint: BCOOK_MINT,
  outputMint: COOK_MINT,
  amount: "5",
  order: "9HfQmy6iVLjo8LakLskeuZUdGCPeK4gMrwo8jWsicEBe",
} as const;

/** `bridge` first leg: creates the far-side token account, names no amount. */
export const BRIDGE_INTERMEDIATE_SUMMARY = {
  creates: "the recipient's SPL COOK token account on Solana",
  recipient: WALLET_A,
  tokenAccount: "6H1geyQbnReNrm6c2ddE7ECvJMfqQDrCgpTM4tvSWH9h",
} as const;

/** `get_quote`, cookiebox, 10 COOK -> bCOOK. */
export const QUOTE_COOKIEBOX = {
  chain: "cookie",
  aggregator: "cookiebox",
  input: { mint: COOK_MINT, symbol: "COOK", amount: "10" },
  output: {
    mint: BCOOK_MINT,
    symbol: "bCOOK",
    expectedOut: "7.495558798",
    outAfterFee: "7.480567681",
    minOut: "7.120780858",
  },
  priceImpactPct: "0.005%",
  aggregatorFee: { bps: 20, amount: "0.014991117" },
  slippageBps: 500,
  route: {
    split: false,
    multiHop: false,
    lowLiquidity: false,
    hops: [
      {
        venue: "cookiebox-clmm",
        poolAddress: "97nzXLgp7stzF55FMuLXMiwmPWEAd9kj2usuHD3aQEjb",
        inAmountRaw: "10000000000",
        outAmountRaw: "7495558798",
      },
    ],
  },
} as const;

/** `get_balance` — note `symbol: null` on unnamed mints and string amounts. */
export const BALANCE = {
  wallet: WALLET_A,
  cook: { amount: "0.007962162", usdValue: 6.218881084028782e-7 },
  tokens: [
    {
      mint: BCOOK_MINT,
      symbol: "bCOOK",
      amount: "13639797.520541906",
      decimals: 9,
      usdValue: 1416.6646283688267,
    },
    {
      mint: "3UZtjFmxvhsGgfQZ1xPFFsv7ipvoCxuc2UFeVAZQf7kk",
      symbol: null,
      amount: "1",
      decimals: 0,
      usdValue: null,
    },
  ],
  totalUsd: 1416.6647048011853,
} as const;

/** `get_limit_orders` for a wallet with nothing resting. */
export const EMPTY_LIMIT_ORDERS = {
  owner: WALLET_A,
  fees: { makerFeeBps: 10, makerStableFeeBps: 3, takerFeeBps: 0, takerStableFeeBps: 0 },
  count: 0,
  orders: [],
} as const;

/** `stake_info` — the numbers that matter sit behind three addresses. */
export const STAKE_INFO = {
  bcookMint: BCOOK_MINT,
  stakePool: "GxbNKNYdtNXQkhDkpHdLDAMX64GxaECgANqdfp6cUGH4",
  program: "GZgs5uREPp6BvDt8eysmhavQPAHBAtjePgV4zfhgd9pH",
  rate: 1.3644492587054786,
  bcookPerCook: 0.7328964368735486,
  tvlCook: "129886260.785838309",
  bcookSupply: "95193177.728769405",
  fees: { depositPct: 0.5, withdrawPct: 2 },
  apyPct: 173.89473666585732,
  links: { pool: "https://cookiescan.io/address/GxbNKNYdtNXQkhDkpHdLDAMX64GxaECgANqdfp6cUGH4" },
} as const;

/** `resolve_domain` for a name nobody has claimed. */
export const DOMAIN_AVAILABLE = {
  name: "sous.cook",
  label: "sous",
  account: "DF7fXkZCZMiCMdr4Uh6Ua9dL5tqcgeByjjKr2MvZz4MX",
  accountUrl: "https://cookiescan.io/address/DF7fXkZCZMiCMdr4Uh6Ua9dL5tqcgeByjjKr2MvZz4MX",
  registered: false,
  owner: null,
  ownerUrl: null,
  isOwnersPrimary: null,
  resolver: null,
  metadata: null,
  createdAt: null,
  price: { tier: "long", priceCook: "15000", priceUsd: 1.5, priceRaw: "15000000000000" },
  forSale: null,
  note: "sous.cook is available — register_domain claims it, or register it at https://book.cookoven.xyz",
} as const;

/**
 * `resolve_domain` for a name listed on the marketplace. `owner` is the
 * escrow program account, NOT a payable wallet — the real counterparty is
 * `forSale.seller`.
 */
export const DOMAIN_LISTED = {
  name: "chef.cook",
  label: "chef",
  account: "CccydEN26AZS9WRCLXcomze4snWuve7TLQZMDobr4wwy",
  registered: true,
  owner: "7rQTSWbk1nMRPve2q3wcS1rT6g2shkXkNDGnZX53zEzR",
  isOwnersPrimary: null,
  resolver: null,
  metadata: null,
  createdAt: "2026-05-04T13:32:51.000Z",
  price: null,
  forSale: {
    priceCook: "5000000",
    priceLamports: "5000000000000000",
    seller: "AmZDfCaqwzqnCiiu3Go91BJGctrKsUBQS4ydR3SAao7i",
    listing: "ENksYVghnQut43txiNAeNbTBnTemMS1S8MUT5nxtpxNw",
    listedAt: "2026-08-10T19:22:38.000Z",
    marketUrl: "https://market.cookoven.xyz",
  },
  note: "chef.cook is FOR SALE at 5000000 COOK — buy_domain claims it. `owner` above is the marketplace escrow account, not a wallet: do not send funds to it, the seller is AmZDfCaqwzqnCiiu3Go91BJGctrKsUBQS4ydR3SAao7i.",
} as const;

/** `chain_health` — no top-level `slot`; the number lives in two places. */
export const CHAIN_HEALTH = {
  healthy: true,
  status: "operational",
  slots: { processed: 26350612, confirmed: 26350612, finalized: 26350580 },
  finalizationLag: 32,
  finalizationStalled: false,
  epoch: 60,
  epochProgressPct: 99.7,
  absoluteSlot: 26350580,
  blockHeight: 25904622,
  version: "4.1.2",
  slotsPerSec: 2.22,
  validatorCount: 4,
  delinquentCount: 0,
  clusterNodeCount: 4,
  rpc: { endpoint: "https://rpc.cookiescan.io", latencyMs: 725 },
} as const;

/** A tool-level failure: HTTP 200, `isError: true`, JSON `{error,hint}` inside. */
export const TOOL_ERROR_ENVELOPE = {
  jsonrpc: "2.0",
  id: "p",
  result: {
    content: [
      {
        type: "text",
        text: '{"error":"no route found for this pair","hint":"the pair may lack liquidity; try a smaller amount or a more liquid token"}',
      },
    ],
    isError: true,
  },
} as const;

/** Wrap a payload the way Streamable HTTP delivers it. */
export function envelopeOf(payload: unknown) {
  return {
    jsonrpc: "2.0",
    id: "p",
    result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
  };
}

/**
 * A real `needs_signature` reply, captured from a live cookie-mcp for
 * `trade` 1 bCOOK -> COOK. This is the payload the browser must decode,
 * hand to the wallet, and re-serialize — the one leg of the money path
 * that no test could reach without it.
 *
 * Note the 64 zero bytes after the leading `01`: one signature slot, unset.
 * The wallet fills it in. Anything that verifies signatures before the
 * wallet has signed will choke on exactly this shape.
 */
export const NEEDS_SIGNATURE_TRADE = {
  status: "needs_signature",
  tool: "trade",
  kind: "transaction",
  what: "trade",
  signer: WALLET_A,
  version: "v0",
  blockhash: "H9XitjGFx1Kp4qpWfwwmQLyBhGPwMbNixaMSHaUNiuki",
  lastValidBlockHeight: 26022811,
  submit: { via: "cookie-rpc" },
  step: "final",
  summary: {
    aggregator: "cookiebox",
    input: { mint: BCOOK_MINT, symbol: "bCOOK", amount: "1" },
    output: {
      mint: COOK_MINT,
      symbol: "COOK",
      expectedAmount: "1.324761814",
      minAmount: "1.258523723",
    },
    slippageBps: 500,
  },
  transactionBase64: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAJECANHQzy5PA0gfW29OntSWn23hecgU8l3cNO0tKvuhQ6xa0TK+naHc9OcJ1cGPd5Z9uq2dnsBob981ubXFm0VqFC9AltVzqZO2Ahp+I2OJVmQFcfWdQdS0iasrYsoLI36eMksJ+e0mlWrTCBpSDqPRPki4LHRihi1ANZMYGKGSGR4Y8cO2IG3ydHESMSivses664Otxe70d9wwBnL45lLi+e7d7Rd9TVtxYDQ8zW4LnTQWaHTfULLLSshlCOhIMB5p0NuQFoc+5SDEi2FviRJKSEIJX1GpigGi+FcSRq7JqTAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAACMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WcxFb83frASkAQKBPgDRfgjgRrrgfc4LJtiWl+JA35KpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAG3fbh12Whk9nL4UbO63msHLSF7V9bN5E6jPWFfv8AqQabiFf+q4GE+2h/Y0YYwDXaxDncGus7VZig8AAAAAABtLF9EfhAJ66blBxGU4LIpmVNT7xl3lxsxHFt83SmLmdvk3RBXq67luQ064hkoVYjHrmTSaVJJwrpnuNXCBaH5NdcEJp2zBFT/LxieeyrKavd+7piHGV9r0qF5vjxw7L1S5aRToOr9bkpnbOh4J8cIh6mMG3ZrhSF7uDbhjJa14kHBwAFAsBcFQAIBgABAAkKCwEBCgIAAmQDAAAAIA0dDPLk8DSB9bb06e1JafbeF5yBTyXdw07S0q+6FDoIAAAAAAAAAEQ3YzQ1RWV38B0fAAAAAAClAAAAAAAAAAbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpCwICDCESIA0dDPLk8DSB9bb06e1JafbeF5yBTyXdw07S0q+6FDoNDg4DAQIEBQkMAAsLDQ8NGPjGnpHhdYfIAMqaOwAAAABLjANLAAAAAAsDAgAAAQkKAgAGDAIAAACzbSgAAAAAAAA=",
} as const;
