/**
 * Sign-guard: the last check between the paper ticket the user read and the
 * bytes the wallet is about to sign. It runs on the sidecar's decoded
 * `summary`, never on the transaction itself — cookie-mcp already decodes
 * every instruction against the program IDL; this guards the remaining gap,
 * which is that the sidecar re-quotes at fire time and can hand back
 * something the user never saw.
 *
 * Two classes of check:
 *
 *   identity  — is this the same trade? Mints and addresses compare exactly,
 *               symbols leniently, and the two never compare across types.
 *   economics — is it still the trade that was quoted? The output can only
 *               have moved in the user's favour, the on-chain floor can only
 *               have risen, and the slippage cap can only have narrowed.
 *
 * Pure and framework-free so the whole policy is unit-testable against
 * payloads captured from a live sidecar.
 */
import type { QuoteData } from "@/lib/store/usePilotStore";
import { readSummary, type SignSummary } from "@/lib/mcp/summary";
import { isAddressLike } from "@/lib/utils/format";

export type GuardResult = {
  ok: boolean;
  detail?: string;
  /**
   * False when the sidecar sent no summary at all (stake/unstake do not).
   * There is then nothing to contradict — but the UI must not claim a
   * comparison happened.
   */
  checked: boolean;
};

const pass = (checked: boolean): GuardResult => ({ ok: true, checked });
const refuse = (detail: string): GuardResult => ({ ok: false, detail, checked: true });

/**
 * How far the fire-time expected output may fall below the quote before the
 * ticket counts as stale. Markets move between reading and signing; this is
 * wide enough not to nag and tight enough that nobody signs a number they
 * never saw. The on-chain floor check below is the hard guarantee.
 */
export const DRIFT_TOLERANCE = 0.02;

/** Relative slack for float comparisons of amounts that survived a JSON round trip. */
const EPS = 1e-9;

/** Exact for mints/addresses, case-insensitive for symbols, never cross-type. */
export function sameRef(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isAddressLike(a) && !isAddressLike(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
}

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(b));
}

/** `a` is materially below `b` by more than `tolerance` (relative). */
function isWorseThan(a: number, b: number, tolerance = 0): boolean {
  if (b <= 0) return false;
  return a < b * (1 - tolerance) - EPS * Math.abs(b);
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 9 });
}

/**
 * Does the summary describe the same asset the ticket names? Prefers the
 * mint (symbols are attacker-chosen), falls back to the symbol, and stays
 * silent when the sidecar named neither.
 */
function assetMatches(
  summaryMint: string | undefined,
  summarySymbol: string | undefined,
  expectedMint: string | undefined,
  expectedSymbol: string,
  side: string,
): GuardResult | null {
  if (summaryMint && expectedMint) {
    return sameRef(summaryMint, expectedMint)
      ? null
      : refuse(`${side} mint — summary says ${summaryMint}, ticket says ${expectedMint}`);
  }
  if (summaryMint && !expectedMint && !isAddressLike(expectedSymbol)) {
    // The ticket only knows a symbol; a mint cannot contradict it. Nothing to do.
    return null;
  }
  if (summarySymbol) {
    return sameRef(summarySymbol, expectedSymbol)
      ? null
      : refuse(`${side} — summary says ${summarySymbol}, ticket says ${expectedSymbol}`);
  }
  return null;
}

/** Amount, input asset, and output asset all agree with the ticket. */
function identityMatches(s: SignSummary, q: QuoteData): GuardResult | null {
  if (s.inAmount !== undefined && !amountsMatch(s.inAmount, q.amount)) {
    return refuse(`amount — summary says ${fmt(s.inAmount)}, ticket says ${fmt(q.amount)}`);
  }
  const inBad = assetMatches(s.inMint, s.inSymbol, q.expectFrom, q.from, "input");
  if (inBad) return inBad;
  const outBad = assetMatches(s.outMint, s.outSymbol, q.expectTo, q.to, "output");
  if (outBad) return outBad;
  return null;
}

/**
 * The trade is still worth what the ticket promised. Every rule is
 * one-directional: better is always fine, worse is never signed.
 */
