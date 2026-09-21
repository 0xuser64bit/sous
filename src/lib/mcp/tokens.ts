import { callMcp } from "./client";
import { unwrapMcp } from "./shapes";
import { pickKey, isAddressLike, shortAddr } from "@/lib/utils/format";
import { BCOOK_MINT, NATIVE_COOK_MINT } from "@/lib/chain/config";

export type TokenMeta = {
  /** Resolved mint address (or NATIVE_COOK_MINT for native COOK). */
  mint: string;
  /** Canonical symbol for display. */
  symbol: string;
  /** True when this is native COOK (transfer omits `mint` for it). */
  native: boolean;
};

/** Verified against the live sidecar — skip search for these. */
const WELL_KNOWN: Record<string, TokenMeta> = {
  COOK: { mint: NATIVE_COOK_MINT, symbol: "COOK", native: true },
  WCOOK: { mint: NATIVE_COOK_MINT, symbol: "wCOOK", native: true },
  BCOOK: { mint: BCOOK_MINT, symbol: "bCOOK", native: false },
};

const mintCache = new Map<string, TokenMeta>();

type SearchHit = {
  mint?: unknown;
  symbol?: unknown;
  name?: unknown;
  liquidityCook?: unknown;
  holderCount?: unknown;
};

/** "MON 6H7xnY…momo (149 COOK liq, 24 holders)" — enough to tell two apart. */
function describe(h: SearchHit): string {
  const mint = String(h.mint);
  const sym = typeof h.symbol === "string" && h.symbol ? h.symbol : "—";
  const bits: string[] = [];
  const liq = Number(h.liquidityCook);
  if (Number.isFinite(liq)) bits.push(`${Math.round(liq)} COOK liq`);
  const holders = Number(h.holderCount);
  if (Number.isFinite(holders)) bits.push(`${holders} holders`);
  const detail = bits.length ? ` (${bits.join(", ")})` : "";
  return `${sym} ${shortAddr(mint, 6)}${detail}`;
}

/**
 * Resolve a user-typed token (symbol or raw mint) to a mint via the sidecar
 * registry.
 *
 * Tickers are not unique on-chain and imitating a real one is the cheapest
 * attack there is — Cookie Chain currently carries two different mints
 * answering to `MON`, one with liquidity and one without. So this refuses
 * rather than ranks: an exact, single match or nothing. Fuzzy discovery
 * belongs in the `search` intent, which is a read; this function only ever
 * runs on a path that ends in a signature.
 */
export async function resolveMint(
  input: string,
  wallet?: string,
): Promise<TokenMeta> {
  const raw = input.trim();
  if (!raw) throw new Error("Empty token.");
  if (isAddressLike(raw)) {
    // The native mint pasted as an address is still native: `transfer` omits
    // `mint` for it and only native COOK can ride the bridge.
    const native = raw === NATIVE_COOK_MINT;
    return {
      mint: raw,
      symbol: native ? "COOK" : shortAddr(raw, 4),
      native,
    };
  }
  const key = raw.toUpperCase();
  const known = WELL_KNOWN[key] ?? mintCache.get(key);
  if (known) return known;

  const res = await callMcp({ tool: "search_tokens", wallet, args: { query: raw } });
  const payload = unwrapMcp(res);
  const list = Array.isArray(payload)
    ? payload
    : (pickKey(payload as Record<string, unknown>, ["results", "tokens", "data"]) as unknown);
  const hits = (Array.isArray(list) ? (list as SearchHit[]) : []).filter(
    (h) => h && typeof h === "object" && typeof h.mint === "string",
  );
  if (!hits.length) {
    throw new Error(`No token found for “${raw}” — check the ticker, Chef.`);
  }

  const exact = hits.filter((h) => String(h.symbol ?? "").toUpperCase() === key);

  if (exact.length > 1) {
    throw new Error(
      `“${raw}” is not one token — ${exact.length} mints use that ticker: ${exact
        .slice(0, 3)
        .map(describe)
        .join(" · ")}. Order by mint address so there is no doubt.`,
    );
  }
  if (!exact.length) {
    // Two mints can share a near-miss ticker too: "closest: COOKHOUSE,
    // COOKHOUSE" is not a suggestion, it is a riddle. Describe each one.
    const near = hits.slice(0, 3).map(describe).join(" · ");
    throw new Error(
      `No token has the exact ticker “${raw}”${near ? ` — closest: ${near}` : ""}. Use the exact ticker or a mint address.`,
    );
  }

  const pick = exact[0];
  const meta: TokenMeta = {
    mint: String(pick.mint),
    symbol: String(pick.symbol ?? raw.toUpperCase()),
    native: String(pick.mint) === NATIVE_COOK_MINT,
  };
  mintCache.set(key, meta);
  return meta;
}
