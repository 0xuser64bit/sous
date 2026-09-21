import { fmtBalance, fmtNum, fmtUsd, pickKey, shortAddr, trimAmount } from "@/lib/utils/format";

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

export type PoolRow = {
  /** Stable key: several pools share a pair, and poolId is the only unique id. */
  id: string;
  pair: string;
  venue?: string;
  /** TVL already formatted as money, or "—". */
  tvl: string;
};

/**
 * Pool board rows.
 *
 * Several pools share the same base/quote pair — Cookie Chain currently
 * lists two bCOOK/wCOOK pools on different venues — so the venue has to be
 * shown to tell them apart. It gets its own line rather than being appended
 * to the pair: in a 300px rail "bCOOK/wCOOK · COOKIESWAP CPAMM" truncates to
 * "bCOOK/wCOOK · COOKIES…", which is exactly the ambiguity it was added to
 * remove.
 */
export function poolBoard(payload: unknown, max = 5): { pools: PoolRow[]; more: number } {
  const data = unwrapMcp(payload);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { pools: [], more: 0 };
  }
  const list = pickKey(data as Record<string, unknown>, ["pools"]);
  if (!Array.isArray(list)) return { pools: [], more: 0 };
  const pools = list.slice(0, max).map((item, i): PoolRow => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { id: `pool-${i}`, pair: "pool", tvl: "—" };
    }
    const o = item as Record<string, unknown>;
    const id = pickKey(o, ["poolId", "address", "id"]);
    const pair = pairLabel(o) ?? str(id);
    const venue = pickKey(o, ["venue"]);
    const tvl = pickKey(o, ["tvlUsd", "liquidityUsd", "tvl"]);
    return {
      id: typeof id === "string" ? id : `pool-${i}`,
      pair,
      venue: typeof venue === "string" && venue ? venue : undefined,
      // Six decimals of a dollar figure is noise, and an unlabelled number
      // beside a COOK-denominated app reads as COOK.
      tvl: typeof tvl === "number" ? fmtUsd(tvl) : "—",
    };
  });
  return { pools, more: Math.max(0, list.length - max) };
}

/**
 * Single-token balance from a get_balance payload (live shape:
 * { cook:{amount}, tokens:[{symbol,uiAmount}...] }). Returns null when the
 * token isn't there or the number is unreadable — callers treat null as
 * "unknown", never as zero.
 */
export function balanceOf(payload: unknown, symbol: string): number | null {
  const data = unwrapMcp(payload);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const n =
      typeof v === "string"
        ? Number(v.replace(/,/g, ""))
        : typeof v === "number"
          ? v
          : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const amtKeys = ["uiAmount", "amount", "balance"];
  const want = symbol.trim().toUpperCase();
  if (want === "COOK" || want === "WCOOK") {
    const cook = o.cook;
    if (cook && typeof cook === "object" && !Array.isArray(cook)) {
      return num(pickKey(cook as Record<string, unknown>, amtKeys));
    }
    if (typeof cook === "number" || typeof cook === "string") return num(cook);
    return null;
  }
  const tokens = pickKey(o, ["tokens", "balances", "accounts"]);
  if (!Array.isArray(tokens)) return null;
  for (const t of tokens) {
    if (!t || typeof t !== "object" || Array.isArray(t)) continue;
    const to = t as Record<string, unknown>;
    const sym = pickKey(to, ["symbol", "name"]);
    if (typeof sym === "string" && sym.toUpperCase() === want) {
      return num(pickKey(to, amtKeys));
    }
  }
  return null;
}

/**
 * get_balance → rows, native COOK first then each SPL token. The native
 * `cook` balance is a sibling of `tokens[]`, so the generic list-or-map
 * heuristic would drop it whenever `tokens` is present (or empty) — this
 * keeps it visible, which is the whole point of the ledger.
 *
 * Amounts arrive as full-precision strings ("13639797.520541906") and
 * unnamed mints arrive with `symbol: null`; both get rendered for a 300px
 * rail rather than dumped.
 */
