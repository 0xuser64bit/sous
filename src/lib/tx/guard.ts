/**
 * Sign-guard: refuse to sign when the sidecar's decoded summary contradicts
 * the paper ticket. Symbols lie, mints don't — so mints/addresses compare
 * exactly, symbols leniently. Pure and framework-free so it can be unit
 * tested; the chat pass calls guardSummary() right before the wallet opens.
 */
import type { QuoteData } from "@/lib/store/usePilotStore";
import { pickKey, isAddressLike } from "@/lib/utils/format";

export type GuardResult = { ok: boolean; detail?: string };

/** Exact for mints/addresses, case-insensitive for symbols, never cross-type. */
export function sameRef(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isAddressLike(a) && !isAddressLike(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
}

function numOf(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function amountsMatch(a: unknown, b: number): boolean {
  const n = numOf(a);
  if (n === null) return true; // key absent or unreadable — nothing to contradict
  return Math.abs(n - b) <= 1e-9 * Math.max(1, b);
}

/** Refuse to sign when an itemized summary contradicts the order (swap/limit base). */
export function summaryMatches(
  summary: unknown,
  intent: { amount: number; from: string; to: string },
): GuardResult {
  if (!summary || typeof summary !== "object") return { ok: true };
  const s = summary as Record<string, unknown>;
  const sFrom = pickKey(s, ["from", "input", "inputMint", "inMint", "src", "source", "sell"]);
  const sTo = pickKey(s, ["to", "output", "outputMint", "outMint", "dst", "dest", "buy"]);
  const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
  if (typeof sFrom === "string" && !sameRef(sFrom, intent.from)) {
    return { ok: false, detail: `summary says ${sFrom}, order says ${intent.from}` };
  }
  if (typeof sTo === "string" && !sameRef(sTo, intent.to)) {
    return { ok: false, detail: `summary says ${sTo}, order says ${intent.to}` };
  }
  if (sAmt !== undefined && !amountsMatch(sAmt, intent.amount)) {
    return { ok: false, detail: `summary says ${sAmt}, order says ${intent.amount}` };
  }
  return { ok: true };
}

export function transferMatches(
  summary: unknown,
  intent: { amount: number; token: string; to: string },
): GuardResult {
  if (!summary || typeof summary !== "object") return { ok: true };
  const s = summary as Record<string, unknown>;
  const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
  const sTok = pickKey(s, ["mint", "token", "symbol", "currency", "inputMint"]);
  const sTo = pickKey(s, ["to", "dest", "destination", "recipient", "address", "owner"]);
  if (sAmt !== undefined && !amountsMatch(sAmt, intent.amount)) {
    return { ok: false, detail: `summary says ${sAmt}, order says ${intent.amount}` };
  }
  if (typeof sTok === "string" && !sameRef(sTok, intent.token)) {
    return { ok: false, detail: `summary says ${sTok}, order says ${intent.token}` };
  }
  if (typeof sTo === "string") {
    const a = sTo.trim().replace(/[.,;!?)]+$/, "");
    const b = intent.to.trim();
    // A `.cook` name is resolved to an address by the sidecar; we cannot
    // reproduce that resolution here, so only enforce address-equality when
    // the order itself named an address (the tamper case that matters).
    // Names are still amount- and token-guarded, and the resolved address is
    // surfaced to the user on the receipt.
    // ponytail: trust sidecar name resolution; resolve client-side only if abuse shows up.
    if (isAddressLike(b) && !sameRef(a, b)) {
      return { ok: false, detail: `summary pays ${a}, order pays ${b}` };
    }
  }
  return { ok: true };
}

/** Guard every ticket kind before the wallet ever sees it. */
export function guardSummary(summary: unknown, q: QuoteData): GuardResult {
  const pair = {
    amount: q.amount,
    from: q.expectFrom ?? q.from,
    to: q.expectTo ?? q.to,
  };
  switch (q.orderKind) {
    case "transfer":
      return transferMatches(summary, { amount: q.amount, token: pair.from, to: q.to });
    case "bridge": {
      // Destinations are chain-side addresses — only amount + token are stable.
      if (!summary || typeof summary !== "object") return { ok: true };
      const s = summary as Record<string, unknown>;
      const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
      const sTok = pickKey(s, ["from", "token", "mint", "symbol", "input"]);
      if (sAmt !== undefined && !amountsMatch(sAmt, q.amount)) {
        return { ok: false, detail: `summary says ${sAmt}, order says ${q.amount}` };
      }
      if (typeof sTok === "string" && !sameRef(sTok, pair.from)) {
        return { ok: false, detail: `summary says ${sTok}, order says ${pair.from}` };
      }
      return { ok: true };
    }
    case "limit": {
      const base = summaryMatches(summary, pair);
      if (!base.ok) return base;
      if (summary && typeof summary === "object") {
        const p = pickKey(summary as Record<string, unknown>, [
          "price",
          "limitPrice",
          "triggerPrice",
          "trigger",
        ]);
        const want = Number((q.fireArgs.price as number | undefined) ?? NaN);
        if (p !== undefined && Number.isFinite(want) && !amountsMatch(p, want)) {
          return { ok: false, detail: `summary price says ${p}, order says ${want}` };
        }
      }
      return { ok: true };
    }
    default:
      return summaryMatches(summary, pair);
  }
}

/** The resolved destination address from a transfer summary, if present. */
export function resolvedDestination(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const to = pickKey(s, ["to", "dest", "destination", "recipient", "address", "owner"]);
  if (typeof to !== "string") return null;
  const clean = to.trim().replace(/[.,;!?)]+$/, "");
  return isAddressLike(clean) ? clean : null;
}
