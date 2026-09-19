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

const SKIP_KEYS = new Set(["jsonrpc", "id", "jsonrpcid"]);

export type DataRow = { label: string; value: string };

/** Normalize list-or-map MCP payloads into label/value rows. Never throws. */
export function toRows(data: unknown, max = 8): { rows: DataRow[]; more: number } {
  if (typeof data === "string") {
    return { rows: [{ label: "result", value: data.slice(0, 120) }], more: 0 };
  }
  if (Array.isArray(data)) {
    const rows = data.slice(0, max).map((item, i) => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const label = str(
          pickKey(o, ["symbol", "name", "mint", "address", "pubkey", "pair", "market"]),
        );
        const value = str(
          pickKey(o, ["uiAmount", "amount", "balance", "value", "tvl", "liquidity", "price"]),
        );
        return { label: label === "—" ? `#${i + 1}` : label, value };
      }
      return { label: `#${i + 1}`, value: str(item) };
    });
    return { rows, more: Math.max(0, data.length - max) };
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const nested = pickKey(o, ["balances", "tokens", "accounts", "pools", "items", "orders", "data"]);
    if (Array.isArray(nested)) return toRows(nested, max);
    const entries = Object.entries(o).filter(
      ([k, v]) => !SKIP_KEYS.has(k.toLowerCase()) && v !== null && v !== undefined,
    );
    const rows = entries.slice(0, max).map(([k, v]) => ({
      label: k.replace(/_/g, " "),
      value: typeof v === "number" ? fmtNum(v) : str(v),
    }));
    return { rows, more: Math.max(0, entries.length - max) };
  }
  return { rows: [{ label: "result", value: str(data) }], more: 0 };
}
