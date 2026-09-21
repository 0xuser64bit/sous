/**
 * Tiny local intent parser.
 * Turns plain words into a structured order — no network, no LLM.
 * Anything ambiguous becomes `unknown` and the pass asks a clarifying
 * question instead of guessing with money.
 */

export type SwapIntent = {
  kind: "swap";
  amount: number;
  from: string;
  to: string;
};

export type TransferIntent = {
  kind: "transfer";
  amount: number;
  token: string;
  /** Raw destination: base58 address or `.cook` name. Never normalized. */
  to: string;
};

export type StakeIntent = {
  kind: "stake";
  amount: number | null;
};

export type UnstakeIntent = {
  kind: "unstake";
  amount: number | null;
};

export type LimitIntent = {
  kind: "limit";
  amount: number;
  from: string;
  to: string;
  /** Target price quoted in `to` per `from` (e.g. 0.5 USDC per COOK). */
  price: number;
  /** take-profit vs stop-loss (stop-market). */
  orderKind: "limit" | "stop";
};

export type Intent =
  | SwapIntent
  | TransferIntent
  | StakeIntent
  | UnstakeIntent
  | LimitIntent
  | { kind: "cancel"; orderId: string }
  | { kind: "orders" }
  | { kind: "bridge"; amount: number; token: string; toChain: string }
  | { kind: "resolve"; name: string }
  | { kind: "search"; query: string }
  | { kind: "balance" }
  | { kind: "stake_info" }
  | { kind: "help" }
  | { kind: "unknown"; raw: string };

const TOKEN = "[a-z0-9.]{2,12}";
const ARROW = "(?:->|→|to|for|into|>)";

function normToken(s: string): string {
  return s.trim().toUpperCase().replace(/^\$/, "");
}

