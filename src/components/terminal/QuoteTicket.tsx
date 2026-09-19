"use client";

import type { OrderKind, QuoteData } from "@/lib/store/usePilotStore";
import { fmtClock } from "@/lib/utils/format";
import { CHAIN_META } from "@/lib/chain/config";

const KIND_WORD: Record<OrderKind, string> = {
  swap: "Tasting",
  transfer: "Sending",
  limit: "Standing order",
  stake: "Staking",
  unstake: "Unstaking",
  bridge: "Bridging",
};

/**
 * The paper ticket. Pinned to the dark pass, cream stock, ink text —
 * it should read like the slip the expo shouts from. Only used for
 * things that move money, so its appearance always means something.
 */
export function QuoteTicket({
  msgId,
  ticketNo,
  ts,
  quote,
  onFire,
  onDismiss,
}: {
  msgId: string;
  ticketNo?: number;
  ts: number;
  quote: QuoteData;
  onFire: (msgId: string) => void;
  onDismiss: (msgId: string) => void;
}) {
  const { orderKind, amount, from, to, detailLabel, detail, altQuote, outAmount, venue, impact, state, note, warning } = quote;
  const dead = state === "fired" || state === "dismissed" || state === "failed";

  return (
    <article
      aria-label={`Order ticket ${ticketNo ?? ""} ${amount} ${from} to ${to}`}
      className="animate-ticket-in overflow-hidden rounded-[var(--radius-md)]"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 px-3 pt-3 sm:px-4">
        <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-soft)" }}>
          Order{ticketNo ? ` No. ${String(ticketNo).padStart(3, "0")}` : ""} · {KIND_WORD[orderKind] ?? "Tasting"}
        </span>
        <span className="shrink-0 font-mono text-[10px] tnum" style={{ color: "var(--ink-faint)" }}>
          {fmtClock(ts)}
        </span>
      </div>

      {/* The dish */}
      <div className="px-3 pb-1 pt-2 sm:px-4">
        <p className="font-display text-balance break-words text-[20px] font-semibold leading-tight sm:text-[22px]">
          {amount} {from} <span style={{ color: "var(--ink-faint)" }}>→</span> {to}
        </p>
      </div>

      {/* Line items — only the ones that mean something for this order kind. */}
      <dl className="space-y-1.5 px-3 py-3 text-[12.5px] sm:px-4">
        <Line label="You fire" value={`${amount} ${from}`} strong />
        {outAmount && <Line label="You receive" value={outAmount} strong />}
        {detail && detailLabel && <Line label={detailLabel} value={detail} />}
        {venue && <Line label="Venue" value={venue} />}
        {/* Venue proof lives here on desktop; on phones it folds into the
            details row below so Fire stays near the fold. */}
        <div className="hidden sm:contents">
          {altQuote && <Line label="Also quoted" value={altQuote} />}
          {impact && <Line label="Price impact" value={impact} />}
        </div>
        {(altQuote || impact) && (
          <details className="sm:hidden">
            <summary
              className="flex min-h-[36px] cursor-pointer items-center font-mono text-[11px]"
              style={{ color: "var(--ink-soft)" }}
            >
              Why this venue?
            </summary>
            <div className="space-y-1.5 pb-0.5">
              {altQuote && <Line label="Also quoted" value={altQuote} />}
              {impact && <Line label="Price impact" value={impact} />}
            </div>
          </details>
        )}
        <Line label="Est. fee" value={`≈ ${CHAIN_META.avgFeeCook} COOK`} />
      </dl>

      {warning && (
        <p
          className="mx-3 mb-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[11px] leading-relaxed break-words sm:mx-4"
          style={{ background: "var(--warning-dim)", color: "var(--copper-deep)" }}
          role="note"
        >
          ⚠ {warning}
        </p>
      )}

      {note && (
        <p className="px-3 pb-2 font-mono text-[11px] leading-relaxed break-words sm:px-4" style={{ color: "var(--ink-soft)" }}>
          {note}
        </p>
      )}

      {/* Stamp */}
      {state === "fired" && <Stamp text="Served ✓" />}
      {state === "dismissed" && <Stamp text="Scrapped" muted />}
      {state === "failed" && <Stamp text="Burnt — see pass" muted />}

      {/* Actions */}
      {!dead && (
        <div className="flex gap-2 px-3 pb-4 pt-1 sm:px-4">
          <button
            onClick={() => onFire(msgId)}
            disabled={state === "firing"}
            className="flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 sm:min-h-0"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            {state === "firing" ? "Firing…" : "Fire order"}
          </button>
          <button
            onClick={() => onDismiss(msgId)}
            disabled={state === "firing"}
            className="flex min-h-[44px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] px-4 py-2 text-[13px] font-medium transition-opacity hover:opacity-70 disabled:opacity-40 sm:min-h-0 sm:px-3"
            style={{ color: "var(--ink-soft)", border: "1px solid var(--paper-faint)" }}
          >
            Pass
          </button>
        </div>
      )}

      {/* Tear-off edge */}
      <div className="ticket-perf" aria-hidden style={{ ["--perf" as string]: "var(--bg-base)" }} />
    </article>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0" style={{ color: "var(--ink-soft)" }}>{label}</dt>
      <span aria-hidden className="leader mb-1 min-w-3 flex-1 sm:min-w-4" />
      <dd
        className={`min-w-0 max-w-[58%] truncate text-right font-mono tnum ${strong ? "font-semibold" : ""}`}
        style={{ color: "var(--ink)" }}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function Stamp({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <div className="px-4 pb-3">
      <span
        className="inline-block -rotate-2 rounded-[3px] border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
        style={{
          borderColor: muted ? "var(--ink-faint)" : "var(--copper-deep)",
          color: muted ? "var(--ink-faint)" : "var(--copper-deep)",
        }}
      >
        {text}
      </span>
    </div>
  );
}
