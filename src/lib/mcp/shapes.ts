import { fmtNum, pickKey } from "@/lib/utils/format";

/**
 * MCP responses arrive in different envelopes depending on transport
 * (Streamable HTTP wraps tool results in { result: { content: [...] } }).
 * Unwrap tolerantly; callers only ever see the payload.
 */
export function unwrapMcp(v: unknown): unknown {
  let cur = v;
  for (let i = 0; i < 5; i++) {
    if (cur && typeof cur === "object" && !Array.isArray(cur)) {
      const o = cur as Record<string, unknown>;
      if (o.status === "needs_signature") return cur;
      if (o.result !== undefined && typeof o.result === "object" && o.result !== null) {
        cur = o.result;
        continue;
      }
      if (Array.isArray(o.content)) {
        const texts = (o.content as { text?: unknown }[])
          .map((c) => c?.text)
          .filter((t): t is string => typeof t === "string");
        if (texts.length === 1) {
          try {
            return JSON.parse(texts[0]);
          } catch {
            return texts[0];
          }
        }
        if (texts.length > 1) return texts.join("\n");
        return o.content;
      }
      if (typeof o.text === "string" && Object.keys(o).length <= 2) {
        try {
          return JSON.parse(o.text);
        } catch {
          return o.text;
        }
      }
      return cur;
    }
    return cur;
  }
  return cur;
}

/**
 * Detect a tool- or protocol-level error in a raw JSON-RPC MCP response.
 * cookie-mcp returns tool failures as HTTP 200 with
 * `{ result: { content:[...], isError:true } }` — without this, a refused
 * write (failed simulation, bad input) would sail past `isNeedsSignature`
 * and be reported to the user as "Served". Returns a human message, or
 * null when the response is a normal result.
 */
export function mcpErrorMessage(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const rpcErr = o.error;
  if (rpcErr && typeof rpcErr === "object") {
    const m = (rpcErr as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  if (typeof rpcErr === "string") return rpcErr;
  const result = o.result;
  if (
    result &&
    typeof result === "object" &&
    (result as Record<string, unknown>).isError === true
  ) {
    return errorTextOf(unwrapMcp(raw));
  }
  return null;
}

function errorTextOf(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const err = p.error ?? p.message;
    const hint = p.hint;
    const base =
      typeof err === "string" ? err : JSON.stringify(err ?? payload).slice(0, 200);
    return typeof hint === "string" ? `${base} — ${hint}` : base;
  }
  return "Tool call failed.";
}

/** Short human rendering of a scalar-ish value. */
export function str(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    return v.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (typeof v === "string") return v.length > 48 ? `${v.slice(0, 48)}…` : v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  return JSON.stringify(v).slice(0, 48);
}

const SKIP_KEYS = new Set([
  "jsonrpc",
  "id",
  "jsonrpcid",
  "wallet",
  "owner",
  "chain",
  "note",
  "query",
  "count",
  "sort",
  "totalpools",
  "explorerurl",
  "links",
]);

export type DataRow = { label: string; value: string };

/** Label candidates for a list item, most specific first. */
const ITEM_LABEL_KEYS = ["symbol", "name", "pair", "market", "mint", "address", "pubkey"];
/** Value candidates for a list item / nested scalar, most specific first. */
const ITEM_VALUE_KEYS = [
  "uiAmount",
  "amount",
  "balance",
  "value",
  "tvlUsd",
  "tvl",
  "liquidityUsd",
  "liquidityCook",
  "priceUsd",
  "priceCook",
  "price",
];

/** Pull a compact display scalar from a value that may be a nested object. */
function scalarOf(v: unknown): string {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const inner = pickKey(o, ITEM_VALUE_KEYS);
    if (inner !== undefined && inner !== null) {
      return typeof inner === "number" ? fmtNum(inner) : str(inner);
    }
    return "…"; // nested object with no known field — never dump raw JSON
  }
  return typeof v === "number" ? fmtNum(v) : str(v);
}

