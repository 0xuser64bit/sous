"use client";

import type { ChatMsg, TableData } from "@/lib/store/usePilotStore";
import { parseIntent } from "@/lib/intent";
import { QuoteTicket } from "./QuoteTicket";
import { SousMark } from "@/components/brand/SousMark";
import { shortAddr, fmtClock, isAddressLike } from "@/lib/utils/format";
import { txUrl, addressUrl } from "@/lib/chain/explorer";
import { CHAIN_META } from "@/lib/chain/config";

/**
 * The feed's presentation: one message, the ledger table it may carry, and
 * the empty-pass hero. Split out of ChatPanel, which was carrying dispatch,
 * wallet handling and 200 lines of markup in one file.
 */

/** Short word for the ticket header, derived from what the user typed. */
function kindLabel(text: string): string {
  const i = parseIntent(text);
  switch (i.kind) {
    case "swap":
      return "Swap";
    case "transfer":
      return "Send";
    case "stake":
      return "Stake";
    case "unstake":
      return "Unstake";
    case "limit":
      return "Limit";
    case "orders":
    case "cancel":
      return "Orders";
    case "bridge":
      return "Bridge";
    case "resolve":
      return "Names";
    case "search":
      return "Search";
    case "balance":
      return "Ledger";
    case "stake_info":
      return "Staking";
    case "help":
      return "Menu";
    default:
      return "Order";
  }
}

export function Message({
  msg,
  canFire,
  onFire,
  onDismiss,
  onConnect,
}: {
  msg: ChatMsg;
  canFire: boolean;
  onFire: (id: string) => void;
  onDismiss: (id: string) => void;
  onConnect: () => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="animate-ticket-in ml-auto max-w-[92%] sm:max-w-[88%]">
        <div
          className="mb-1 truncate text-right font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {/* Kind label is desktop-only: ticket number + clock is enough
              context on a 320px line. */}
          <span className="hidden min-[400px]:inline">
            No. {String(msg.ticketNo ?? 0).padStart(3, "0")} · {kindLabel(msg.text)} · {fmtClock(msg.ts)}
          </span>
          <span className="min-[400px]:hidden">
            No. {String(msg.ticketNo ?? 0).padStart(3, "0")} · {fmtClock(msg.ts)}
          </span>
        </div>
        <div
          className="rounded-[var(--radius-md)] px-3 py-2 text-[13.5px] leading-relaxed break-words"
          style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
        >
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.role === "system") {
    return (
      <div
        className="animate-ticket-in rounded-[var(--radius-md)] px-3 py-2 font-mono text-[12px] leading-relaxed break-words"
        style={{
          background: "var(--error-dim)",
          border: "1px solid #c46a5a44",
          color: "#d3918a",
        }}
      >
        {msg.text}
      </div>
    );
  }

  if (msg.quote) {
    return (
      <QuoteTicket
        msgId={msg.id}
        ticketNo={msg.ticketNo}
        ts={msg.ts}
        quote={msg.quote}
        canFire={canFire}
        onFire={onFire}
        onDismiss={onDismiss}
        onConnect={onConnect}
      />
    );
  }

  return (
    <div className="animate-ticket-in mr-auto flex max-w-full gap-2.5 sm:max-w-[92%]">
      <div className="mt-0.5 shrink-0">
        <SousMark size={20} />
      </div>
      <div className="min-w-0 flex-1">
        {msg.text ? (
          <p className="text-[13.5px] leading-relaxed break-words" style={{ color: "var(--text-secondary)" }}>
            {msg.text}
          </p>
        ) : null}
        {msg.table && <LedgerTable table={msg.table} />}
        {msg.signature && (
          <a
            href={txUrl(msg.signature)}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex min-h-[32px] items-center break-all font-mono text-[12px] tnum transition-opacity hover:opacity-70"
            style={{ color: "var(--copper-bright)" }}
          >
            {shortAddr(msg.signature, 6)} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function LedgerTable({ table }: { table: TableData }) {
  return (
    <div
      className="mt-2 overflow-hidden rounded-[var(--radius-md)]"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-baseline justify-between gap-2 px-3 pb-1 pt-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
          {table.title}
        </span>
        {table.subtitle && (
          <span className="font-mono text-[11px] tnum" style={{ color: "var(--text-secondary)" }}>
            {table.subtitle}
          </span>
        )}
      </div>
      <dl className="px-3 pb-2.5">
        {table.rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] py-1.5 text-[12.5px] first:border-t-0">
            <dt className="min-w-0 flex-1 truncate" style={{ color: "var(--text-secondary)" }} title={r.label}>
              {r.label}
            </dt>
            <dd className="max-w-[55%] shrink-0 truncate text-right font-mono tnum" style={{ color: "var(--text-primary)" }} title={r.value}>
              {isAddressLike(r.value) ? (
                <a
                  href={addressUrl(r.value)}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-opacity hover:opacity-70"
                  style={{ color: "var(--copper-bright)" }}
                  title={r.value}
                >
                  {shortAddr(r.value, 6)} ↗
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {table.more ? (
        <div className="px-3 pb-2 font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          +{table.more} more
        </div>
      ) : null}
    </div>
  );
}

/* ─── Empty pass — headline and proof, nothing to tap ──────────
   Example orders live as bubbles above the composer, not here. */

export function Hero({ connected }: { connected: boolean }) {
  return (
    <div className="animate-ticket-in flex flex-col items-center px-2 py-6 text-center sm:py-12">
      <SousMark size={40} />
      <p
        className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] sm:mt-5"
        style={{ color: "var(--text-tertiary)" }}
      >
        Conversational trading · Cookie Chain
      </p>
      <h1 className="font-display mt-3 max-w-md text-balance text-[clamp(1.75rem,8vw,2.5rem)] font-semibold leading-[1.08] sm:text-[40px]">
        The pass is open.
      </h1>
      <p className="mt-3 max-w-md text-balance text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Fire swaps, sends, stakes, and standing orders in plain words. Sous quotes it,
        you sign in Nightly, the chain serves in about a second.
      </p>

      {!connected && (
        <p className="mt-4 font-mono text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          ↑ connect Nightly above to fire — browsing is free
        </p>
      )}

      {/* Chain facts are desktop-only: three stats cost ~50px on a phone
          and repeat what the Market rail already shows live. */}
      <dl
        className="mt-8 hidden max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-3 font-mono text-[11px] tnum sm:flex"
        style={{ color: "var(--text-tertiary)" }}
      >
        <div className="flex flex-col gap-0.5">
          <dt className="uppercase tracking-[0.12em]">finality</dt>
          <dd style={{ color: "var(--text-secondary)" }}>{CHAIN_META.finality}</dd>
        </div>
        <span aria-hidden className="h-6 w-px" style={{ background: "var(--border)" }} />
        <div className="flex flex-col gap-0.5">
          <dt className="uppercase tracking-[0.12em]">avg fee</dt>
          <dd style={{ color: "var(--text-secondary)" }}>{CHAIN_META.avgFeeCook} COOK</dd>
        </div>
        <span aria-hidden className="h-6 w-px" style={{ background: "var(--border)" }} />
        <div className="flex flex-col gap-0.5">
          <dt className="uppercase tracking-[0.12em]">signer</dt>
          <dd style={{ color: "var(--text-secondary)" }}>Nightly</dd>
        </div>
      </dl>
    </div>
  );
}
