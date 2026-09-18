"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  callMcp,
  isNeedsSignature,
  type McpTool,
  type NeedsSignature,
} from "@/lib/mcp/client";
import {
  usePilotStore,
  type ChatMsg,
  type QuoteData,
  type TableData,
} from "@/lib/store/usePilotStore";
import {
  signAndSubmitNeedsSignature,
  signMessageNeedsSignature,
  TxError,
} from "@/lib/tx/signAndSend";
import { parseIntent, EXAMPLE_ORDERS, type Intent } from "@/lib/intent";
import { QuoteTicket } from "./QuoteTicket";
import { SousMark } from "@/components/brand/SousMark";
import { SousLoader } from "@/components/brand/SousLoader";
import {
  shortAddr,
  fmtClock,
  pickKey,
  isAddressLike,
} from "@/lib/utils/format";
import { unwrapMcp, str, toRows } from "@/lib/mcp/shapes";
import { txUrl, addressUrl } from "@/lib/chain/explorer";
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

function numOf(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function amountsMatch(a: unknown, b: number): boolean {
  const n = numOf(a);
  if (n === null) return true; // key absent or unreadable — nothing to contradict
  return Math.abs(n - b) <= 1e-9 * Math.max(1, b);
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
  if (sAmt !== undefined && !amountsMatch(sAmt, intent.amount)) {
    return { ok: false, detail: `summary says ${sAmt}, order says ${intent.amount}` };
  }
  return { ok: true };
}

function transferMatches(
  summary: unknown,
  intent: { amount: number; token: string; to: string },
): { ok: boolean; detail?: string } {
  if (!summary || typeof summary !== "object") return { ok: true };
  const s = summary as Record<string, unknown>;
  const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
  const sTok = pickKey(s, ["token", "mint", "symbol", "currency"]);
  const sTo = pickKey(s, ["to", "dest", "destination", "recipient", "address", "owner"]);
  if (sAmt !== undefined && !amountsMatch(sAmt, intent.amount)) {
    return { ok: false, detail: `summary says ${sAmt}, order says ${intent.amount}` };
  }
  if (typeof sTok === "string" && sTok.toLowerCase() !== intent.token.toLowerCase()) {
    return { ok: false, detail: `summary says ${sTok}, order says ${intent.token}` };
  }
  if (typeof sTo === "string") {
    const a = sTo.trim().replace(/[.,;!?)]+$/, "");
    const b = intent.to.trim();
    if (a !== b && a.toLowerCase() !== b.toLowerCase()) {
      return { ok: false, detail: `summary pays ${a}, order pays ${b}` };
    }
  }
  return { ok: true };
}

