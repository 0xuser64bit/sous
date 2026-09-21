/**
 * Turning a parsed intent into a paper ticket.
 *
 * Kept out of the chat component on purpose: this is where a user's words
 * become the exact `{tool, args}` that will build a transaction, and it is
 * the part worth testing. The component's job is to render what comes back
 * and to own the wallet; it should not also be deciding whether a mint
 * rides in the arguments.
 *
 * Nothing here touches React, the store, or the DOM.
 */
import { resolveMint, type TokenMeta } from "@/lib/mcp/tokens";
import { quoteBoth } from "@/lib/mcp/quotes";
import { callMcp } from "@/lib/mcp/client";
import { balanceOf } from "@/lib/mcp/shapes";
import { BCOOK_MINT, NATIVE_COOK_MINT } from "@/lib/chain/config";
import { bpsLabel, numOrUndef, shortAddr, trimAmount, isAddressLike } from "@/lib/utils/format";
import type { QuoteData } from "@/lib/store/usePilotStore";
import type {
  BridgeIntent,
  LimitIntent,
  StakeIntent,
  SwapIntent,
  TransferIntent,
  UnstakeIntent,
} from "@/lib/intent";

/** A ticket to post, or a sentence to say instead. */
export type TicketDraft =
  | { kind: "ticket"; quote: Omit<QuoteData, "state">; preflight?: TokenMeta }
  | { kind: "say"; text: string };

const say = (text: string): TicketDraft => ({ kind: "say", text });

/** First address-looking string anywhere in a value. */
export function findAddress(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return isAddressLike(t) ? t : null;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const val of Object.values(v as Record<string, unknown>)) {
      const hit = findAddress(val);
      if (hit) return hit;
    }
  }
  return null;
}

/** The warp route has exactly two ends, and only understands these words. */
export function bridgeDirection(toChain: string): "cookie-to-solana" | "solana-to-cookie" | null {
  const c = toChain.toLowerCase();
  if (c.startsWith("sol")) return "cookie-to-solana";
  if (c.startsWith("cook")) return "solana-to-cookie";
  return null;
}

export async function buildSwapTicket(
  intent: SwapIntent,
  wallet?: string,
): Promise<TicketDraft> {
  const [inMeta, outMeta] = await Promise.all([
    resolveMint(intent.from, wallet),
    resolveMint(intent.to, wallet),
  ]);
  const { best, alt } = await quoteBoth({
    inputMint: inMeta.mint,
    outputMint: outMeta.mint,
    amount: intent.amount,
    wallet,
  });
  return {
    kind: "ticket",
    preflight: inMeta,
    quote: {
      orderKind: "swap",
      amount: intent.amount,
      from: inMeta.symbol,
      to: outMeta.symbol,
      expectFrom: inMeta.mint,
      expectTo: outMeta.mint,
      outAmount: `${trimAmount(best.out)} ${outMeta.symbol}`,
      // The estimate is not a promise: the floor is what the transaction
      // guarantees, so it goes on the ticket next to the estimate.
      minOutLabel: best.minOut
        ? `${trimAmount(best.minOut)} ${outMeta.symbol}${
            best.slippageBps !== undefined ? ` · ${bpsLabel(best.slippageBps)} slippage` : ""
          }`
        : undefined,
      aggFeeLabel: best.feeAmount
        ? `${trimAmount(best.feeAmount)} ${outMeta.symbol}${
            best.feeBps !== undefined ? ` · ${bpsLabel(best.feeBps)}` : ""
          }`
        : undefined,
      venue: best.venue ? `${best.aggregator} · ${best.venue}` : best.aggregator,
      altQuote: alt ? `${alt.aggregator} ${trimAmount(alt.out)}` : undefined,
      impact: best.impact,
      warning: best.warnings?.join(" "),
      // Reference points the sign-guard compares the fire-time re-quote to.
      quotedOut: numOrUndef(best.out),
      quotedMinOut: numOrUndef(best.minOut),
      slippageBps: best.slippageBps,
      fireTool: "trade",
      fireArgs: {
        inputMint: inMeta.mint,
        outputMint: outMeta.mint,
        amount: intent.amount,
        aggregator: best.aggregator,
      },
      note: alt
        ? `Best of two venues — the other quoted ${trimAmount(alt.out)}.`
        : "Single venue answered — quoted alone.",
    },
  };
}

export async function buildTransferTicket(
  intent: TransferIntent,
  wallet?: string,
): Promise<TicketDraft> {
  const meta = await resolveMint(intent.token, wallet);
  return {
    kind: "ticket",
    preflight: meta,
    quote: {
      orderKind: "transfer",
      amount: intent.amount,
      from: meta.symbol,
      to: intent.to,
      expectFrom: meta.mint,
      fireTool: "transfer",
      // Native COOK travels without `mint`; SPL needs it.
      fireArgs: meta.native
        ? { to: intent.to, amount: intent.amount }
        : { to: intent.to, amount: intent.amount, mint: meta.mint },
      note: "Review the destination — sends cannot be undone.",
    },
  };
}