export function balanceRows(payload: unknown, max = 10): { rows: DataRow[]; more: number } {
  const data = unwrapMcp(payload);
  if (!data || typeof data !== "object" || Array.isArray(data)) return toRows(data, max);
  const o = data as Record<string, unknown>;
  const rows: DataRow[] = [];
  const amtKeys = ["uiAmount", "amount", "balance"];

  const cook = o.cook;
  if (cook && typeof cook === "object") {
    const amt = pickKey(cook as Record<string, unknown>, amtKeys);
    if (amt !== undefined) rows.push({ label: "COOK", value: fmtBalance(amt as string | number) });
  } else if (typeof cook === "number" || typeof cook === "string") {
    rows.push({ label: "COOK", value: fmtBalance(cook) });
  }

  const tokens = pickKey(o, ["tokens", "balances", "accounts"]);
  if (Array.isArray(tokens)) {
    for (const t of tokens) {
      if (!t || typeof t !== "object") continue;
      const to = t as Record<string, unknown>;
      const sym = pickKey(to, ["symbol", "name"]);
      const mint = pickKey(to, ["mint", "address"]);
      // An unnamed mint is still worth showing — labelled by its address, so
      // it is identifiable, instead of a row of anonymous "token" entries.
      const label =
        typeof sym === "string" && sym
          ? sym
          : typeof mint === "string"
            ? shortAddr(mint, 4)
            : "token";
      const amt = pickKey(to, amtKeys);
      rows.push({
        label,
        value: fmtBalance(amt as string | number | undefined),
      });
    }
  }

  if (!rows.length) return toRows(data, max); // unknown shape — fall back
  return { rows: rows.slice(0, max), more: Math.max(0, rows.length - max) };
}

/**
 * stake_info → the four numbers a staker acts on.
 *
 * The raw payload leads with three addresses (bcookMint, stakePool,
 * program), so the generic map renderer spent its whole row budget on
 * things nobody can act on and pushed rate, APY, TVL and fees behind
 * "+4 more".
 */
export function stakeRows(payload: unknown): DataRow[] {
  const data = unwrapMcp(payload);
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const o = data as Record<string, unknown>;
  const rows: DataRow[] = [];

  const apy = pickKey(o, ["apyPct", "apy"]);
  if (typeof apy === "number") {
    rows.push({ label: "APY", value: `${apy.toFixed(2)}%` });
  }
  const rate = pickKey(o, ["rate"]);
  if (typeof rate === "number" && rate > 0) {
    rows.push({ label: "1 bCOOK", value: `${trimAmount(rate, 6)} COOK` });
  }
  const tvl = pickKey(o, ["tvlCook", "tvl"]);
  if (tvl !== undefined) rows.push({ label: "Pool TVL", value: `${fmtNum(tvl)} COOK` });

  const fees = pickKey(o, ["fees"]);
  if (fees && typeof fees === "object" && !Array.isArray(fees)) {
    const f = fees as Record<string, unknown>;
    const dep = pickKey(f, ["depositPct"]);
    const wit = pickKey(f, ["withdrawPct"]);
    if (typeof dep === "number" || typeof wit === "number") {
      rows.push({
        label: "Fees",
        value: `${typeof dep === "number" ? `${dep}% in` : "—"} · ${
          typeof wit === "number" ? `${wit}% out` : "—"
        }`,
      });
    }
  }
  return rows;
}

/** One resting limit/stop order, as both the board and the pass render it. */
export type StandingOrder = { id: string; label: string };

/**
 * get_limit_orders → resting orders, or an empty list.
 *
 * Empty is the common case and it matters: the payload still carries
 * `{ owner, fees, count, orders: [] }`, so the generic map renderer
 * produced a single meaningless "fees …" row and the honest "the book is
 * clear" message never fired.
 */
