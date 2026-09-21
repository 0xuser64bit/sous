/**
 * Normalizer for the `summary` block on a cookie-mcp `needs_signature`
 * payload.
 *
 * The sidecar does not use one shape. Captured live from cookie-mcp 0.5.0:
 *
 *   trade              { aggregator, input:{mint,symbol,amount},
 *                        output:{mint,symbol,expectedAmount,minAmount},
 *                        slippageBps }
 *   transfer           { to, mint, symbol, amount }
 *   place_limit_order  { kind, inputMint, outputMint, amount, order }
 *   bridge (step 1)    { creates, recipient, tokenAccount }
 *   stake / unstake    (absent entirely)
 *
 * Reading those with one flat `pickKey` sweep silently finds nothing on the
 * nested ones — which is how the swap sign-guard came to be a no-op. Every
 * consumer goes through this normalizer instead, so a new shape is one change
 * in one file.
 */
import { pickKey } from "@/lib/utils/format";

export type SignSummary = {
  /** Input mint when the summary names one (flat or nested). */
  inMint?: string;
  inSymbol?: string;
  /** Input amount in UI units. */
  inAmount?: number;
  outMint?: string;
  outSymbol?: string;
  /** Expected output in UI units, as the sidecar computed it at build time. */
  expectedOut?: number;
  /** Guaranteed floor: the least the transaction can pay out. */
  minOut?: number;
  /** Slippage cap encoded in the transaction, in basis points. */
  slippageBps?: number;
  /** Limit/stop price, when the tool carries one. */
  price?: number;
  /** `limit` | `stop` for order placements. */
  orderKind?: string;
  /** Destination of a transfer, already resolved from any `.cook` name. */
  to?: string;
  /** True when the payload carried no summary at all. */
  absent: boolean;
};

function numOf(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strOf(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function leg(
  o: Record<string, unknown>,
  nested: string[],
): Record<string, unknown> | undefined {
  const v = pickKey(o, nested);
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/**
 * Read any sidecar summary into one shape. Absent fields stay `undefined`
 * — callers must treat that as "the sidecar said nothing", never as zero.
 */
export function readSummary(summary: unknown): SignSummary {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return { absent: true };
  }
  const s = summary as Record<string, unknown>;
  const input = leg(s, ["input"]);
  const output = leg(s, ["output"]);

  return {
    absent: false,
    inMint:
      strOf(pickKey(s, ["inputMint", "inMint"])) ??
      (input ? strOf(pickKey(input, ["mint"])) : undefined) ??
      // `transfer` names the asset plainly as `mint`; only trust that key
      // when there is no explicit input leg to confuse it with.
      (input ? undefined : strOf(pickKey(s, ["mint"]))),
    inSymbol:
      (input ? strOf(pickKey(input, ["symbol"])) : undefined) ??
      strOf(pickKey(s, ["symbol", "inputSymbol"])),
    inAmount:
      numOf(pickKey(s, ["amount", "inAmount", "quantity"])) ??
      (input ? numOf(pickKey(input, ["amount", "uiAmount"])) : undefined),
    outMint:
      strOf(pickKey(s, ["outputMint", "outMint"])) ??
      (output ? strOf(pickKey(output, ["mint"])) : undefined),
    outSymbol:
      (output ? strOf(pickKey(output, ["symbol"])) : undefined) ??
      strOf(pickKey(s, ["outputSymbol"])),
    expectedOut:
      (output
        ? numOf(pickKey(output, ["expectedAmount", "expectedOut", "outAfterFee", "amount"]))
        : undefined) ?? numOf(pickKey(s, ["expectedOut", "expectedAmount", "outAmount"])),
    minOut:
      (output ? numOf(pickKey(output, ["minAmount", "minOut", "minimumOut"])) : undefined) ??
      numOf(pickKey(s, ["minOut", "minAmount", "minimumOut"])),
    slippageBps: numOf(pickKey(s, ["slippageBps", "slippage_bps"])),
    price: numOf(pickKey(s, ["price", "limitPrice", "triggerPrice", "trigger"])),
    orderKind: strOf(pickKey(s, ["kind", "orderKind"])),
    to: strOf(pickKey(s, ["to", "dest", "destination", "recipient", "address", "owner"])),
  };
}