function economicsMatch(s: SignSummary, q: QuoteData): GuardResult | null {
  if (
    q.quotedOut !== undefined &&
    s.expectedOut !== undefined &&
    isWorseThan(s.expectedOut, q.quotedOut, DRIFT_TOLERANCE)
  ) {
    return refuse(
      `the price moved — the ticket quoted ${fmt(q.quotedOut)} ${q.to}, this fill pays ${fmt(s.expectedOut)}. Re-fire for a fresh quote`,
    );
  }
  if (
    q.quotedMinOut !== undefined &&
    s.minOut !== undefined &&
    isWorseThan(s.minOut, q.quotedMinOut)
  ) {
    return refuse(
      `the guaranteed minimum dropped — the ticket promised at least ${fmt(q.quotedMinOut)} ${q.to}, this fill guarantees ${fmt(s.minOut)}`,
    );
  }
  if (
    q.slippageBps !== undefined &&
    s.slippageBps !== undefined &&
    s.slippageBps > q.slippageBps
  ) {
    return refuse(
      `slippage widened — the ticket showed ${q.slippageBps} bps, this fill allows ${s.slippageBps} bps`,
    );
  }
  return null;
}

/** Transfers: amount, asset, and — when the order named one — the destination address. */
export function transferMatches(
  summary: unknown,
  intent: { amount: number; token: string; to: string },
): GuardResult {
  const s = readSummary(summary);
  if (s.absent) return pass(false);

  if (s.inAmount !== undefined && !amountsMatch(s.inAmount, intent.amount)) {
    return refuse(`amount — summary says ${fmt(s.inAmount)}, ticket says ${fmt(intent.amount)}`);
  }
  const asset = s.inMint ?? s.inSymbol;
  if (asset && !sameRef(asset, intent.token)) {
    return refuse(`token — summary says ${asset}, ticket says ${intent.token}`);
  }
  if (s.to) {
    const dest = s.to.trim().replace(/[.,;!?)]+$/, "");
    const want = intent.to.trim();
    // A `.cook` name is resolved to an address by the sidecar and we cannot
    // reproduce that resolution here, so address-equality is only enforced
    // when the order itself named an address — the tamper case that matters.
    // Name transfers stay amount- and token-guarded, and the address that was
    // actually paid is printed on the receipt.
    if (isAddressLike(want) && !sameRef(dest, want)) {
      return refuse(`destination — summary pays ${dest}, ticket pays ${want}`);
    }
  }
  return pass(true);
}

/** Guard every ticket kind before the wallet ever sees it. */
export function guardSummary(summary: unknown, q: QuoteData): GuardResult {
  const s = readSummary(summary);

  switch (q.orderKind) {
    case "transfer":
      return transferMatches(summary, {
        amount: q.amount,
        token: q.expectFrom ?? q.from,
        to: q.to,
      });

    case "bridge": {
      // The warp route's first leg only creates a token account — it names no
      // amount and no asset. Guard whatever the final leg does name; the
      // destination is a foreign-chain address the ticket never pinned.
      if (s.absent) return pass(false);
      if (s.inAmount !== undefined && !amountsMatch(s.inAmount, q.amount)) {
        return refuse(`amount — summary says ${fmt(s.inAmount)}, ticket says ${fmt(q.amount)}`);
      }
      const asset = s.inMint ?? s.inSymbol;
      if (asset && q.expectFrom && !sameRef(asset, q.expectFrom)) {
        return refuse(`token — summary says ${asset}, ticket says ${q.expectFrom}`);
      }
      return pass(true);
    }

    case "limit": {
      if (s.absent) return pass(false);
      const bad = identityMatches(s, q);
      if (bad) return bad;
      // A take-profit silently built as a stop-loss (or the reverse) is a
      // different order with a different risk — the summary names which.
      const want = q.fireArgs.kind;
      if (s.orderKind && typeof want === "string" && s.orderKind.toLowerCase() !== want.toLowerCase()) {
        return refuse(`order type — summary says ${s.orderKind}, ticket says ${want}`);
      }
      const wantPrice = Number(q.fireArgs.price ?? NaN);
      if (s.price !== undefined && Number.isFinite(wantPrice) && !amountsMatch(s.price, wantPrice)) {
        return refuse(`price — summary says ${fmt(s.price)}, ticket says ${fmt(wantPrice)}`);
      }
      return pass(true);
    }

    default: {
      // swap, stake, unstake. stake/unstake send no summary at all.
      if (s.absent) return pass(false);
      const bad = identityMatches(s, q) ?? economicsMatch(s, q);
      return bad ?? pass(true);
    }
  }
}

/** The resolved destination address from a transfer summary, if present. */
export function resolvedDestination(summary: unknown): string | null {
  const to = readSummary(summary).to;
  if (!to) return null;
  const clean = to.trim().replace(/[.,;!?)]+$/, "");
  return isAddressLike(clean) ? clean : null;
}
