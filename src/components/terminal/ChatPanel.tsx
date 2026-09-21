"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callMcp, isNeedsSignature } from "@/lib/mcp/client";
import {
  usePilotStore,
  type ChatMsg,
  type QuoteData,
  type TableData,
} from "@/lib/store/usePilotStore";
import { TxError } from "@/lib/tx/signAndSend";
import { cancelLimitOrder } from "@/lib/tx/cancelOrder";
import { resolvedDestination } from "@/lib/tx/guard";
import { fireTicket } from "@/lib/pass/fire";
import {
  buildBridgeTicket,
  buildLimitTicket,
  buildStakeTicket,
  buildSwapTicket,
  buildTransferTicket,
  buildUnstakeTicket,
  transferPreflight,
  type TicketDraft,
} from "@/lib/pass/tickets";
import { parseIntent, isTemplateOrder, EXAMPLE_ORDERS, type Intent } from "@/lib/intent";
import { QuoteTicket } from "./QuoteTicket";
import { SousMark } from "@/components/brand/SousMark";
import { SousLoader } from "@/components/brand/SousLoader";
import {
  shortAddr,
  fmtClock,
  isAddressLike,
} from "@/lib/utils/format";
import {
  unwrapMcp,
  toRows,
  balanceRows,
  stakeRows,
  limitOrderRows,
  domainRows,
  tokenSearchRows,
} from "@/lib/mcp/shapes";
import { txUrl, addressUrl } from "@/lib/chain/explorer";
import { CHAIN_META } from "@/lib/chain/config";

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