/** Build a "base/quote" pair label from nested venue objects (pools). */
function pairLabel(o: Record<string, unknown>): string | null {
  const base = o.base && typeof o.base === "object"
    ? pickKey(o.base as Record<string, unknown>, ["symbol", "name"])
    : undefined;
  const quote = o.quote && typeof o.quote === "object"
    ? pickKey(o.quote as Record<string, unknown>, ["symbol", "name"])
    : undefined;
  if (typeof base === "string" && typeof quote === "string") return `${base}/${quote}`;
  return null;
}

/** Normalize list-or-map MCP payloads into label/value rows. Never throws. */
export function toRows(data: unknown, max = 8): { rows: DataRow[]; more: number } {
  if (typeof data === "string") {
    return { rows: [{ label: "result", value: data.slice(0, 120) }], more: 0 };
  }
  if (Array.isArray(data)) {
    const rows = data.slice(0, max).map((item, i) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const label = pairLabel(o) ?? str(pickKey(o, ITEM_LABEL_KEYS));
        const value = str(pickKey(o, ITEM_VALUE_KEYS));
        return { label: label === "—" ? `#${i + 1}` : label, value };
      }
      return { label: `#${i + 1}`, value: str(item) };
    });
    return { rows, more: Math.max(0, data.length - max) };
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    // Prefer the first NON-empty nested collection; ignore empty arrays so a
    // record like { cook:{…}, tokens:[] } still renders its own fields.
    for (const key of ["balances", "tokens", "accounts", "pools", "items", "orders", "results", "data"]) {
      const nested = pickKey(o, [key]);
      if (Array.isArray(nested) && nested.length) return toRows(nested, max);
    }
    const entries = Object.entries(o).filter(
      ([k, v]) =>
        !SKIP_KEYS.has(k.toLowerCase()) &&
        v !== null &&
        v !== undefined &&
        !(Array.isArray(v) && v.length === 0),
    );
    const rows = entries.slice(0, max).map(([k, v]) => ({
      label: k.replace(/_/g, " "),
      value: scalarOf(v),
    }));
    return { rows, more: Math.max(0, entries.length - max) };
  }
  return { rows: [{ label: "result", value: str(data) }], more: 0 };
}

/**
 * get_balance → rows, native COOK first then each SPL token. The native
 * `cook` balance is a sibling of `tokens[]`, so the generic list-or-map
 * heuristic would drop it whenever `tokens` is present (or empty) — this
 * keeps it visible, which is the whole point of the ledger.
 */
export function balanceRows(payload: unknown, max = 10): { rows: DataRow[]; more: number } {
  const data = unwrapMcp(payload);
  if (!data || typeof data !== "object" || Array.isArray(data)) return toRows(data, max);
  const o = data as Record<string, unknown>;
  const rows: DataRow[] = [];

  const cook = o.cook;
  if (cook && typeof cook === "object") {
    const amt = pickKey(cook as Record<string, unknown>, ["uiAmount", "amount", "balance"]);
    if (amt !== undefined && amt !== null) rows.push({ label: "COOK", value: str(amt) });
  } else if (typeof cook === "number" || typeof cook === "string") {
    rows.push({ label: "COOK", value: str(cook) });
  }

  const tokens = pickKey(o, ["tokens", "balances", "accounts"]);
  if (Array.isArray(tokens)) {
    for (const t of tokens) {
      if (!t || typeof t !== "object") continue;
      const to = t as Record<string, unknown>;
      const sym = str(pickKey(to, ["symbol", "name", "mint"]));
      const amt = pickKey(to, ["uiAmount", "amount", "balance"]);
      rows.push({ label: sym === "—" ? "token" : sym, value: amt === undefined ? "—" : str(amt) });
    }
  }

  if (!rows.length) return toRows(data, max); // unknown shape — fall back
  return { rows: rows.slice(0, max), more: Math.max(0, rows.length - max) };
}
