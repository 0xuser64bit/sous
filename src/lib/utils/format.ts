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

/** Best-effort pick of the first present key (case-insensitive). */
export function pickKey(
  data: Record<string, unknown>,
  names: string[],
): unknown {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) lower[k.toLowerCase()] = v;
  for (const n of names) {
    if (lower[n.toLowerCase()] !== undefined) return lower[n.toLowerCase()];
  }
  return undefined;
}
