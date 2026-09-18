"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  callMcp,
  isNeedsSignature,
  type NeedsSignature,
} from "@/lib/mcp/client";
import {
  usePilotStore,
  type ChatMsg,
  type TableData,
} from "@/lib/store/usePilotStore";
import { signAndSubmitNeedsSignature } from "@/lib/tx/signAndSend";
import { parseIntent, EXAMPLE_ORDERS, type Intent } from "@/lib/intent";
import { QuoteTicket } from "./QuoteTicket";
import { SousMark } from "@/components/brand/SousMark";
import { SousLoader } from "@/components/brand/SousLoader";
import {
  shortAddr,
  fmtClock,
  pickKey,
} from "@/lib/utils/format";
import { unwrapMcp, str, toRows } from "@/lib/mcp/shapes";
import { txUrl } from "@/lib/chain/explorer";
import { CHAIN_META } from "@/lib/chain/config";

/* ─── Tool args — one place to align with the cookie-mcp schema ─── */

function orderArgs(intent: { amount: number; from: string; to: string }) {
  return { from: intent.from, to: intent.to, amount: intent.amount };
}

/** The ticket number of the most recent user order. */
function lastTicketNo(): number | undefined {
  const msgs = usePilotStore.getState().messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && msgs[i].ticketNo !== undefined) {
      return msgs[i].ticketNo;
    }
  }
  return undefined;
}

/** pickKey rendered, or undefined when absent (so fallbacks trigger). */
function pickStr(o: Record<string, unknown>, names: string[]): string | undefined {
  const v = pickKey(o, names);
  return v === undefined || v === null ? undefined : str(v);
}
/** Refuse to sign when an itemized summary contradicts the order. */
function summaryMatches(
  summary: unknown,
  intent: { amount: number; from: string; to: string },
): { ok: boolean; detail?: string } {
  if (!summary || typeof summary !== "object") return { ok: true };
  const s = summary as Record<string, unknown>;
  const sFrom = pickKey(s, ["from", "input", "inMint", "src", "source", "sell"]);
  const sTo = pickKey(s, ["to", "output", "outMint", "dst", "dest", "buy"]);
  const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
  if (typeof sFrom === "string" && sFrom.toLowerCase() !== intent.from.toLowerCase()) {
    return { ok: false, detail: `summary says ${sFrom}, order says ${intent.from}` };
  }
  if (typeof sTo === "string" && sTo.toLowerCase() !== intent.to.toLowerCase()) {
    return { ok: false, detail: `summary says ${sTo}, order says ${intent.to}` };
  }
  if (sAmt !== undefined) {
    const n = Number(sAmt);
    if (Number.isFinite(n) && Math.abs(n - intent.amount) > 1e-9 * Math.max(1, intent.amount)) {
      return { ok: false, detail: `summary says ${n}, order says ${intent.amount}` };
    }
  }
  return { ok: true };
}

function errText(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Unknown error";
  if (/502|timeout|abort|fetch|network|sidecar|running\?/i.test(msg)) {
    return `${msg} — Sidecar down? Run: COOKIE_SIGNER=external npx -y cookie-mcp --http 8787`;
  }
  return msg;
}