function num(s: string | undefined): number | null {
  if (s === undefined) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "quote 10 COOK -> bCOOK", "swap 5 cook for usdc" */
const ARROW_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*(${TOKEN})?\\s*${ARROW}\\s*(${TOKEN})`,
  "i",
);

const SWAP_VERB = /\b(quote|swap|trade|convert|exchange|price|buy|sell)\b/i;

/** "buy 10 bCOOK" / "sell 5 COOK" — single-token shorthand. */
const BUY_SELL_RE = /\b(buy|sell)\s+(\d+(?:\.\d+)?)\s*\$?([a-z0-9.]{2,12})/i;

/** "send 5 COOK to <addr|name.cook>", "transfer 2 USDC → …", "pay 1 COOK to alice.cook" */
const TRANSFER_RE = new RegExp(
  `\\b(send|transfer|pay)\\s+(\\d+(?:\\.\\d+)?)\\s*\\$?(${TOKEN})\\s*(?:to|->|→|>)\\s*(\\S+)`,
  "i",
);

/** "limit buy 5 COOK -> USDC at 0.5", "stop/limit sell 10 bCOOK for COOK @ 2" */
const LIMIT_RE = new RegExp(
  `\\b(limit|stop)\\b[^\\d]*?(buy|sell)?\\s*(\\d+(?:\\.\\d+)?)\\s*\\$?(${TOKEN})\\s*${ARROW}\\s*(${TOKEN})\\s*(?:at|@|for|price)\\s*(\\d+(?:\\.\\d+)?)`,
  "i",
);

/** "cancel order abc123", "cancel 7" — requires the word order or a real id. */
const CANCEL_RE = /\bcancel\s+(?:order\s+)?([a-z0-9-]{2,44})/i;
const CANCEL_STOPWORDS = new Set([
  "my",
  "the",
  "that",
  "this",
  "it",
  "that one",
  "order",
  "orders",
  "limit",
  "please",
]);

/** "bridge 5 COOK to solana", "bridge 10 USDC -> cookie" */
const BRIDGE_RE = new RegExp(
  `\\bbridge\\s+(\\d+(?:\\.\\d+)?)\\s*\\$?(${TOKEN})\\s*(?:to|->|→|>)\\s*([a-z]{3,12})`,
  "i",
);

/** Bare ".cook" mention anywhere, or explicit "resolve <name>". */
const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]*\.cook)\b/i;

/** "search COOK", "find usdc", "token info bCOOK", "price of COOK" (no amount). */
const SEARCH_RE = /\b(?:search|find|lookup|token\s+info|info|price\s+of)\s+\$?([a-z0-9.]{2,12})/i;

export function parseIntent(input: string): Intent {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!text) return { kind: "unknown", raw: text };

  if (/\b(help|what can you|how (do|does)|commands?)\b/.test(lower)) {
    return { kind: "help" };
  }
  if (
    /\b(balance|balances|portfolio|holdings|pantry|my (cook|funds|money))\b/.test(
      lower,
    )
  ) {
    return { kind: "balance" };
  }
  if (/\bcancel\b/.test(lower)) {
    const m = text.match(CANCEL_RE);
    if (m && !CANCEL_STOPWORDS.has(m[1].toLowerCase()))
      return { kind: "cancel", orderId: m[1] };
    return { kind: "unknown", raw: text };
  }
  if (
    /\b(my\s+orders?|open\s+orders?|limit\s+orders?|my\s+limits?)\b/.test(lower) &&
    !/\blimit\s+(buy|sell)\b/.test(lower) &&
    !LIMIT_RE.test(text)
  ) {
    return { kind: "orders" };
  }

  const domain = text.match(DOMAIN_RE);
  if (domain && /\b(resolve|lookup|who(\s+is| owns)|owner)\b/.test(lower)) {
    return { kind: "resolve", name: domain[1].toLowerCase() };
  }

  const bridge = text.match(BRIDGE_RE);
  if (bridge) {
    const amount = num(bridge[1]);
    if (amount !== null) {
      return {
        kind: "bridge",
        amount,
        token: normToken(bridge[2]),
        toChain: bridge[3].toLowerCase(),
      };
    }
  }

  const transfer = text.match(TRANSFER_RE);
  if (transfer) {
    const amount = num(transfer[2]);
    if (amount !== null) {
      return {
        kind: "transfer",
        amount,
        token: normToken(transfer[3]),
        to: transfer[4].replace(/[.,;!?)]+$/, ""),
      };
    }
  }

  const limit = text.match(LIMIT_RE);
  if (limit) {
    const amount = num(limit[3]);
    const price = num(limit[6]);
    if (amount !== null && price !== null) {
      return {
        kind: "limit",
        amount,
        from: normToken(limit[4]),
        to: normToken(limit[5]),
        price,
        orderKind: (limit[1] ?? "").toLowerCase() === "stop" ? "stop" : "limit",
      };
    }
  }

  if (/\bunstak(?:e|ing)\b|\bun-stake\b/.test(lower)) {
    const m = lower.match(/\bunstak(?:e|ing)\s*(\d+(?:\.\d+)?)?/);
    const amount = m?.[1] ? num(m[1]) : null;
    return { kind: "unstake", amount: amount ?? null };
  }
  const stakeMatch = lower.match(/\bstak(?:e|ing)\s*(\d+(?:\.\d+)?)?/);
  if (stakeMatch) {
    if (/\b(apy|rate|info|rewards?)\b/.test(lower) || !stakeMatch[1]) {
      return { kind: "stake_info" };
    }
    const amount = num(stakeMatch[1]);
    return { kind: "stake", amount: amount ?? null };
  }

  const arrow = text.match(ARROW_RE);
  if (arrow && SWAP_VERB.test(text)) {
    const amount = num(arrow[1]);
    if (amount === null) return { kind: "unknown", raw: text };
    // "buy 10 bCOOK" → from COOK; "sell 10 bCOOK" → to COOK.
    if (!arrow[2]) {
      const to = normToken(arrow[3]);
      if (/\bbuy\b/.test(lower)) return { kind: "swap", amount, from: "COOK", to };
      if (/\bsell\b/.test(lower)) return { kind: "swap", amount, from: to, to: "COOK" };
      return { kind: "swap", amount, from: "COOK", to };
    }
    return {
      kind: "swap",
      amount,
      from: normToken(arrow[2]),
      to: normToken(arrow[3]),
    };
  }

  // Single-token shorthand (no arrow): "buy 10 bCOOK", "sell 5 COOK".
  const buySell = text.match(BUY_SELL_RE);
  if (buySell) {
    const amount = num(buySell[2]);
    if (amount !== null) {
      const token = normToken(buySell[3]);
      if (/^buy$/i.test(buySell[1]))
        return { kind: "swap", amount, from: "COOK", to: token };
      return { kind: "swap", amount, from: token, to: "COOK" };
    }
  }

  // Bare ".cook" mention with no resolve verb — still resolve it.
  if (domain) return { kind: "resolve", name: domain[1].toLowerCase() };

  const search = text.match(SEARCH_RE);
  if (search) return { kind: "search", query: normToken(search[1]) };

  return { kind: "unknown", raw: text };
}

/**
 * Example orders shown on the empty pass.
 *
 * The swap and balance examples name real Cookie Chain assets and run as
 * typed. The send and limit examples are templates: `alice.cook` is not a
 * registered name and 2.0 is not a price anyone chose — they exist to teach
 * the syntax. `isTemplateOrder` keeps them out of the fire path.
 */
export const EXAMPLE_ORDERS = [
  "Quote 10 COOK → bCOOK",
  "Send 2 COOK to alice.cook",
  "Limit sell 5 bCOOK → COOK at 2.0",
  "What is my balance?",
] as const;

/**
 * True when an example names a counterparty or a price the user has to
 * supply themselves. Tapping one of those should load the composer for
 * editing, not post a ticket addressed to a name out of a code comment.
 * Quotes and reads move nothing, so they run on tap.
 */
export function isTemplateOrder(text: string): boolean {
  const kind = parseIntent(text).kind;
  return kind === "transfer" || kind === "limit" || kind === "bridge";
}