export function buildStakeTicket(intent: StakeIntent & { amount: number }): TicketDraft {
  return {
    kind: "ticket",
    preflight: { mint: NATIVE_COOK_MINT, symbol: "COOK", native: true },
    quote: {
      orderKind: "stake",
      amount: intent.amount,
      from: "COOK",
      to: "bCOOK",
      fireTool: "stake",
      fireArgs: { amount: intent.amount },
      note: "Liquid-staked via Cookiebox — you get bCOOK back.",
    },
  };
}

export function buildUnstakeTicket(intent: UnstakeIntent & { amount: number }): TicketDraft {
  return {
    kind: "ticket",
    preflight: { mint: BCOOK_MINT, symbol: "bCOOK", native: false },
    quote: {
      orderKind: "unstake",
      amount: intent.amount,
      from: "bCOOK",
      to: "COOK",
      fireTool: "unstake",
      fireArgs: { amount: intent.amount },
      note: "Redeemed through the stake pool — a withdraw fee applies.",
    },
  };
}

export async function buildLimitTicket(
  intent: LimitIntent,
  wallet?: string,
): Promise<TicketDraft> {
  const [inMeta, outMeta] = await Promise.all([
    resolveMint(intent.from, wallet),
    resolveMint(intent.to, wallet),
  ]);
  return {
    kind: "ticket",
    preflight: inMeta,
    quote: {
      orderKind: "limit",
      amount: intent.amount,
      from: inMeta.symbol,
      to: outMeta.symbol,
      expectFrom: inMeta.mint,
      expectTo: outMeta.mint,
      detailLabel: intent.orderKind === "stop" ? "Stop trigger" : "Limit price",
      detail: `@ ${intent.price} ${outMeta.symbol} per ${inMeta.symbol}`,
      fireTool: "place_limit_order",
      fireArgs: {
        inputMint: inMeta.mint,
        outputMint: outMeta.mint,
        amount: intent.amount,
        price: intent.price,
        kind: intent.orderKind,
      },
      note:
        intent.orderKind === "stop"
          ? "Stop-market: the keeper sells at market once the rate falls here."
          : "Rests as a standing order until filled, cancelled, or expired.",
    },
  };
}

export async function buildBridgeTicket(
  intent: BridgeIntent,
  opts: { wallet?: string; rawText: string },
): Promise<TicketDraft> {
  // The warp route only speaks COOK, 1:1.
  const meta = await resolveMint(intent.token, opts.wallet);
  if (!meta.native) {
    return say(
      `The bridge only carries native COOK, Chef — ${meta.symbol} can't ride it. Swap to COOK first, then bridge.`,
    );
  }
  const direction = bridgeDirection(intent.toChain);
  if (!direction) {
    return say(
      "I only see two ends of that bridge, Chef — “solana” or “cookie”. Where should the COOK land?",
    );
  }
  const dest = findAddress(opts.rawText);
  return {
    kind: "ticket",
    quote: {
      orderKind: "bridge",
      amount: intent.amount,
      from: "COOK",
      to: intent.toChain,
      expectFrom: NATIVE_COOK_MINT,
      detailLabel: "Route",
      detail: `Cookie Chain → ${intent.toChain}${dest ? ` · ${shortAddr(dest, 6)}` : ""}`,
      fireTool: "bridge",
      fireArgs: {
        direction,
        amount: intent.amount,
        ...(dest ? { to: dest } : {}),
      },
      note: "Bridges settle on the far chain in minutes — slower than a swap.",
    },
  };
}

/**
 * Funds check for any ticket that spends a token. Runs after the ticket
 * posts so it never delays the quote, and returns a warning to pin on it.
 * Silent on any failure — fire-time simulation stays the backstop; this only
 * moves the diagnosis to before the wallet opens.
 *
 * Worth the wiring: an unfunded wallet fails simulation with the sidecar's
 * "Swap simulation failed. AccountNotFound — check the inputs; if it
 * persists the service may be degraded", which blames the inputs and the
 * service for what is simply an empty pantry.
 */
export async function fundsPreflight(
  meta: TokenMeta,
  amount: number,
  wallet?: string,
): Promise<string | null> {
  if (!wallet) return null;
  try {
    const res = await callMcp({ tool: "get_balance", wallet, args: { wallet } });
    const bal = balanceOf(res, meta.symbol);
    if (bal === null) return null;
    if (bal < amount) {
      return `Light pantry — you hold ${trimAmount(bal)} ${meta.symbol}, but this fires ${amount}. It will fail simulation until you top up.`;
    }
    if (meta.native && bal - amount < 0.001) {
      return `Nearly your whole balance — nothing stays for fees. Fire a touch less than ${trimAmount(bal)} ${meta.symbol}.`;
    }
    return null;
  } catch {
    return null;
  }
}
