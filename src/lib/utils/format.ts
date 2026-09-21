export function shortAddr(addr: string, n = 4): string {
  if (!addr || addr.length < n * 2 + 3) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

/** Base58 address-shaped (32–44 chars, no 0/O/I/l). Used to linkify values. */
export function isAddressLike(v: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim());
}

export function fmtCook(lamportsLike: number | string, decimals = 9): string {
  const n = Number(lamportsLike) / 10 ** decimals;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Compact human number: 1_234_567 -> "1.23M". Never throws. */
export function fmtNum(v: unknown, digits = 2): string {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(digits)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** "14:32" local time for ticket headers. */
export function fmtClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Trim a token amount string to at most `dp` decimals for display, truncating
 * toward zero so we never overstate what the user receives. Keeps the exact
 * value everywhere else — this is display-only.
 */
export function trimAmount(v: string | number | undefined | null, dp = 6): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return typeof v === "string" ? v : "—";
  const factor = 10 ** dp;
  const truncated = Math.trunc(n * factor) / factor;
  return truncated.toLocaleString("en-US", { maximumFractionDigits: dp });
}

/**
 * A dollar figure. Money reads in cents, not in whatever precision the
 * source happened to carry — the pool board was printing "$1,220.0376"
 * beside "$1,218.8105", four digits of noise on a difference nobody acts on.
 * Large values compact so a busy pool does not blow out a narrow column.
 */
export function fmtUsd(v: unknown): string {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${fmtNum(n, 2)}`;
  if (abs > 0 && abs < 0.01) return "<$0.01";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A token balance, readable in a narrow column without lying about it.
 *
 * Amounts arrive as full-precision strings ("13639797.520541906") and a
 * fixed decimal cap is wrong at both ends: four decimals erases a dust
 * balance, nine turn a large one into noise. So the cap follows the
 * magnitude — a number at or above 1 keeps four decimals, a number below it
 * keeps every one it has, because there the decimals *are* the balance.
 * Trailing zeros are dropped either way.
 */
export function fmtBalance(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
  if (!Number.isFinite(n)) return typeof v === "string" ? v : "—";
  if (n === 0) return "0";
  const digits = Math.abs(n) >= 1 ? 4 : 9;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Basis points as a percentage: 500 -> "5%", 10 -> "0.1%". */
export function bpsLabel(bps: number): string {
  if (!Number.isFinite(bps)) return "—";
  const pct = bps / 100;
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** Parse a sidecar numeric string, or undefined when it is not a number. */
export function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Best-effort pick of the first usable key (case-insensitive).
 *
 * `null` counts as absent and falls through to the next candidate. The
 * sidecar uses explicit nulls for "no value" all over its payloads —
 * `get_balance` sends `symbol: null` for unnamed mints, `resolve_domain`
 * sends `owner: null` for an unclaimed name — and treating those as present
 * stops the fallback chain dead on the one key that has nothing in it.
 */
export function pickKey(
  data: Record<string, unknown>,
  names: string[],
): unknown {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) lower[k.toLowerCase()] = v;
  for (const n of names) {
    const v = lower[n.toLowerCase()];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
