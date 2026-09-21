/**
 * Single source of truth for Cookie Chain network constants.
 * Sources: https://docs.cookiechain.wtf/developer-guide
 *          https://docs.cookiechain.wtf/ecosystem
 *
 * Everything here is read by something. A constant nobody reads is not a
 * source of truth, it is a claim that rots — the authoritative program list
 * lives at https://cookiescan.io/programs, and the sidecar resolves the
 * programs it needs itself.
 */

export const COOKIE_RPC_URL = cleanHttpEnv(
  process.env.NEXT_PUBLIC_COOKIE_RPC_URL,
  "https://rpc.cookiescan.io",
);

/**
 * Websocket endpoint. Defaults to the RPC host with a wss:// scheme
 * (the conventional Solana layout) rather than the explorer domain —
 * `wss://cookiescan.io` serves the explorer HTML, not a JSON-RPC socket.
 *
 * Nothing subscribes today: confirmations poll over HTTP precisely because
 * this socket is not guaranteed. It is configured so that anything which
 * later does subscribe cannot silently pick the wrong host.
 */
export const COOKIE_WSS_URL =
  cleanWsEnv(
    process.env.NEXT_PUBLIC_COOKIE_WSS_URL,
    COOKIE_RPC_URL.replace(/^http/, "ws"),
  );

export const COOKIESCAN_BASE = cleanHttpEnv(
  process.env.NEXT_PUBLIC_COOKIESCAN_BASE,
  "https://cookiescan.io",
);

/**
 * Empty-string env vars are real on Vercel (a variable added without a
 * value) and `??` does not catch them — `""` sailed through and `new
 * Connection("")` killed the static prerender of `/` with
 * "Endpoint URL must start with http: or https:". Trim and fall back.
 */
function cleanHttpEnv(raw: string | undefined, fallback: string): string {
  const v = (raw ?? "").trim();
  return /^https?:\/\/.+/.test(v) ? v : fallback;
}

function cleanWsEnv(raw: string | undefined, fallback: string): string {
  const v = (raw ?? "").trim();
  return /^(wss?|https?):\/\/.+/.test(v) ? v : fallback;
}

export const APP_TAGLINE = "Your sous-chef for Cookie Chain";

/** Native COOK mint (wrapped form used by SDKs). Same string as wSOL on Solana — resolve per-chain! */
export const NATIVE_COOK_MINT =
  "So11111111111111111111111111111111111111112";

/** bCOOK, the Cookiebox liquid-staking receipt. Verified against stake_info. */
export const BCOOK_MINT = "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz";

export const CHAIN_META = {
  name: "Cookie Chain",
  kind: "SVM (Solana-compatible)",
  finality: "~1s",
  avgFeeCook: "0.000005",
  nativeSymbol: "COOK",
  decimals: 9,
} as const;