function servedText(q: QuoteData, resolvedTo?: string | null): string {
  switch (q.orderKind) {
    case "transfer": {
      // When the order named a .cook name, show the address it actually paid.
      const dest = resolvedTo && resolvedTo !== q.to ? `${q.to} (${shortAddr(resolvedTo, 6)})` : q.to;
      return `Sent — ${q.amount} ${q.from} → ${dest}.`;
    }
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

const HELP_TEXT =
  "I fire swaps, sends, stakes, limit/stop orders, and bridge quotes — and I read your ledger, tokens, and .cook names. Try “Quote 10 COOK → bCOOK”, “Send 2 COOK to alice.cook”, or “Limit sell 5 bCOOK → COOK at 2.0”. I quote first — nothing is signed until you fire the ticket in Nightly.";

/**
 * The pass. Orders go up as numbered tickets; quotes come back as paper;
 * money never moves without a signature in Nightly.
 */
export function ChatPanel() {
  const { publicKey, signTransaction, signMessage } = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const queryClient = useQueryClient();
  const messages = usePilotStore((s) => s.messages);
  const txPhase = usePilotStore((s) => s.txPhase);
  const push = usePilotStore((s) => s.push);
  const updateQuote = usePilotStore((s) => s.updateQuote);
  const setPhase = usePilotStore((s) => s.setPhase);
  const setSignature = usePilotStore((s) => s.setSignature);
  const setError = usePilotStore((s) => s.setError);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Mobile ideas toggle: the chip row costs ~44px of feed height, so once
  // the user is trading it collapses behind one button. Empty pass keeps
  // the row open — that's when discovery matters.
  const [ideasOpen, setIdeasOpen] = useState(false);
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

  /**
   * Tapping a suggestion. Quotes and reads run; anything naming a
   * counterparty or a price loads the composer instead, because those
   * examples are templates and the destination has to be the user's.
   */
  function onExampleTap(text: string) {
    if (busy) return;
    if (!isTemplateOrder(text)) {
      void onSend(text);
      return;
    }
    setInput(text);
    const el = areaRef.current;
    if (el) {
      el.focus();
      // Caret at the end so the destination is the first thing they edit.
      el.setSelectionRange(text.length, text.length);
      autosize();
    }
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
          // A quote is a read. The page promises browsing is free, and
          // get_quote needs no wallet — gating it here made the one action
          // worth showing a visitor the one they could not take. Firing the
          // ticket still requires a signature.
          setPhase("quoting");
          await post(await buildSwapTicket(intent, wallet));
          setPhase("idle");
          break;
        case "transfer":
          await post(await buildTransferTicket(intent, wallet), intent.amount);
          break;
        case "stake":
          // "stake" with no amount is a question about staking, not an order.
          if (intent.amount === null) await runStakeInfo();
          else await post(buildStakeTicket({ ...intent, amount: intent.amount }));
          break;
        case "unstake":
          if (intent.amount === null) {
            await runStakeInfo("How much should I unstake, Chef? e.g. “Unstake 5”.");
          } else {
            await post(buildUnstakeTicket({ ...intent, amount: intent.amount }));
          }
          break;
        case "limit":
          await post(await buildLimitTicket(intent, wallet));
          break;
        case "bridge":
          await post(await buildBridgeTicket(intent, { wallet, rawText: text }));
          break;
        case "orders":
          await runOrders();
          break;
        case "cancel":
          await runCancel(intent.orderId);
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

  /**
   * Post whatever the ticket builder decided: a slip on the rail, or a
   * sentence when the order cannot be built as asked. A transfer draft
   * carries the token it resolved so the funds check can run behind the
   * ticket rather than delaying it.
   */
  async function post(draft: TicketDraft, amount?: number) {
    if (draft.kind === "say") {
      push({ role: "assistant", text: draft.text });
      return;
    }
    const id = proposeTicket(draft.quote);
    if (draft.preflight && amount !== undefined) {
      void transferPreflight(draft.preflight, amount, wallet).then((warning) => {
        if (warning) updateQuote(id, { warning });
      });
    }
  }

  /** Balances/orders/stake read stale the moment a fill lands — refetch them. */
  function refreshPantry() {
    void queryClient.invalidateQueries({ queryKey: ["balance"] });
    void queryClient.invalidateQueries({ queryKey: ["limit_orders"] });
    void queryClient.invalidateQueries({ queryKey: ["stake_info"] });
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

  async function onFire(msgId: string) {
    const msg = usePilotStore.getState().messages.find((m) => m.id === msgId);
    if (!msg?.quote || busy) return;
    const q = msg.quote;
    if (!needWallet()) return;

    setBusy(true);
    setError(null);
    updateQuote(msgId, { state: "firing" });
    try {
      const outcome = await fireTicket(q, {
        wallet,
        signTransaction: signTransaction!,
        signMessage,
        onPhase: setPhase,
        onNote: (note) => updateQuote(msgId, { note }),
        onSignature: setSignature,
      });
      refreshPantry();

      switch (outcome.kind) {
        case "filled":
          updateQuote(msgId, { state: "fired", note: "Filled directly by the sidecar." });
          push({ role: "assistant", text: servedText(q) });
          break;
        case "proof":
          updateQuote(msgId, { state: "fired", note: "Message proof signed." });
          push({
            role: "assistant",
            text: `Signed proof · ${shortAddr(outcome.signature, 6)} — hand it to whatever asked for it.`,
          });
          toast.success("Proof signed");
          break;
        case "pending":
          updateQuote(msgId, { state: "fired", note: "Sent — confirmation still pending." });
          push({ role: "assistant", text: outcome.note, signature: outcome.signature });
          toast("Sent — still confirming", { description: shortAddr(outcome.signature, 6) });
          break;
        case "served":
          updateQuote(msgId, { state: "fired" });
          push({
            role: "assistant",
            text: servedText(q, resolvedDestination(outcome.summary)),
            signature: outcome.signature,
          });
          toast.success(`Served · ${shortAddr(outcome.signature, 6)}`);
          break;
      }
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

  async function runBalance() {
    if (!wallet) {
      push({ role: "system", text: "Connect Nightly first — the ledger needs a wallet to read." });
      return;
    }
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "get_balance", wallet, args: { wallet } });
      const { rows, more } = balanceRows(res);
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
      const rows = stakeRows(res);
      push({
        role: "assistant",
        text: hint ?? "",
        table: {
          title: "bCOOK Staking",
          subtitle: "Cookiebox liquid stake",
          rows: rows.length ? rows : [{ label: "status", value: "no data from sidecar" }],
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
      const orders = limitOrderRows(res);
      if (!orders.length) {
        push({ role: "assistant", text: "No standing orders, Chef — the book is clear." });
        return;
      }
      push({
        role: "assistant",
        text: "",
        table: {
          title: "Standing orders",
          rows: orders.slice(0, 8).map((o) => ({ label: o.label, value: o.id })),
          more: Math.max(0, orders.length - 8),
        },
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
      const { signature, confirmed, note } = await cancelLimitOrder({
        orderId,
        wallet,
        signTransaction: signTransaction!,
        onPhase: setPhase,
      });
      if (signature) setSignature(signature);
      refreshPantry();
      if (!confirmed) {
        setPhase("idle");
        push({
          role: "assistant",
          text: `Cancel sent for order ${orderId}, not confirmed yet — ${note}`,
          signature,
        });
        toast("Sent — still confirming");
        return;
      }
      setPhase(signature ? "confirmed" : "idle");
      push({ role: "assistant", text: `Scrapped order ${orderId}.`, signature });
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
      const { rows, note } = domainRows(res);
      if (!rows.length) {
        const { rows: fallback, more } = toRows(unwrapMcp(res), 6);
        push({
          role: "assistant",
          text: note ?? "",
          table: {
            title: name,
            rows: fallback.length ? fallback : [{ label: "status", value: "not found" }],
            more,
          },
        });
        return;
      }
      push({
        role: "assistant",
        // The sidecar writes a plain-English answer here ("… is available —
        // register it at …"). It used to be dropped on the floor.
        text: note ?? "",
        table: { title: name, rows },
      });
    } finally {
      setPhase("idle");
    }
  }

  async function runSearch(query: string) {
    setPhase("quoting");
    try {
      const res = await callMcp({ tool: "search_tokens", wallet, args: { query } });
      if (isNeedsSignature(res)) throw new TxError("failed", "Search needs no signature — unexpected sidecar reply.");
      const { rows, more } = tokenSearchRows(res, 8);
      push({
        role: "assistant",
        // The mint is the point: an ambiguous ticker is refused at fire time
        // and the user needs an address to order with.
        text: rows.length ? "Tap a mint to open it on Cookiescan, or order by that address." : "",
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
      <div ref={scrollRef} onScroll={onFeedScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-5" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:gap-4">
          {showHero ? (
            <Hero connected={Boolean(publicKey)} />
          ) : (
            messages.map((m) => (
              <Message
                key={m.id}
                msg={m}
                canFire={Boolean(publicKey && signTransaction)}
                onFire={onFire}
                onDismiss={onDismiss}
                onConnect={() => openWalletModal(true)}
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
      <div
        className="shrink-0 px-3 pb-4 pt-2 sm:px-4"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5 lg:gap-2">
          {/* Mobile ideas toggle — hidden on sm+ where the row always shows */}
          {!showHero && (
            <button
              onClick={() => setIdeasOpen((v) => !v)}
              aria-expanded={ideasOpen}
              className="flex min-h-[32px] items-center gap-1.5 self-start font-mono text-[10.5px] transition-opacity hover:opacity-70 sm:hidden"
              style={{ color: "var(--text-tertiary)" }}
            >
              {ideasOpen ? "Hide ideas ▴" : "Try an idea ▾"}
            </button>
          )}
          <div
            className={`${!showHero && !ideasOpen ? "hidden" : "flex"} gap-1.5 overflow-x-auto pb-1 sm:flex sm:flex-wrap sm:overflow-visible sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
            aria-label="Suggestions"
          >
            {EXAMPLE_ORDERS.map((o) => (
              <button
                key={o}
                onClick={() => onExampleTap(o)}
                disabled={busy}
                title={isTemplateOrder(o) ? "Loads the composer so you can edit it" : undefined}
                className="min-h-[32px] shrink-0 rounded-full px-2.5 py-1 font-mono text-[10.5px] transition-colors disabled:opacity-40 lg:min-h-0 lg:text-[11px]"
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
          <div className="flex items-end gap-1.5 lg:gap-2">
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
              className="max-h-[132px] min-w-0 flex-1 resize-none rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:text-[var(--text-tertiary)] disabled:opacity-50"
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
              className="flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] font-semibold transition-opacity disabled:opacity-30 lg:min-h-0 lg:px-4"
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
            // Static hint is desktop-only: on phones and tablets it's one more
            // line pushing the feed up for zero actionable value.
            <p className="hidden font-mono text-[10.5px] lg:block" style={{ color: "var(--text-tertiary)" }}>
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

function Hero({ connected }: { connected: boolean }) {
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
