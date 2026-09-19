import Link from "next/link";
import { SousMark } from "@/components/brand/SousMark";
import { DemoTheater } from "@/components/landing/DemoTheater";
import {
  APP_TAGLINE,
  CHAIN_META,
  COOKIE_RPC_URL,
  COOKIESCAN_BASE,
} from "@/lib/chain/config";

function rpcHost(): string {
  try {
    return new URL(COOKIE_RPC_URL).host;
  } catch {
    return COOKIE_RPC_URL;
  }
}

const HOW_ROWS = [
  {
    n: "01",
    title: "Quoted on paper",
    text: "Every money move arrives as an order slip: what you fire, what you receive, the venue that won, the impact, the fee. Two aggregators quote and the survivor wins — the loser stays on the ticket for honesty.",
    visual: "ticket" as const,
  },
  {
    n: "02",
    title: "Signed with confidence",
    text: "The wallet opens only after a decoded summary is checked against your ticket — mints, not symbols. On any mismatch Sous refuses to sign instead of asking you to squint at hex.",
    visual: "guard" as const,
  },
  {
    n: "03",
    title: "Served with receipt",
    text: "Blockhash-aware confirmation, typed failures — declined stays retryable, expired re-quotes, never resubmits blindly. Every fill ends with a signature and a Cookiescan link.",
    visual: "receipt" as const,
  },
] as const;

const PROOF_ROWS = [
  { capability: "Nightly-first wallet, address always visible", trace: "WalletProviders.tsx · WalletButton.tsx" },
  { capability: "Paper ticket for every money move", trace: "QuoteTicket.tsx · usePilotStore.ts" },
  { capability: "Decoded sign-guard, refuses on mismatch", trace: "ChatPanel.tsx guardSummary" },
  { capability: "Single submit relay, blockhash-aware confirm", trace: "POST /api/tx/submit" },
  { capability: "Phased expo strip plus Cookiescan receipt", trace: "TxPass.tsx · explorer.ts" },
  { capability: "Honest throughput line, no fake history", trace: "ActivityFeed.tsx" },
] as const;

const BOARD_ROWS = [
  { item: "Token candles and portfolio PnL", need: "needs DAS read path" },
  { item: "Bridge status board", need: "tool proxied, board pending" },
  { item: "Stop-loss trigger syntax", need: "needs sidecar order schema" },
] as const;

function TicketLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
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

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 shrink-0"
        style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Sous home">
            <SousMark size={26} />
            <span className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-[17px] font-semibold">Sous</span>
              <span
                className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.16em] min-[400px]:block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {APP_TAGLINE}
              </span>
            </span>
          </Link>
          <nav aria-label="On this page" className="hidden items-center gap-5 text-[13px] md:flex" style={{ color: "var(--text-secondary)" }}>
            <Link className="transition-opacity hover:opacity-70" href="#demo">Demo</Link>
            <Link className="transition-opacity hover:opacity-70" href="#how">How it works</Link>
            <Link className="transition-opacity hover:opacity-70" href="#proof">Proof</Link>
          </nav>
          <Link
            href="/app"
            className="rounded-[var(--radius-md)] px-4 py-3 text-[13.5px] font-semibold transition-opacity hover:opacity-85"
            style={{ background: "var(--copper)", color: "#1d1206" }}
          >
            Launch the pass
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section aria-labelledby="hero-title" className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <p
                className="font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Conversational trading · {CHAIN_META.name}
              </p>
              <h1
                id="hero-title"
                className="font-display mt-4 font-semibold leading-[1.05]"
                style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", letterSpacing: "-0.01em" }}
              >
                Order in words.
                <br />
                Sign in seconds.
              </h1>
              <p
                className="mt-5 max-w-[58ch] text-[17px] leading-[1.7]"
                style={{ color: "var(--text-secondary)" }}
              >
                Sous is the sous-chef for Cookie Chain. Say what to fire — a swap,
                a stake, a standing order — review the paper ticket, approve once
                in Nightly, and the chain serves in about a second for a fraction
                of a cent.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/app"
                  className="rounded-[var(--radius-md)] px-5 py-3 text-[15px] font-semibold transition-opacity hover:opacity-85"
                  style={{ background: "var(--copper)", color: "#1d1206" }}
                >
                  Launch the pass →
                </Link>
                <Link
                  href="#demo"
                  className="rounded-[var(--radius-md)] px-5 py-3 text-[15px] font-medium transition-opacity hover:opacity-70"
                  style={{ color: "var(--text-primary)", border: "1px solid var(--border-strong)" }}
                >
                  See the 60-second demo
                </Link>
              </div>
              <dl
                className="mt-10 flex max-w-md items-center gap-5 font-mono text-[12px] tnum"
                style={{ color: "var(--text-tertiary)" }}
                aria-label="Chain facts"
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

            {/* The dish: a real ticket, static */}
            <div className="lg:col-span-5 lg:pt-10">
              <figure className="animate-ticket-in mx-auto max-w-[420px]">
                <div
                  role="img"
                  aria-label="Example order ticket: 10 COOK to bCOOK, venue and fee listed, stamped Served"
                  className="overflow-hidden rounded-[var(--radius-md)]"
                  style={{ background: "var(--paper)", color: "var(--ink)" }}
                >
                  <div aria-hidden="true">
                  <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-soft)" }}>
                      Order No. 004 · Tasting
                    </span>
                    <span className="font-mono text-[10px] tnum" style={{ color: "var(--ink-faint)" }}>
                      14:32
                    </span>
                  </div>
                  <div className="px-4 pb-1 pt-2">
                    <p className="font-display text-[26px] font-semibold leading-tight">
                      10 COOK <span style={{ color: "var(--ink-faint)" }}>→</span> bCOOK
                    </p>
                  </div>
                  <dl className="space-y-1.5 px-4 py-3 text-[12.5px]">
                    <TicketLine label="You fire" value="10 COOK" strong />
                    <TicketLine label="You receive" value="9.982 bCOOK" strong />
                    <TicketLine label="Venue" value="Cookiebox · Candy Shop" />
                    <TicketLine label="Price impact" value="0.02%" />
                    <TicketLine label="Est. fee" value={`≈ ${CHAIN_META.avgFeeCook} COOK`} />
                  </dl>
                  <div className="px-4 pb-3">
                    <span
                      className="inline-block -rotate-2 rounded-[3px] border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
                      style={{ borderColor: "var(--copper-deep)", color: "var(--copper-deep)" }}
                    >
                      Served ✓
                    </span>
                  </div>
                  <div className="ticket-perf" aria-hidden style={{ ["--perf" as string]: "var(--bg-base)" }} />
                  </div>
                </div>
                <figcaption className="mt-3 text-center font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  every money move looks like this before you sign
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ── 60-second flow: the theater ──────────────────── */}
        <section aria-labelledby="demo-title" id="demo" className="scroll-mt-20" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--copper-bright)" }}>
              Simulated preview · the 60-second flow
            </p>
            <h2
              id="demo-title"
              className="font-display mt-3 max-w-[22ch] font-semibold leading-[1.1]"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.01em" }}
            >
              Watch an order go from words to receipt.
            </h2>
            <p className="mt-4 max-w-[62ch] text-[16px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              Read-only, start to receipt, on loop. No wallet, no network —
              the live pass is one click away in the app.
            </p>
            <div className="mt-10">
              <DemoTheater />
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section aria-labelledby="how-title" id="how" className="scroll-mt-20" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--copper-bright)" }}>
              How it works
            </p>
            <h2
              id="how-title"
              className="font-display mt-3 max-w-[22ch] font-semibold leading-[1.1]"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.01em" }}
            >
              Quote. Sign. Served. Nothing else moves.
            </h2>
            <div className="mt-10 flex flex-col gap-12">
              {HOW_ROWS.map((row, i) => (
                <div key={row.n} className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <span className="font-mono text-[13px] tnum" style={{ color: "var(--copper-bright)" }}>
                      {row.n}
                    </span>
                    <h3 className="font-display mt-2 text-[24px] font-semibold">{row.title}</h3>
                    <p className="mt-3 max-w-[58ch] text-[16px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
                      {row.text}
                    </p>
                  </div>
                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    {row.visual === "ticket" && <HowTicket />}
                    {row.visual === "guard" && <HowGuard />}
                    {row.visual === "receipt" && <HowReceipt />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Proof ────────────────────────────────────────── */}
        <section aria-labelledby="proof-title" id="proof" className="scroll-mt-20" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:py-20">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--copper-bright)" }}>
              Proof, not promises
            </p>
            <h2
              id="proof-title"
              className="font-display mt-3 max-w-[22ch] font-semibold leading-[1.1]"
              style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", letterSpacing: "-0.01em" }}
            >
              On the menu today.
            </h2>
            <dl className="mt-10">
              {PROOF_ROWS.map((r) => (
                <div
                  key={r.capability}
                  className="flex flex-col gap-1 border-t border-[var(--border-subtle)] py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <dt className="text-[15px] font-medium">{r.capability}</dt>
                  <dd className="shrink-0 font-mono text-[12px] tnum" style={{ color: "var(--text-tertiary)" }}>
                    {r.trace}
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-12 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
              On the board — honestly pending
            </h3>
            <dl className="mt-4">
              {BOARD_ROWS.map((r) => (
                <div
                  key={r.item}
                  className="flex flex-col gap-1 border-t border-[var(--border-subtle)] py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <dt className="text-[14px]" style={{ color: "var(--text-secondary)" }}>{r.item}</dt>
                  <dd className="shrink-0 font-mono text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {r.need}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────── */}
        <section aria-labelledby="cta-title" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 py-20 text-center sm:py-24">
            <SousMark size={44} />
            <h2
              id="cta-title"
              className="font-display mt-6 font-semibold leading-[1.08]"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", letterSpacing: "-0.01em" }}
            >
              The pass is open.
            </h2>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              Yes, Chef? Your first ticket is one sentence away — quoted first,
              signed in Nightly, served in about a second.
            </p>
            <Link
              href="/app"
              className="mt-8 rounded-[var(--radius-md)] px-6 py-3.5 text-[15px] font-semibold transition-opacity hover:opacity-85"
              style={{ background: "var(--copper)", color: "#1d1206" }}
            >
              Launch the pass →
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          <span>
            rpc <span style={{ color: "var(--text-secondary)" }}>{rpcHost()}</span>
          </span>
          <a
            href={COOKIESCAN_BASE}
            target="_blank"
            rel="noreferrer"
            className="transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            cookiescan ↗
          </a>
          <span className="ml-auto">fired in Nightly · settled on Cookie Chain</span>
        </div>
      </footer>
    </div>
  );
}

/* ── How-it-works visuals: small honest exhibits ────────────── */

function HowTicket() {
  return (
    <div
      role="img"
      aria-label="Mini ticket showing venue compare: Cookiebox wins, Candy Shop also quoted"
      className="overflow-hidden rounded-[var(--radius-md)]"
      style={{ background: "var(--paper)", color: "var(--ink)" }}
    >
      <div aria-hidden="true">
      <div className="px-4 pt-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-soft)" }}>
          Order No. 007 · Tasting
        </p>
        <p className="font-display pt-1 text-[20px] font-semibold leading-tight">
          25 COOK <span style={{ color: "var(--ink-faint)" }}>→</span> bCOOK
        </p>
      </div>
      <dl className="space-y-1.5 px-4 py-3 text-[12.5px]">
        <TicketLine label="Best" value="Cookiebox · 24.94" strong />
        <TicketLine label="Also quoted" value="Candy Shop · 24.91" />
        <TicketLine label="Est. fee" value={`≈ ${CHAIN_META.avgFeeCook} COOK`} />
      </dl>
      <div className="ticket-perf" aria-hidden style={{ ["--perf" as string]: "var(--bg-base)" }} />
      </div>
    </div>
  );
}

function HowGuard() {
  const rows = [
    { k: "amount", v: "25 = 25 ✓" },
    { k: "venue mint", v: "mint match ✓" },
    { k: "limit price", v: "@ 2.0 ✓" },
  ];
  return (
    <div
      role="img"
      aria-label="Sign guard checklist: amount, mint, and price all checked before the wallet opens"
      className="overflow-hidden rounded-[var(--radius-md)]"
      style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
    >
      <div aria-hidden="true">
      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)" }}>
        Sign-guard · decoded summary vs ticket
      </p>
      <dl className="px-4 pb-4">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-3 border-t border-[var(--border-subtle)] py-2 text-[12.5px] first:border-t-0">
            <dt style={{ color: "var(--text-secondary)" }}>{r.k}</dt>
            <dd className="font-mono tnum" style={{ color: "var(--success)" }}>{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="px-4 pb-3 font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        mismatch → refused, wallet never opens
      </p>
      </div>
    </div>
  );
}

function HowReceipt() {
  return (
    <div
      role="img"
      aria-label="Expo strip showing Quoted, Signature, and Confirming done and Served active, with a Cookiescan receipt link"
      className="overflow-hidden rounded-[var(--radius-md)] px-4 py-4"
      style={{ background: "var(--bg-inset)", border: "1px solid var(--border-subtle)" }}
    >
      <div aria-hidden="true">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px]" aria-hidden>
        {["Quoted", "Signature", "Confirming"].map((s) => (
          <li key={s} className="flex items-center gap-1.5" style={{ color: "var(--success)" }}>
            <span className="font-mono text-[10px]">●</span>
            <span className="font-medium">{s}</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5 animate-live" style={{ color: "var(--copper-bright)" }}>
          <span className="font-mono text-[10px]">◐</span>
          <span className="font-medium">Served</span>
        </li>
      </ol>
      <p className="pt-3 font-mono text-[12px] tnum" style={{ color: "var(--copper-bright)" }}>
        4xQe…9vZm ↗
      </p>
      <p className="pt-1 font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        signature plus Cookiescan link, every fill
      </p>
      </div>
    </div>
  );
}