function kindLabel(text: string): string {
  const i = parseIntent(text);
  switch (i.kind) {
    case "swap":
      return "Swap";
    case "stake":
      return "Stake";
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

const HELP_TEXT =
  "I fire swaps, read your ledger, and quote bCOOK staking. Try “Quote 10 COOK → bCOOK”, “Swap 5 COOK → USDC”, or “What is my balance?”. I quote first — nothing is signed until you fire the ticket in Nightly.";

/**
 * The pass. Orders go up as numbered tickets; quotes come back as paper;
 * money never moves without a signature in Nightly.
 */
export function ChatPanel() {
  const { publicKey, signTransaction } = useWallet();
  const messages = usePilotStore((s) => s.messages);
  const txPhase = usePilotStore((s) => s.txPhase);
  const push = usePilotStore((s) => s.push);
  const updateQuote = usePilotStore((s) => s.updateQuote);
  const setPhase = usePilotStore((s) => s.setPhase);
  const setSignature = usePilotStore((s) => s.setSignature);
  const setError = usePilotStore((s) => s.setError);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pendingTx = useRef(new Map<string, NeedsSignature>());

  const wallet = publicKey?.toBase58();

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function autosize() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }

  async function onSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    if (areaRef.current) areaRef.current.style.height = "auto";

    const intent: Intent = parseIntent(text);
    push({ role: "user", text });

    try {
      switch (intent.kind) {
        case "swap":
          await runSwap(intent);
          break;
        case "balance":
          await runBalance();
          break;
        case "stake_info":
          await runStakeInfo();
          break;
        case "stake":
          await runStake(intent.amount);
          break;
        case "help":
          push({ role: "assistant", text: HELP_TEXT });
          break;
        default:
          push({ role: "assistant", text: `I couldn't read that ticket, Chef. ${HELP_TEXT}` });
          break;
      }
    } catch (e) {
      const msg = errText(e);
      setError(msg);
      setPhase("failed");
      push({ role: "system", text: msg });
      toast.error("Order failed", { description: msg.slice(0, 120) });
    } finally {
      setBusy(false);
    }
  }

  function needWallet(): boolean {
    if (!publicKey || !signTransaction) {
      push({
        role: "system",
        text: "Connect Nightly first — I can't fire orders without your hand on the pass.",
      });
      return false;
    }
    return true;
  }

  async function runSwap(intent: { amount: number; from: string; to: string }) {
    if (!needWallet()) return;
    setPhase("quoting");
    const res = await callMcp({ tool: "get_quote", wallet, args: orderArgs(intent) });

    if (isNeedsSignature(res)) {
      // Executable quote — stash the payload, let the ticket fire it.
      const summary =
        typeof res.summary === "object" && res.summary !== null
          ? (res.summary as Record<string, unknown>)
          : null;
      const id = push({
        role: "assistant",
        text: "",
        ticketNo: lastTicketNo(),
        quote: {
          ...intent,
          outAmount: summary
            ? pickStr(summary, ["outAmount", "outputAmount", "amountOut", "toAmount"])
            : undefined,
          state: "proposed",
          note: "Executable quote — review the amounts, then fire.",
        },
      });
      pendingTx.current.set(id, res);
      setPhase("idle");
      return;
    }

    const q = unwrapMcp(res);
    const obj = q && typeof q === "object" ? (q as Record<string, unknown>) : null;
    push({
      role: "assistant",
      text: "",
      ticketNo: lastTicketNo(),
      quote: {
        ...intent,
        outAmount: obj
          ? pickStr(obj, ["outAmount", "outputAmount", "amountOut", "out", "receivedAmount", "toAmount"])
          : undefined,
        venue: obj
          ? pickStr(obj, ["venue", "aggregator", "dex", "source", "router"])
          : undefined,
        impact: obj ? pickStr(obj, ["priceImpact", "impact", "slippage"]) : undefined,
        state: "proposed",
        note: obj ? undefined : typeof q === "string" ? q.slice(0, 160) : "Quoted — amounts verified again at signing.",
      },
    });
    setPhase("idle");
  }

  async function onFire(msgId: string) {
    const msg = usePilotStore.getState().messages.find((m) => m.id === msgId);
    if (!msg?.quote || busy) return;
    const intent = { amount: msg.quote.amount, from: msg.quote.from, to: msg.quote.to };
    if (!needWallet()) return;

    setBusy(true);
    setError(null);
    updateQuote(msgId, { state: "firing" });
    try {
      let payload = pendingTx.current.get(msgId);
      if (!payload) {
        setPhase("quoting");
        const res = await callMcp({ tool: "trade", wallet, args: orderArgs(intent) });
        if (!isNeedsSignature(res)) {
          updateQuote(msgId, { state: "fired", note: "Filled directly by the sidecar." });
          push({ role: "assistant", text: `Served — ${intent.amount} ${intent.from} → ${intent.to}.` });
          setPhase("idle");
          return;
        }
        payload = res;
      }
      pendingTx.current.delete(msgId);

      const check = summaryMatches(payload.summary, intent);
      if (!check.ok) {
        throw new Error(`Refused to sign — ${check.detail ?? "summary mismatch"}.`);
      }

      setPhase("awaiting_signature");
      toast("Approve in Nightly", {
        description: `${intent.amount} ${intent.from} → ${intent.to} — check the amounts match.`,
      });
      const sig = await signAndSubmitNeedsSignature(payload, signTransaction!);
      setSignature(sig);
      setPhase("confirmed");
      updateQuote(msgId, { state: "fired" });
      push({
        role: "assistant",
        text: `Served — ${intent.amount} ${intent.from} → ${intent.to}.`,
        signature: sig,
      });
      toast.success(`Served · ${shortAddr(sig, 6)}`);
    } catch (e) {
      const msgText = errText(e);
      setError(msgText);
      setPhase("failed");
      updateQuote(msgId, { state: "failed" });
      push({ role: "system", text: msgText });
      toast.error("Order failed", { description: msgText.slice(0, 120) });
    } finally {
      setBusy(false);
    }
  }

  function onDismiss(msgId: string) {
    pendingTx.current.delete(msgId);
    updateQuote(msgId, { state: "dismissed" });
  }

  async function runBalance() {
    if (!wallet) {
      push({ role: "system", text: "Connect Nightly first — the ledger needs a wallet to read." });
      return;
    }
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "get_balance", wallet, args: {} });
      const { rows, more } = toRows(unwrapMcp(res));
      push({
        role: "assistant",
        text: "",
        table: {
          title: "Ledger",
          subtitle: shortAddr(wallet, 6),
          rows: rows.length ? rows : [{ label: "cook", value: "0" }],
          more,
        },
      });
    } finally {
      setPhase("idle");
    }
  }

  async function runStakeInfo() {
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "stake_info", args: {} });
      const { rows, more } = toRows(unwrapMcp(res), 6);
      push({
        role: "assistant",
        text: "",
        table: {
          title: "bCOOK Staking",
          subtitle: "Cookiebox liquid stake",
          rows: rows.length ? rows : [{ label: "status", value: "no data from sidecar" }],
          more,
        },
      });
    } finally {
      setPhase("idle");
    }
  }

  async function runStake(amount: number | null) {
    if (!needWallet()) return;
    if (amount === null) {
      await runStakeInfo();
      return;
    }
    setPhase("quoting");
    const res = await callMcp({ tool: "stake", wallet, args: { amount } });
    if (!isNeedsSignature(res)) {
      push({ role: "assistant", text: `Staked ${amount} COOK — ${str(unwrapMcp(res))}` });
      setPhase("idle");
      return;
    }
    const check = summaryMatches(res.summary, { amount, from: "COOK", to: "bCOOK" });
    if (!check.ok) throw new Error(`Refused to sign — ${check.detail ?? "summary mismatch"}.`);
    setPhase("awaiting_signature");
    toast("Approve in Nightly", { description: `Stake ${amount} COOK → bCOOK.` });
    const sig = await signAndSubmitNeedsSignature(res, signTransaction!);
    setSignature(sig);
    setPhase("confirmed");
    push({ role: "assistant", text: `Served — staked ${amount} COOK.`, signature: sig });
    toast.success(`Served · ${shortAddr(sig, 6)}`);
  }

  const showHero = messages.length <= 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Feed */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {showHero ? (
            <Hero
              onOrder={(o) => void onSend(o)}
              disabled={busy}
              connected={Boolean(publicKey)}
            />
          ) : (
            messages.map((m) => (
              <Message
                key={m.id}
                msg={m}
                onFire={onFire}
                onDismiss={onDismiss}
              />
            ))
          )}
          {busy && (
            <div className="animate-ticket-in">
              <SousLoader step={txPhase === "quoting" ? 0 : 1} />
            </div>
          )}
        </div>
      </div>

      {/* Dock */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {!showHero && (
            <div className="flex flex-wrap gap-1.5" aria-label="Suggestions">
              {EXAMPLE_ORDERS.map((o) => (
                <button
                  key={o}
                  onClick={() => void onSend(o)}
                  disabled={busy}
                  className="rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors disabled:opacity-40"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="order-input" className="sr-only">
              Fire an order
            </label>
            <textarea
              id="order-input"
              ref={areaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autosize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              placeholder={
                publicKey ? "Order anything — “Quote 10 COOK → bCOOK”…" : "Connect Nightly, then order…"
              }
              disabled={busy}
              className="max-h-[132px] flex-1 resize-none rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:text-[var(--text-tertiary)] disabled:opacity-50"
              style={{
                background: "var(--bg-inset)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--copper-line)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            />
            <button
              onClick={() => void onSend()}
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-[var(--radius-md)] px-4 py-2.5 text-[13.5px] font-semibold transition-opacity disabled:opacity-30"
              style={{ background: "var(--copper)", color: "#1d1206" }}
            >
              Fire
            </button>
          </div>
          <p className="font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
            {publicKey
              ? "quoted first · signed in Nightly · settled ~1s"
              : "read-only until Nightly connects"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Messages ─────────────────────────────────────────────── */

function Message({
  msg,
  onFire,
  onDismiss,
}: {
  msg: ChatMsg;
  onFire: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="animate-ticket-in ml-auto max-w-[88%]">
        <div
          className="mb-1 text-right font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          No. {String(msg.ticketNo ?? 0).padStart(3, "0")} · {kindLabel(msg.text)} · {fmtClock(msg.ts)}
        </div>
        <div
          className="rounded-[var(--radius-md)] px-3 py-2 text-[13.5px] leading-relaxed"
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
        className="animate-ticket-in rounded-[var(--radius-md)] px-3 py-2 font-mono text-[12px] leading-relaxed"
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
        onFire={onFire}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <div className="animate-ticket-in mr-auto flex max-w-[92%] gap-2.5">
      <div className="mt-0.5 shrink-0">
        <SousMark size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {msg.text}
        </p>
        {msg.table && <LedgerTable table={msg.table} />}
        {msg.signature && (
          <a
            href={txUrl(msg.signature)}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block font-mono text-[12px] tnum transition-opacity hover:opacity-70"
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
        {table.rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] py-1.5 text-[12.5px] first:border-t-0">
            <dt className="min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
              {r.label}
            </dt>
            <dd className="shrink-0 font-mono tnum" style={{ color: "var(--text-primary)" }}>
              {r.value}
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

/* ─── Empty pass — the landing page inside the product ─────── */

function Hero({
  onOrder,
  disabled,
  connected,
}: {
  onOrder: (o: string) => void;
  disabled: boolean;
  connected: boolean;
}) {
  return (
    <div className="animate-ticket-in flex flex-col items-center py-8 text-center sm:py-12">
      <SousMark size={44} />
      <p
        className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.18em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Conversational trading · Cookie Chain
      </p>
      <h1 className="font-display mt-3 max-w-md text-[34px] font-semibold leading-[1.08] sm:text-[40px]">
        The pass is open.
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Fire swaps, stakes, and orders in plain words. Sous quotes it,
        you sign in Nightly, the chain serves in about a second.
      </p>

      <div className="mt-6 flex w-full max-w-md flex-col gap-2" aria-label="Example orders">
        {EXAMPLE_ORDERS.map((o, i) => (
          <button
            key={o}
            onClick={() => onOrder(o)}
            disabled={disabled}
            className="group flex items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 text-left transition-colors disabled:opacity-40"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--copper-line)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <span className="font-mono text-[11px] tnum" style={{ color: "var(--copper-bright)" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-[13.5px]" style={{ color: "var(--text-primary)" }}>
              “{o}”
            </span>
            <span aria-hidden style={{ color: "var(--text-tertiary)" }}>→</span>
          </button>
        ))}
      </div>

      {!connected && (
        <p className="mt-4 font-mono text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          ↑ connect Nightly above to fire — browsing is free
        </p>
      )}

      <dl
        className="mt-8 flex items-center gap-5 font-mono text-[11px] tnum"
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
