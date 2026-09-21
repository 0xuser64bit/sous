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
  /** What the user actually receives: net of the aggregator's cut. */
  out: string;
  /** Before that cut, when the venue reports both. */
  grossOut?: string;
  /**
   * The least this swap can pay out at the quoted slippage cap. This is the
   * only number the transaction actually guarantees — `out` is an estimate.
   */
  minOut?: string;
  /** Aggregator fee, denominated in the OUTPUT token, and its rate in bps. */
  feeAmount?: string;
  feeBps?: number;
  /** Slippage cap encoded into the swap, in basis points. */
  slippageBps?: number;
  venue?: string;
  impact?: string;
  /** Token-2022 transfer-hook cautions (one per hooked mint), if any. */
  warnings?: string[];
  raw: Record<string, unknown>;
};

/** Token-2022 transfer-hook warnings: issuer code runs on every transfer and
 * can reject it. get_quote returns them only for hooked mints — surface so the
 * user reads before signing. */
function warningsOf(raw: Record<string, unknown>): string[] | undefined {
  const w = pickKey(raw, ["warnings", "routeWarnings"]);
  if (!Array.isArray(w) || !w.length) return undefined;
  const lines = w
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const detail = pickKey(o, ["detail", "message", "title", "reason"]);
        return typeof detail === "string" ? detail : undefined;
      }
      return undefined;
    })
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  return lines.length ? lines : undefined;
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function outOf(raw: Record<string, unknown>): {
  out?: string;
  gross?: string;
  min?: string;
} {
  const o = pickKey(raw, ["output"]);
  const src = o && typeof o === "object" ? (o as Record<string, unknown>) : raw;
  const pick = (names: string[]) => {
    const v = pickKey(src, names);
    return v === undefined || v === null ? undefined : String(v);
  };
  const gross = pick([
    "expectedOut",
    "expectedAmount",
    "outAmount",
    "outputAmount",
    "amountOut",
    "out",
    "receivedAmount",
    "toAmount",
  ]);
  // Quote the net figure whenever the venue reports one: the aggregator's cut
  // comes out of the output, so `expectedOut` is not what lands in the wallet.
  return {
    out: pick(["outAfterFee"]) ?? gross,
    gross,
    min: pick(["minOut", "minAmount", "minimumOut"]),
  };
}

function feeOf(raw: Record<string, unknown>): { amount?: string; bps?: number } {
  const f = pickKey(raw, ["aggregatorFee", "fee"]);
  if (!f || typeof f !== "object" || Array.isArray(f)) return {};
  const o = f as Record<string, unknown>;
  const amount = pickKey(o, ["amount", "uiAmount"]);
  const bps = numOrNull(pickKey(o, ["bps", "feeBps"]));
  return {
    amount: amount === undefined || amount === null ? undefined : String(amount),
    bps: bps ?? undefined,
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

/** Rank venues on what the user actually receives, not the gross estimate. */
function scoreOf(v: QuoteView): number {
  return numOrNull(v.out) ?? Number.NEGATIVE_INFINITY;
}

function toView(aggregator: Aggregator, raw: unknown): QuoteView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const { out, gross, min } = outOf(o);
  if (!out) return null;
  const f = extractQuoteFields(o);
  const fee = feeOf(o);
  return {
    aggregator,
    out,
    grossOut: gross !== out ? gross : undefined,
    minOut: min,
    feeAmount: fee.amount,
    feeBps: fee.bps,
    slippageBps: numOrNull(pickKey(o, ["slippageBps", "slippage_bps"])) ?? undefined,
    venue: f.venue,
    impact: f.impact,
    warnings: warningsOf(o),
    raw: o,
  };
}

export type BothQuotes = {
  best: QuoteView;
  /** The losing quote, shown for honesty when both venues answer. */
  alt?: QuoteView;
};

/**
 * Quote BOTH aggregators. One failing venue never kills
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
