import { callMcp } from "./client";
import { unwrapMcp } from "./shapes";
import { pickKey } from "@/lib/utils/format";

/**
 * Dual-aggregator quoting against the real sidecar shapes.
 * get_quote takes MINTS ({inputMint, outputMint, amount}) and answers:
 * { aggregator, input:{...}, output:{expectedOut,outAfterFee,minOut,...},
 *   priceImpactPct, slippageBps, route:{hops:[{venue,...}]} }
 */

export type Aggregator = "cookiebox" | "cookiescan";

export type QuoteView = {
  aggregator: Aggregator;
  /** UI amount the user receives (fee-in). */
  out: string;
  outAfterFee?: string;
  minOut?: string;
  venue?: string;
  impact?: string;
  raw: Record<string, unknown>;
};

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function outOf(raw: Record<string, unknown>): { out?: string; fee?: string; min?: string } {
  const o = pickKey(raw, ["output"]);
  const src = o && typeof o === "object" ? (o as Record<string, unknown>) : raw;
  const pick = (names: string[]) => {
    const v = pickKey(src, names);
    return v === undefined || v === null ? undefined : String(v);
  };
  return {
    out: pick([
      "outAfterFee",
      "expectedOut",
      "outAmount",
      "outputAmount",
      "amountOut",
      "out",
      "receivedAmount",
      "toAmount",
    ]),
    fee: pick(["outAfterFee"]),
    min: pick(["minOut", "minimumOut"]),
  };
}

/** Tolerant field extraction: real nested shape first, flat fallbacks. */
export function extractQuoteFields(raw: unknown): {
  out?: string;
  venue?: string;
  impact?: string;
  aggregator?: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return typeof raw === "string" ? { out: raw.slice(0, 120) } : {};
  }
  const o = raw as Record<string, unknown>;
  const { out } = outOf(o);
  const route = pickKey(o, ["route"]);
  let hopVenue: unknown;
  if (route && typeof route === "object") {
    const hops = pickKey(route as Record<string, unknown>, ["hops"]);
    if (Array.isArray(hops) && hops[0] && typeof hops[0] === "object") {
      hopVenue = pickKey(hops[0] as Record<string, unknown>, ["venue", "dex", "pool"]);
    }
  }
  const agg = pickKey(o, ["aggregator"]);
  const venueRaw =
    hopVenue !== undefined && hopVenue !== null
      ? String(hopVenue)
      : typeof agg === "string"
        ? agg
        : pickKey(o, ["venue", "dex", "source", "router"]);
  const impactRaw = pickKey(o, ["priceImpactPct", "priceImpact", "impact", "slippage"]);
  return {
    out,
    venue: venueRaw === undefined || venueRaw === null ? undefined : String(venueRaw),
    impact: impactRaw === undefined || impactRaw === null ? undefined : String(impactRaw),
    aggregator: typeof agg === "string" ? agg : undefined,
  };
}

function scoreOf(v: QuoteView): number {
  return (
    numOrNull(v.outAfterFee) ?? numOrNull(v.out) ?? Number.NEGATIVE_INFINITY
  );
}

function toView(aggregator: Aggregator, raw: unknown): QuoteView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const { out, fee, min } = outOf(o);
  if (!out) return null;
  const f = extractQuoteFields(o);
  return {
    aggregator,
    out,
    outAfterFee: fee,
    minOut: min,
    venue: f.venue,
    impact: f.impact,
    raw: o,
  };
}

export type BothQuotes = {
  best: QuoteView;
  /** The losing quote, shown for honesty when both venues answer. */
  alt?: QuoteView;
};

/**
 * Quote BOTH aggregators (TASKS 02 core). One failing venue never kills
 * the ticket — the survivor wins alone and the note says so.
 */
export async function quoteBoth(opts: {
  inputMint: string;
  outputMint: string;
  amount: number;
  wallet?: string;
  slippageBps?: number;
}): Promise<BothQuotes> {
  const aggs: Aggregator[] = ["cookiebox", "cookiescan"];
  const settled = await Promise.allSettled(
    aggs.map(async (aggregator) => {
      const res = await callMcp({
        tool: "get_quote",
        wallet: opts.wallet,
        args: {
          inputMint: opts.inputMint,
          outputMint: opts.outputMint,
          amount: opts.amount,
          aggregator,
          ...(opts.slippageBps ? { slippageBps: opts.slippageBps } : {}),
        },
      });
      return { aggregator, raw: unwrapMcp(res) };
    }),
  );
  const views: QuoteView[] = [];
  const errors: string[] = [];
  for (const s of settled) {
    if (s.status === "rejected") {
      errors.push(s.reason instanceof Error ? s.reason.message : "quote failed");
      continue;
    }
    const v = toView(s.value.aggregator, s.value.raw);
    if (v) views.push(v);
    else errors.push(`${s.value.aggregator}: no quotable output`);
  }
  if (!views.length) {
    throw new Error(`No venue would quote this pair — ${errors.join("; ").slice(0, 200)}`);
  }
  views.sort((a, b) => scoreOf(b) - scoreOf(a));
  const [best, alt] = views;
  return alt && alt.out !== best.out ? { best, alt } : { best };
}
