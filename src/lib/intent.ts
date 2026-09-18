/**
 * Tiny local intent parser (TASK 02, v0).
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

export type StakeIntent = {
  kind: "stake";
  amount: number | null;
};

export type Intent =
  | SwapIntent
  | StakeIntent
  | { kind: "balance" }
  | { kind: "stake_info" }
  | { kind: "help" }
  | { kind: "unknown"; raw: string };

const TOKEN = "[a-z0-9.]{2,12}";
const ARROW = "(?:->|→|to|for|into|>)";

function normToken(s: string): string {
  return s.trim().toUpperCase().replace(/^\$/, "");
}

/** "quote 10 COOK -> bCOOK", "swap 5 cook for usdc", "buy 2 bcook" */
const ARROW_RE = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*(${TOKEN})?\\s*${ARROW}\\s*(${TOKEN})`,
  "i",
);

const SWAP_VERB = /\b(quote|swap|trade|convert|exchange|price|buy|sell)\b/i;

/** "buy 10 bCOOK" / "sell 5 COOK" — single-token shorthand. */
const BUY_SELL_RE = /\b(buy|sell)\s+(\d+(?:\.\d+)?)\s*\$?([a-z0-9.]{2,12})/i;

export function parseIntent(input: string): Intent {
  const text = input.trim();
  const lower = text.toLowerCase();
  if (!text) return { kind: "unknown", raw: text };

  if (/\b(help|what can you|how (do|does)|commands?)\b/.test(lower)) {
    return { kind: "help" };
  }
  if (/\b(balance|balances|portfolio|holdings|pantry|my (cook|funds|money))\b/.test(lower)) {
    return { kind: "balance" };
  }
  if (/\b(unstake|un-stake)\b/.test(lower)) {
    return { kind: "stake_info" };
  }
  const stakeMatch = lower.match(/\bstake\s*(\d+(?:\.\d+)?)?/);
  if (stakeMatch) {
    if (/\b(apy|rate|info|rewards?)\b/.test(lower) || !stakeMatch[1]) {
      return { kind: "stake_info" };
    }
    return { kind: "stake", amount: Number(stakeMatch[1]) };
  }

  const arrow = text.match(ARROW_RE);
  if (arrow && SWAP_VERB.test(text)) {
    const amount = Number(arrow[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
  const buySell = text.match(BUY_SELL_RE);
  if (buySell) {
    const amount = Number(buySell[2]);
    if (Number.isFinite(amount) && amount > 0) {
      const token = normToken(buySell[3]);
      if (/^buy$/i.test(buySell[1])) return { kind: "swap", amount, from: "COOK", to: token };
      return { kind: "swap", amount, from: token, to: "COOK" };
    }
  }

  return { kind: "unknown", raw: text };
    }
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

  return { kind: "unknown", raw: text };
}

/** Example orders shown on the empty pass. */
export const EXAMPLE_ORDERS = [
  "Quote 10 COOK → bCOOK",
  "Swap 5 COOK → USDC",
  "What is my balance?",
] as const;