/** Guard every ticket kind before the wallet ever sees it. */
function guardSummary(
  summary: unknown,
  q: QuoteData,
): { ok: boolean; detail?: string } {
  switch (q.orderKind) {
    case "transfer":
      return transferMatches(summary, { amount: q.amount, token: q.from, to: q.to });
    case "bridge": {
      // Destinations are chain-side addresses — only amount + token are stable.
      if (!summary || typeof summary !== "object") return { ok: true };
      const s = summary as Record<string, unknown>;
      const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
      const sTok = pickKey(s, ["from", "token", "mint", "symbol", "input"]);
      if (sAmt !== undefined && !amountsMatch(sAmt, q.amount)) {
        return { ok: false, detail: `summary says ${sAmt}, order says ${q.amount}` };
      }
      if (typeof sTok === "string" && sTok.toLowerCase() !== q.from.toLowerCase()) {
        return { ok: false, detail: `summary says ${sTok}, order says ${q.from}` };
      }
      return { ok: true };
    }
    case "limit": {
      const base = summaryMatches(summary, q);
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
      return summaryMatches(summary, q);
  }
}

function errText(e: unknown): string {
  if (e instanceof TxError && e.code === "expired") return e.message;
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

function servedText(q: QuoteData): string {
  switch (q.orderKind) {
    case "transfer":
      return `Sent — ${q.amount} ${q.from} → ${q.to}.`;
    case "limit":
      return `Standing order placed — ${q.amount} ${q.from} → ${q.to} ${q.detail ?? ""}.`;
    case "stake":
      return `Served — staked ${q.amount} COOK.`;
    case "unstake":
      return `Served — unstaked ${q.amount} bCOOK.`;
    case "bridge":
      return `Bridging — ${q.amount} ${q.from} → ${q.to}. Track it with “bridge status”.`;
    default:
      return `Served — ${q.amount} ${q.from} → ${q.to}.`;
  }
}

/** First address-looking string in a payload, one level deep. */
function findAddress(v: unknown): string | null {
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

const HELP_TEXT =
  "I fire swaps, sends, stakes, limit orders, and bridge quotes — and I read your ledger, tokens, and .cook names. Try “Quote 10 COOK → bCOOK”, “Send 2 COOK to alice.cook”, or “Limit buy 5 COOK → USDC at 0.5”. I quote first — nothing is signed until you fire the ticket in Nightly.";

/**
 * The pass. Orders go up as numbered tickets; quotes come back as paper;
 * money never moves without a signature in Nightly.
 */
export function ChatPanel() {
  const { publicKey, signTransaction, signMessage } = useWallet();
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
        case "transfer":
          await proposeTicket({
            orderKind: "transfer",
            amount: intent.amount,
            from: intent.token,
            to: intent.to,
            fireTool: "transfer",
            fireArgs: { amount: intent.amount, token: intent.token, to: intent.to },
            note: "Review the destination — sends cannot be undone.",
          });
          break;
        case "stake":
          if (intent.amount === null) await runStakeInfo();
          else
            await proposeTicket({
              orderKind: "stake",
              amount: intent.amount,
              from: "COOK",
              to: "bCOOK",
              fireTool: "stake",
              fireArgs: { amount: intent.amount },
              note: "Liquid-staked via Cookiebox — you get bCOOK back.",
            });
          break;
        case "unstake":
          if (intent.amount === null) {
            await runStakeInfo("How much should I unstake, Chef? e.g. “Unstake 5”.");
          } else
            await proposeTicket({
              orderKind: "unstake",
              amount: intent.amount,
              from: "bCOOK",
              to: "COOK",
              fireTool: "unstake",
              fireArgs: { amount: intent.amount },
            });
          break;
        case "limit":
          await proposeTicket({
            orderKind: "limit",
            amount: intent.amount,
            from: intent.from,
            to: intent.to,
            detailLabel: "Limit price",
            detail: `@ ${intent.price} ${intent.to} per ${intent.from}`,
            fireTool: "place_limit_order",
            fireArgs: {
              from: intent.from,
              to: intent.to,
              amount: intent.amount,
              price: intent.price,
            },
            note: "Rests as a standing order until filled, cancelled, or expired.",
          });
          break;
        case "orders":
          await runOrders();
          break;
        case "cancel":
          await runCancel(intent.orderId);
          break;
        case "bridge":
          await proposeTicket({
            orderKind: "bridge",
            amount: intent.amount,
            from: intent.token,
            to: intent.toChain,
            detailLabel: "Route",
            detail: `Cookie Chain → ${intent.toChain}`,
            fireTool: "bridge",
            fireArgs: { amount: intent.amount, token: intent.token, toChain: intent.toChain },
            note: "Bridges settle on the far chain — slower than a swap. Track with “bridge status”.",
          });
          break;
        case "resolve":
          await runResolve(intent.name);
          break;
        case "search":
          await runSearch(intent.query);
          break;
        case "balance":
          await runBalance();
          break;
        case "stake_info":
          await runStakeInfo();
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

  function proposeTicket(q: Omit<QuoteData, "state">): string {
    return push({
      role: "assistant",
      text: "",
      ticketNo: lastTicketNo(),
      quote: { ...q, state: "proposed" },
    });
  }

  async function runSwap(intent: { amount: number; from: string; to: string }) {
    if (!needWallet()) return;
    setPhase("quoting");
    const fireTool: McpTool = "trade";
    const fireArgs = orderArgs(intent);
    const res = await callMcp({ tool: "get_quote", wallet, args: fireArgs });

    if (isNeedsSignature(res)) {
      // Executable quote — stash the payload, let the ticket fire it.
      const summary =
        typeof res.summary === "object" && res.summary !== null
          ? (res.summary as Record<string, unknown>)
          : null;
      const id = proposeTicket({
        orderKind: "swap",
        ...intent,
        outAmount: summary
          ? pickStr(summary, ["outAmount", "outputAmount", "amountOut", "toAmount"])
          : undefined,
        fireTool,
        fireArgs,
        note: "Executable quote — review the amounts, then fire.",
      });
      pendingTx.current.set(id, res);
      setPhase("idle");
      return;
    }

    const q = unwrapMcp(res);
    const obj = q && typeof q === "object" ? (q as Record<string, unknown>) : null;
    proposeTicket({
      orderKind: "swap",
      ...intent,
      outAmount: obj
        ? pickStr(obj, ["outAmount", "outputAmount", "amountOut", "out", "receivedAmount", "toAmount"])
        : undefined,
      venue: obj ? pickStr(obj, ["venue", "aggregator", "dex", "source", "router"]) : undefined,
      impact: obj ? pickStr(obj, ["priceImpact", "impact", "slippage"]) : undefined,
      fireTool,
      fireArgs,
      note: obj ? undefined : typeof q === "string" ? q.slice(0, 160) : "Quoted — amounts verified again at signing.",
    });
    setPhase("idle");
  }

  async function onFire(msgId: string) {
    const msg = usePilotStore.getState().messages.find((m) => m.id === msgId);
    if (!msg?.quote || busy) return;
    const q = msg.quote;
    if (!needWallet()) return;

    setBusy(true);
    setError(null);
    updateQuote(msgId, { state: "firing" });
    try {
      let payload = pendingTx.current.get(msgId);
      if (!payload) {
        setPhase("quoting");
        const res = await callMcp({ tool: q.fireTool, wallet, args: q.fireArgs });
        if (!isNeedsSignature(res)) {
          updateQuote(msgId, { state: "fired", note: "Filled directly by the sidecar." });
          push({ role: "assistant", text: servedText(q) });
          setPhase("idle");
          return;
        }
        payload = res;
      }
      pendingTx.current.delete(msgId);

      if (payload.kind === "message") {
        if (!signMessage) throw new TxError("failed", "This wallet cannot sign messages.");
        setPhase("awaiting_signature");
        const text = payload.message ?? payload.next ?? q.fireTool;
        const sig = await signMessageNeedsSignature(text, (bytes) => signMessage(bytes));
        setPhase("idle");
        updateQuote(msgId, { state: "fired", note: "Message proof signed." });
        push({
          role: "assistant",
          text: `Signed proof · ${shortAddr(sig, 6)} — hand it to whatever asked for it.`,
        });
        toast.success("Proof signed");
        return;
      }

      const check = guardSummary(payload.summary, q);
      if (!check.ok) {
        throw new TxError("failed", `Refused to sign — ${check.detail ?? "summary mismatch"}.`);
      }

      setPhase("awaiting_signature");
      toast("Approve in Nightly", {
        description: `${q.amount} ${q.from} → ${q.to} — check the amounts match.`,
      });
      const sig = await signAndSubmitNeedsSignature(payload, signTransaction!);
      setSignature(sig);
      setPhase("confirmed");
      updateQuote(msgId, { state: "fired" });
      push({
        role: "assistant",
        text: servedText(q),
        signature: sig,
      });
      toast.success(`Served · ${shortAddr(sig, 6)}`);
    } catch (e) {
      if (e instanceof TxError && e.code === "rejected") {
        setPhase("idle");
        updateQuote(msgId, { state: "proposed" });
        toast("Signature declined", { description: "Nothing moved — ticket kept." });
      } else {
        const msgText = errText(e);
        setError(msgText);
        setPhase("failed");
        updateQuote(msgId, { state: "failed" });
        push({ role: "system", text: msgText });
        toast.error("Order failed", { description: msgText.slice(0, 120) });
      }
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

  async function runStakeInfo(hint?: string) {
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "stake_info", args: {} });
      const { rows, more } = toRows(unwrapMcp(res), 6);
      push({
        role: "assistant",
        text: hint ?? "",
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

  async function runOrders() {
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "get_limit_orders", wallet, args: {} });
      if (isNeedsSignature(res)) throw new TxError("failed", "Order book needs no signature — unexpected sidecar reply.");
      const { rows, more } = toRows(unwrapMcp(res), 8);
      if (!rows.length) {
        push({ role: "assistant", text: "No standing orders, Chef — the book is clear." });
        return;
      }
      push({
        role: "assistant",
        text: "",
        table: { title: "Standing orders", rows, more },
      });
    } finally {
      setPhase("idle");
    }
  }

  async function runCancel(orderId: string) {
    if (!needWallet()) return;
    setBusy(true);
    setError(null);
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "cancel_limit_order", wallet, args: { orderId } });
      if (isNeedsSignature(res)) {
        if (res.kind !== "transaction" || !res.transactionBase64) {
          throw new TxError("failed", "Unexpected cancel payload from sidecar.");
        }
        setPhase("awaiting_signature");
        toast("Approve in Nightly", { description: `Cancel order ${orderId}.` });
        const sig = await signAndSubmitNeedsSignature(res, signTransaction!);
        setSignature(sig);
        setPhase("confirmed");
        push({ role: "assistant", text: `Scrapped order ${orderId}.`, signature: sig });
        toast.success("Order cancelled");
        return;
      }
      setPhase("idle");
      push({ role: "assistant", text: `Scrapped order ${orderId} — ${str(unwrapMcp(res))}` });
      toast.success("Order cancelled");
    } catch (e) {
      if (e instanceof TxError && e.code === "rejected") {
        setPhase("idle");
        toast("Signature declined", { description: "Nothing moved." });
      } else {
        const msgText = errText(e);
        setError(msgText);
        setPhase("failed");
        push({ role: "system", text: msgText });
        toast.error("Cancel failed", { description: msgText.slice(0, 120) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function runResolve(name: string) {
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "resolve_domain", wallet, args: { domain: name } });
      if (isNeedsSignature(res)) throw new TxError("failed", "Name lookup needs no signature — unexpected sidecar reply.");
      const payload = unwrapMcp(res);
      const addr = findAddress(payload);
      if (addr) {
        const { rows } = toRows(payload, 4);
        push({
          role: "assistant",
          text: "",
          table: {
            title: name,
            subtitle: shortAddr(addr, 6),
            rows: [{ label: "owner", value: addr }, ...rows.filter((r) => r.value !== addr).slice(0, 3)],
          },
        });
      } else {
        const { rows, more } = toRows(payload, 6);
        push({
          role: "assistant",
          text: "",
          table: { title: name, rows: rows.length ? rows : [{ label: "status", value: "not found" }], more },
        });
      }
    } finally {
      setPhase("idle");
    }
  }

  async function runSearch(query: string) {
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "search_tokens", wallet, args: { query } });
      if (isNeedsSignature(res)) throw new TxError("failed", "Search needs no signature — unexpected sidecar reply.");
      const { rows, more } = toRows(unwrapMcp(res), 8);
      push({
        role: "assistant",
        text: "",
        table: {
          title: `Tokens · ${query}`,
          rows: rows.length ? rows : [{ label: "status", value: "nothing found" }],
          more,
        },
      });
    } finally {
      setPhase("idle");
    }
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
        {msg.text ? (
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {msg.text}
          </p>
        ) : null}
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
        Fire swaps, sends, stakes, and standing orders in plain words. Sous quotes it,
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