export function limitOrderRows(payload: unknown): StandingOrder[] {
  const data = unwrapMcp(payload);
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (pickKey(data as Record<string, unknown>, ["orders", "items", "data", "results"]) as unknown)
      : null;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item, i): StandingOrder[] => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const id = pickKey(o, ["orderId", "order_id", "id", "address", "pubkey"]);
    if (typeof id !== "string" && typeof id !== "number") return [];
    const amount = pickKey(o, ["amount", "inAmount", "quantity"]);
    const from = pickKey(o, ["from", "inputSymbol", "input", "sell"]);
    const to = pickKey(o, ["to", "outputSymbol", "output", "buy"]);
    const price = pickKey(o, ["price", "limitPrice", "triggerPrice"]);
    const kind = pickKey(o, ["kind"]);
    const bits = [
      typeof kind === "string" && kind.toLowerCase() === "stop" ? "stop" : null,
      amount !== undefined ? fmtBalance(amount as string | number) : null,
      typeof from === "string" ? from : null,
      typeof to === "string" ? `→ ${to}` : null,
      price !== undefined ? `@ ${trimAmount(price as string | number)}` : null,
    ].filter(Boolean);
    return [{ id: String(id), label: bits.length ? bits.join(" ") : `#${i + 1}` }];
  });
}

/**
 * resolve_domain → a card a reader can act on.
 *
 * The generic renderer dropped `note` (it is in SKIP_KEYS) and collapsed
 * the nested `price` to its `priceUsd`, printing a bare "1.5" for a name
 * that costs 15,000 COOK. Names are the one place the sidecar writes a
 * plain-English answer; show it.
 */
export function domainRows(payload: unknown): { rows: DataRow[]; note?: string } {
  const data = unwrapMcp(payload);
  if (!data || typeof data !== "object" || Array.isArray(data)) return { rows: [] };
  const o = data as Record<string, unknown>;
  const rows: DataRow[] = [];

  const registered = pickKey(o, ["registered"]);
  const owner = pickKey(o, ["owner"]);
  if (typeof owner === "string" && owner) {
    rows.push({ label: "Owner", value: owner });
  } else if (registered === false) {
    rows.push({ label: "Status", value: "available" });
  } else {
    const account = pickKey(o, ["account"]);
    if (typeof account === "string") rows.push({ label: "Account", value: account });
  }

  const price = pickKey(o, ["price"]);
  if (price && typeof price === "object" && !Array.isArray(price)) {
    const p = price as Record<string, unknown>;
    const cook = pickKey(p, ["priceCook"]);
    const usd = pickKey(p, ["priceUsd"]);
    if (cook !== undefined) {
      // COOK is what the registry charges; USD is the aside, not the price.
      const usdPart = typeof usd === "number" ? ` (≈ $${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })})` : "";
      rows.push({ label: "Price", value: `${fmtNum(cook)} COOK${usdPart}` });
    }
    const tier = pickKey(p, ["tier"]);
    if (typeof tier === "string") rows.push({ label: "Tier", value: tier });
  }

  const created = pickKey(o, ["createdAt"]);
  if (typeof created === "string") rows.push({ label: "Registered", value: created.slice(0, 10) });

  const note = pickKey(o, ["note"]);
  return { rows, note: typeof note === "string" ? note : undefined };
}

/**
 * search_tokens → symbol and liquidity in the label, mint as the value.
 *
 * The mint is the actionable part: resolveMint refuses an ambiguous ticker
 * and tells the user to order by address, so search has to hand them one.
 */
export function tokenSearchRows(payload: unknown, max = 8): { rows: DataRow[]; more: number } {
  const data = unwrapMcp(payload);
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (pickKey(data as Record<string, unknown>, ["results", "tokens", "data"]) as unknown)
      : null;
  if (!Array.isArray(list)) return { rows: [], more: 0 };
  const rows = list.flatMap((item): DataRow[] => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const mint = pickKey(o, ["mint", "address"]);
    if (typeof mint !== "string") return [];
    const sym = pickKey(o, ["symbol", "name"]);
    const liq = pickKey(o, ["liquidityCook", "liquidityUsd", "tvlUsd"]);
    const label =
      typeof liq === "number"
        ? `${typeof sym === "string" ? sym : "—"} · ${fmtNum(liq)} COOK liq`
        : typeof sym === "string"
          ? sym
          : "—";
    return [{ label, value: mint }];
  });
  return { rows: rows.slice(0, max), more: Math.max(0, rows.length - max) };
}
