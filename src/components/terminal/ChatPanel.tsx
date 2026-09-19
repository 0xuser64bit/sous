"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import {
  callMcp,
  isNeedsSignature,
} from "@/lib/mcp/client";
import { resolveMint } from "@/lib/mcp/tokens";
import { quoteBoth } from "@/lib/mcp/quotes";
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
import { cancelLimitOrder } from "@/lib/tx/cancelOrder";
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
import { unwrapMcp, toRows } from "@/lib/mcp/shapes";
import { txUrl, addressUrl } from "@/lib/chain/explorer";
import { CHAIN_META, NATIVE_COOK_MINT } from "@/lib/chain/config";

/* ─── Sign-guard comparisons: exact for mints, lenient for symbols ─── */

function sameRef(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isAddressLike(a) && !isAddressLike(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
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
  const sFrom = pickKey(s, ["from", "input", "inputMint", "inMint", "src", "source", "sell"]);
  const sTo = pickKey(s, ["to", "output", "outputMint", "outMint", "dst", "dest", "buy"]);
  const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
  if (typeof sFrom === "string" && !sameRef(sFrom, intent.from)) {
    return { ok: false, detail: `summary says ${sFrom}, order says ${intent.from}` };
  }
  if (typeof sTo === "string" && !sameRef(sTo, intent.to)) {
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
  const sTok = pickKey(s, ["mint", "token", "symbol", "currency", "inputMint"]);
  const sTo = pickKey(s, ["to", "dest", "destination", "recipient", "address", "owner"]);
  if (sAmt !== undefined && !amountsMatch(sAmt, intent.amount)) {
    return { ok: false, detail: `summary says ${sAmt}, order says ${intent.amount}` };
  }
  if (typeof sTok === "string" && !sameRef(sTok, intent.token)) {
    return { ok: false, detail: `summary says ${sTok}, order says ${intent.token}` };
  }
  if (typeof sTo === "string") {
    const a = sTo.trim().replace(/[.,;!?)]+$/, "");
    const b = intent.to.trim();
    if (!sameRef(a, b)) {
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
  const pair = {
    amount: q.amount,
    from: q.expectFrom ?? q.from,
    to: q.expectTo ?? q.to,
  };
  switch (q.orderKind) {
    case "transfer":
      return transferMatches(summary, { amount: q.amount, token: pair.from, to: q.to });
    case "bridge": {
      // Destinations are chain-side addresses — only amount + token are stable.
      if (!summary || typeof summary !== "object") return { ok: true };
      const s = summary as Record<string, unknown>;
      const sAmt = pickKey(s, ["amount", "inAmount", "quantity", "value"]);
      const sTok = pickKey(s, ["from", "token", "mint", "symbol", "input"]);
      if (sAmt !== undefined && !amountsMatch(sAmt, q.amount)) {
        return { ok: false, detail: `summary says ${sAmt}, order says ${q.amount}` };
      }
      if (typeof sTok === "string" && !sameRef(sTok, pair.from)) {
        return { ok: false, detail: `summary says ${sTok}, order says ${pair.from}` };
      }
      return { ok: true };
    }
    case "limit": {
      const base = summaryMatches(summary, pair);
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
      return summaryMatches(summary, pair);
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
      return `Bridging — ${q.amount} ${q.from} → ${q.to}. Warp delivery takes minutes; the signature link lands here when it confirms.`;
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
  "I fire swaps, sends, stakes, limit/stop orders, and bridge quotes — and I read your ledger, tokens, and .cook names. Try “Quote 10 COOK → bCOOK”, “Send 2 COOK to alice.cook”, or “Limit sell 5 bCOOK → COOK at 2.0”. I quote first — nothing is signed until you fire the ticket in Nightly.";

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
  // Reader protection: only yank the feed to the bottom when the user is
  // already there. Otherwise raise the Latest flag and let them finish
  // reading the ticket in front of them.
  const nearBottomRef = useRef(true);
  const msgCountRef = useRef(messages.length);
  const [showLatest, setShowLatest] = useState(false);

  const wallet = publicKey?.toBase58();

  useEffect(() => {
    const grew = messages.length > msgCountRef.current;
    msgCountRef.current = messages.length;
    if (nearBottomRef.current) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      setShowLatest(false);
    } else if (grew) {
      setShowLatest(true);
    }
  }, [messages, busy]);

  function scrollToLatest() {
    const el = scrollRef.current;
    if (!el) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    nearBottomRef.current = true;
    setShowLatest(false);
  }

  function onFeedScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    if (near) setShowLatest(false);
  }

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
        case "transfer": {
          const meta = await resolveMint(intent.token, wallet);
          await proposeTicket({
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
          });
          break;
        }
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
        case "limit": {
          const [inMeta, outMeta] = await Promise.all([
            resolveMint(intent.from, wallet),
            resolveMint(intent.to, wallet),
          ]);
          await proposeTicket({
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
          });
          break;
        }
        case "orders":
          await runOrders();
          break;
        case "cancel":
          await runCancel(intent.orderId);
          break;
        case "bridge": {
          // The warp route only speaks COOK, 1:1.
          const meta = await resolveMint(intent.token, wallet);
          if (!meta.native) {
            push({
              role: "assistant",
              text: `The bridge only carries native COOK, Chef — ${meta.symbol} can't ride it. Swap to COOK first, then bridge.`,
            });
            break;
          }
          const direction = intent.toChain.startsWith("sol")
            ? "cookie-to-solana"
            : intent.toChain.startsWith("cook")
              ? "solana-to-cookie"
              : null;
          if (!direction) {
            push({
              role: "assistant",
              text: `I only see two ends of that bridge, Chef — “solana” or “cookie”. Where should the COOK land?`,
            });
            break;
          }
          const dest = findAddress(text);
          await proposeTicket({
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
          });
          break;
        }
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
    proposeTicket({
      orderKind: "swap",
      amount: intent.amount,
      from: inMeta.symbol,
      to: outMeta.symbol,
      expectFrom: inMeta.mint,
      expectTo: outMeta.mint,
      outAmount: best.out,
      venue: best.venue ? `${best.aggregator} · ${best.venue}` : best.aggregator,
      altQuote: alt ? `${alt.aggregator} ${alt.out}` : undefined,
      impact: best.impact,
      fireTool: "trade",
      fireArgs: {
        inputMint: inMeta.mint,
        outputMint: outMeta.mint,
        amount: intent.amount,
        aggregator: best.aggregator,
      },
      note: alt
        ? `Best of two venues — the other quoted ${alt.out}.`
        : "Single venue answered — quoted alone.",
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
      // Some actions run in steps (e.g. bridge preflights): when the
      // sidecar answers step:'intermediate', we call the original tool
      // again to continue. Bounded so we never sign-loop.
      for (let step = 0; step < 3; step++) {
        const done = await fireOnce(msgId, q);
        if (done) return;
        updateQuote(msgId, {
          state: "firing",
          note: "First leg confirmed — firing the follow-up.",
        });
      }
      throw new TxError("failed", "Too many signing steps — stopped rather than loop.");
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
    updateQuote(msgId, { state: "dismissed" });
  }

  /**
   * One quote->guard->sign->submit round. Returns true when the ticket
   * is done, false when the sidecar asked for an intermediate follow-up.
   */
  async function fireOnce(msgId: string, q: QuoteData): Promise<boolean> {
    setPhase("quoting");
    const res = await callMcp({ tool: q.fireTool, wallet, args: q.fireArgs });
    if (!isNeedsSignature(res)) {
      if (msgId) updateQuote(msgId, { state: "fired", note: "Filled directly by the sidecar." });
      push({ role: "assistant", text: servedText(q) });
      setPhase("idle");
      return true;
    }
    const payload = res;

    if (payload.kind === "message") {
      if (!signMessage) throw new TxError("failed", "This wallet cannot sign messages.");
      setPhase("awaiting_signature");
      const text = payload.message ?? payload.next ?? q.fireTool;
      const sig = await signMessageNeedsSignature(text, (bytes) => signMessage(bytes));
      setPhase("idle");
      if (msgId) updateQuote(msgId, { state: "fired", note: "Message proof signed." });
      push({
        role: "assistant",
        text: `Signed proof · ${shortAddr(sig, 6)} — hand it to whatever asked for it.`,
      });
      toast.success("Proof signed");
      return true;
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
    if (payload.step === "intermediate") return false;
    setPhase("confirmed");
    if (msgId) updateQuote(msgId, { state: "fired" });
    push({
      role: "assistant",
      text: servedText(q),
      signature: sig,
    });
    toast.success(`Served · ${shortAddr(sig, 6)}`);
    return true;
  }

  async function runBalance() {
    if (!wallet) {
      push({ role: "system", text: "Connect Nightly first — the ledger needs a wallet to read." });
      return;
    }
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "get_balance", wallet, args: { wallet } });
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
      const res = await callMcp({
        tool: "get_limit_orders",
        wallet,
        args: wallet ? { owner: wallet } : {},
      });
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
    try {
      const { signature } = await cancelLimitOrder({
        orderId,
        wallet,
        signTransaction: signTransaction!,
        onPhase: setPhase,
      });
      if (signature) {
        setSignature(signature);
        setPhase("confirmed");
        push({ role: "assistant", text: `Scrapped order ${orderId}.`, signature });
      } else {
        setPhase("idle");
        push({ role: "assistant", text: `Scrapped order ${orderId}.` });
      }
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
      const res = await callMcp({ tool: "resolve_domain", wallet, args: { name } });
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
      <div ref={scrollRef} onScroll={onFeedScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {showHero ? (
            <Hero connected={Boolean(publicKey)} />
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

      {/* Dock — pinned. Suggestions ride above the composer, AI-terminal style. */}
      <div className="shrink-0 px-4 pb-4 pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" aria-label="Suggestions">
            {EXAMPLE_ORDERS.map((o) => (
              <button
                key={o}
                onClick={() => void onSend(o)}
                disabled={busy}
                className="rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors disabled:opacity-40"
                style={{
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--copper-line)";
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
          {showLatest ? (
            <button
              onClick={scrollToLatest}
              className="self-start font-mono text-[10.5px] transition-opacity hover:opacity-70"
              style={{ color: "var(--copper-bright)" }}
            >
              ↓ Latest — new tickets below
            </button>
          ) : (
            <p className="font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
              {publicKey
                ? "quoted first · signed in Nightly · settled ~1s"
                : "read-only until Nightly connects"}
            </p>
          )}
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

/* ─── Empty pass — headline and proof, nothing to tap ──────────
   Example orders live as bubbles above the composer, not here. */

function Hero({ connected }: { connected: boolean }) {
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
