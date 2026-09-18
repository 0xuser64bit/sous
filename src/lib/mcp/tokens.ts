import { callMcp } from "./client";
import { unwrapMcp, str } from "./shapes";
import { pickKey, isAddressLike } from "@/lib/utils/format";
import { NATIVE_COOK_MINT } from "@/lib/chain/config";

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
  BCOOK: {
    mint: "EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz",
    symbol: "bCOOK",
    native: false,
  },
};

const mintCache = new Map<string, TokenMeta>();

type SearchHit = {
  mint?: unknown;
  symbol?: unknown;
  name?: unknown;
  liquidityCook?: unknown;
};

/**
 * Resolve a user-typed token (symbol, name, or raw mint) to a mint via
 * the sidecar registry. Symbols must match exactly (case-insensitive);
 * anything ambiguous throws with the candidates instead of guessing —
 * the pass never guesses with money.
 */
export async function resolveMint(
  input: string,
  wallet?: string,
): Promise<TokenMeta> {
  const raw = input.trim();
  if (!raw) throw new Error("Empty token.");
  if (isAddressLike(raw)) {
    return { mint: raw, symbol: raw.slice(0, 4) + "…" + raw.slice(-4), native: false };
  }
  const key = raw.toUpperCase();
  const known = WELL_KNOWN[key] ?? mintCache.get(key);
  if (known) return known;

  const res = await callMcp({ tool: "search_tokens", wallet, args: { query: raw } });
  const payload = unwrapMcp(res);
  const list = Array.isArray(payload)
    ? payload
    : (pickKey(payload as Record<string, unknown>, ["results", "tokens", "data"]) as unknown);
  if (!Array.isArray(list) || !list.length) {
    throw new Error(`No token found for “${raw}” — check the ticker, Chef.`);
  }
  const hits = (list as SearchHit[]).filter(
    (h) => h && typeof h === "object" && typeof h.mint === "string",
  );
  const exact = hits.filter(
    (h) =>
      String(h.symbol ?? "").toUpperCase() === key ||
      String(h.name ?? "").toUpperCase() === key,
  );
  const pick = (exact.length ? exact : hits)[0];
  if (!pick) throw new Error(`No token found for “${raw}”.`);
  if (!exact.length && hits.length > 1) {
    const names = hits
      .slice(0, 3)
      .map((h) => String(h.symbol ?? h.mint))
      .join(", ");
    throw new Error(`“${raw}” is ambiguous (${names}) — use an exact ticker or mint.`);
  }
  const meta: TokenMeta = {
    mint: String(pick.mint),
    symbol: String(pick.symbol ?? raw.toUpperCase()),
    native: false,
  };
  mintCache.set(key, meta);
  return meta;
}

/** One-line candidate list for error messages. */
export function candidatesOf(payload: unknown, max = 3): string {
  const list = Array.isArray(payload) ? payload : [];
  return list
    .slice(0, max)
    .map((h) => str(pickKey((h ?? {}) as Record<string, unknown>, ["symbol", "mint"])))
    .join(", ");
}
