/**
 * Single source of truth for Cookie Chain network constants.
 * Sources: https://docs.cookiechain.wtf/developer-guide
 *          https://docs.cookiechain.wtf/ecosystem
 */

export const COOKIE_RPC_URL =
  process.env.NEXT_PUBLIC_COOKIE_RPC_URL ?? "https://rpc.cookiescan.io";

/**
 * Websocket endpoint. Defaults to the RPC host with a wss:// scheme
 * (the conventional Solana layout) rather than the explorer domain —
 * `wss://cookiescan.io` serves the explorer HTML, not a JSON-RPC socket.
 */
export const COOKIE_WSS_URL =
  process.env.NEXT_PUBLIC_COOKIE_WSS_URL ??
  COOKIE_RPC_URL.replace(/^http/, "ws");

export const COOKIESCAN_BASE =
  process.env.NEXT_PUBLIC_COOKIESCAN_BASE ?? "https://cookiescan.io";

export const DAS_API_BASE =
  process.env.NEXT_PUBLIC_DAS_API_BASE ?? "https://api.cookiescan.io";

export const COOKIEBOX_AGG =
  process.env.NEXT_PUBLIC_COOKIEBOX_AGG ?? "https://agg.cookiebox.app";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Sous";
export const APP_TAGLINE = "Your sous-chef for Cookie Chain";

/** Native COOK mint (wrapped form used by SDKs). Same string as wSOL on Solana — resolve per-chain! */
export const NATIVE_COOK_MINT =
  "So11111111111111111111111111111111111111112";

/** Bridged SPL COOK on Solana mainnet */
export const SOLANA_COOK_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

/** Genesis-embedded programs (authoritative list: https://cookiescan.io/programs) */
export const ECOSYSTEM_PROGRAMS = {
  splToken: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  token2022: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  associatedToken: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  tokenMetadata: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
  raydiumAmmV4: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  raydiumClmm: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  orcaWhirlpool: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  jupiterV6: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  openBookV1: "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
  candyMachineV2: "cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ",
  candyMachineV3: "CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR",
  bubblegum: "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY",
  splGovernance: "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
  memoV1: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  squadsV4: "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
  nameService: "namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX",
  auctionHouse: "hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk",
  cookieboxDbc: "DBCg4ugDEztk6MbqHEJvx5a5YGJTj45Jb5NvtQ48Rvsf",
  cookieboxDammV2: "DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY",
  cookieboxClmm: "CLMMmWqTtyNSomqXP3kETJy2SGKPdr31USsm4GfbLyKs",
} as const;

export const CHAIN_META = {
  name: "Cookie Chain",
  kind: "SVM (Solana-compatible)",
  finality: "~1s",
  avgFeeCook: "0.000005",
  nativeSymbol: "COOK",
  decimals: 9,
} as const;
