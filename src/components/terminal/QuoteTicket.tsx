"use client";

import type { QuoteData } from "@/lib/store/usePilotStore";
import { fmtClock } from "@/lib/utils/format";

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
  const { amount, from, to, outAmount, venue, impact, state, note } = quote;
  const dead = state === "fired" || state === "dismissed" || state === "failed";

  return (
    <article
      aria-label={`Order ticket ${ticketNo ?? ""} ${amount} ${from} to ${to}`}
      className="animate-ticket-in overflow-hidden rounded-[var(--radius-md)]"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-soft)" }}>
          Order{ticketNo ? ` No. ${String(ticketNo).padStart(3, "0")}` : ""} · Tasting
        </span>
        <span className="font-mono text-[10px] tnum" style={{ color: "var(--ink-faint)" }}>
          {fmtClock(ts)}
        </span>
      </div>

      {/* The dish */}
      <div className="px-4 pb-1 pt-2">
        <p className="font-display text-[22px] font-semibold leading-tight">
          {amount} {from} <span style={{ color: "var(--ink-faint)" }}>→</span> {to}
        </p>
      </div>

      {/* Line items */}
      <dl className="space-y-1.5 px-4 py-3 text-[12.5px]">
        <Line label="You fire" value={`${amount} ${from}`} strong />
        <Line label="You receive" value={outAmount ?? "—"} strong />
        <Line label="Venue" value={venue ?? "best of Cookiebox · Candy Shop"} />
        {impact && <Line label="Price impact" value={impact} />}
        <Line label="Est. fee" value="≈ 0.000005 COOK" />
      </dl>

      {note && (
        <p className="px-4 pb-2 font-mono text-[11px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          {note}
        </p>
      )}

      {/* Stamp */}
      {state === "fired" && <Stamp text="Served ✓" />}
      {state === "dismissed" && <Stamp text="Scrapped" muted />}
      {state === "failed" && <Stamp text="Burnt — see pass" muted />}

      {/* Actions */}
      {!dead && (
        <div className="flex gap-2 px-4 pb-4 pt-1">
          <button
            onClick={() => onFire(msgId)}
            disabled={state === "firing"}
            className="flex-1 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            {state === "firing" ? "Firing…" : "Fire order"}
          </button>
          <button
            onClick={() => onDismiss(msgId)}
            disabled={state === "firing"}
            className="rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
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
    <div className="flex items-end gap-2">
      <dt className="shrink-0" style={{ color: "var(--ink-soft)" }}>{label}</dt>
      <span aria-hidden className="leader mb-1 min-w-4 flex-1" />
      <dd className={`shrink-0 font-mono tnum ${strong ? "font-semibold" : ""}`} style={{ color: "var(--ink)" }}>
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
