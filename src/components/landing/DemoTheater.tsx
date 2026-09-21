"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { SousLoader } from "@/components/brand/SousLoader";
import { CHAIN_META } from "@/lib/chain/config";
import { TicketLine } from "@/components/terminal/TicketLine";
import { SAMPLE_TICKET as T } from "@/lib/landing/sampleTicket";
import {
  DEMO_CAPTIONS,
  DEMO_FINAL,
  DEMO_START,
  DEMO_TEXT,
  PHASE_MS,
  captionFor,
  demoReducer,
  expoFor,
} from "@/lib/landing/demoScript";

const STATIONS = ["Quoted", "Signature", "Confirming", "Served"] as const;

/**
 * Demo theater: the 60-second flow as a canned, read-only loop.
 * Autoplays when scrolled into view; a reduced-motion audience gets the
 * final frame statically and no timers ever start. Nothing here signs,
 * sends, or fetches — the feed is aria-hidden illustration, the captions
 * beside it carry the story for assistive tech.
 */
export function DemoTheater() {
  const [state, dispatch] = useReducer(demoReducer, DEMO_START);
  const [visible, setVisible] = useState(false);
  // Lazy initializer (not an effect): read the preference once up front,
  // then only subscribe to changes below.
  const [reduced, setReduced] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq?.addEventListener("change", onChange);
    return () => mq?.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    const t = setTimeout(() => dispatch({ type: "tick" }), PHASE_MS[state.phase]);
    return () => clearTimeout(t);
  }, [state, visible, reduced]);

  // Reduced motion: rest on the finished frame, no timers, no replay.
  const frame = reduced ? DEMO_FINAL : state;
  const activeCaption = captionFor(frame.phase);
  const expo = expoFor(frame.phase);

  const showBubble = frame.phase !== "typing";
  const showTicket = expo >= 0 && frame.phase !== "quoting";
  const fired = frame.phase === "served" || frame.phase === "hold";
  const showReceipt = fired;

  return (
    <div className="grid min-w-0 items-start gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-10">
      {/* Stage */}
      <div
        ref={boxRef}
        role="region"
        aria-label="Simulated demo: a swap order traveling from words to receipt. Read-only preview."
        className="min-w-0 overflow-hidden rounded-[var(--radius-md)] lg:col-span-7"
        style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}
      >
        <div
          className="flex min-w-0 items-center gap-2 px-3 py-2.5 sm:px-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <span aria-hidden className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--text-tertiary)" }} />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Simulated preview · read-only
          </span>
          {!reduced && (
            <button
              onClick={() => dispatch({ type: "reset" })}
              className="flex min-h-[36px] shrink-0 items-center px-1 font-mono text-[11px] transition-opacity hover:opacity-70"
              style={{ color: "var(--text-tertiary)" }}
              aria-label="Replay the simulated demo"
            >
              ↻ Replay
            </button>
          )}
        </div>

        <div aria-hidden="true" className="flex min-h-[300px] min-w-0 flex-col gap-4 px-3 py-5 sm:min-h-[360px] sm:px-4">
          {showBubble && (
            <div className="animate-ticket-in ml-auto max-w-[92%] sm:max-w-[88%]">
              <div className="mb-1 truncate text-right font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
                No. 004 · Swap · 14:32
              </div>
              <div
                className="rounded-[var(--radius-md)] px-3 py-2 text-[13.5px] leading-relaxed break-words"
                style={{ background: "var(--bg-inset)", border: "1px solid var(--border)" }}
              >
                {DEMO_TEXT}
              </div>
            </div>
          )}

          {frame.phase === "quoting" && (
            <div className="animate-ticket-in">
              <SousLoader step={0} />
            </div>
          )}

          {showTicket && (
            <div
              className="animate-ticket-in min-w-0 overflow-hidden rounded-[var(--radius-md)]"
              style={{ background: "var(--paper)", color: "var(--ink)" }}
            >
              <div className="flex items-baseline justify-between gap-2 px-3 pt-3 sm:px-4">
                <span className="min-w-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-soft)" }}>
                  Order No. {T.ticketNo} · Tasting
                </span>
                <span className="shrink-0 font-mono text-[10px] tnum" style={{ color: "var(--ink-faint)" }}>
                  14:32
                </span>
              </div>
              <div className="px-3 pb-1 pt-2 sm:px-4">
                <p className="font-display break-words text-[20px] font-semibold leading-tight sm:text-[22px]">
                  {T.amount} <span style={{ color: "var(--ink-faint)" }}>→</span> {T.to}
                </p>
              </div>
              <dl className="space-y-1.5 px-3 py-3 text-[12.5px] sm:px-4">
                <TicketLine label="You fire" value={T.amount} strong />
                <TicketLine label="You receive" value={`≈ ${T.receive}`} strong />
                <TicketLine label="At least" value={T.minOut} strong />
                <TicketLine label="Venue" value={T.venue} />
                <TicketLine label="Network fee" value={`≈ ${CHAIN_META.avgFeeCook} COOK`} />
              </dl>
              {fired ? (
                <div className="px-3 pb-3 sm:px-4">
                  <span
                    className="inline-block -rotate-2 rounded-[3px] border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ borderColor: "var(--copper-deep)", color: "var(--copper-deep)" }}
                  >
                    Served ✓
                  </span>
                </div>
              ) : (
                <div className="flex gap-2 px-3 pb-4 pt-1 sm:px-4">
                  <span
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-sm)] px-3 py-2 text-center text-[13px] font-semibold sm:min-h-0"
                    style={{ background: "var(--ink)", color: "var(--paper)" }}
                  >
                    Fire order
                  </span>
                  <span
                    className="flex min-h-[44px] items-center justify-center rounded-[var(--radius-sm)] px-4 py-2 text-[13px] font-medium sm:min-h-0 sm:px-3"
                    style={{ color: "var(--ink-soft)", border: "1px solid var(--paper-faint)" }}
                  >
                    Pass
                  </span>
                </div>
              )}
              <div className="ticket-perf" style={{ ["--perf" as string]: "var(--bg-base)" }} />
            </div>
          )}

          {expo >= 0 && (
            <div
              className="animate-ticket-in rounded-[var(--radius-md)] px-3 py-2.5"
              style={{ background: "var(--bg-inset)", borderTop: "1px solid var(--border-subtle)" }}
            >
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
                {STATIONS.map((s, i) => {
                  const done = expo === 3 || i < expo;
                  const current = expo !== 3 && i === expo;
                  return (
                    <li key={s} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span
                          className="mr-1.5 h-px w-3"
                          style={{ background: done ? "var(--success)" : "var(--border-strong)" }}
                        />
                      )}
                      <span
                        className={current ? "animate-live" : ""}
                        style={{
                          color: current
                            ? "var(--copper-bright)"
                            : done
                              ? "var(--success)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        <span className="mr-1 font-mono text-[10px]">
                          {done ? "●" : current ? "◐" : "○"}
                        </span>
                        <span className={current || done ? "font-medium" : ""}>{s}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {showReceipt && (
            <p className="animate-ticket-in text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Served — {T.amount} → {T.to}.{" "}
              <span className="font-mono text-[12px] tnum" style={{ color: "var(--copper-bright)" }}>
                4xQe…9vZm ↗
              </span>
            </p>
          )}
        </div>

        {/* Mock dock: the typing hand */}
        <div
          aria-hidden="true"
          className="px-3 pb-4 pt-1 sm:px-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="mx-auto flex max-w-2xl min-w-0 items-end gap-2 pt-3">
            <div
              className="flex min-h-[44px] min-w-0 flex-1 items-center rounded-[var(--radius-md)] px-3 py-2.5 text-[13.5px] leading-relaxed break-words"
              style={{
                background: "var(--bg-inset)",
                border: "1px solid var(--border)",
                color: frame.typed === 0 ? "var(--text-tertiary)" : "var(--text-primary)",
              }}
            >
              {frame.typed === 0 ? (
                "Order anything…"
              ) : (
                <>
                  {DEMO_TEXT.slice(0, frame.typed)}
                  {frame.phase === "typing" && (
                    <span className="animate-live ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px]" style={{ background: "var(--copper-bright)" }} />
                  )}
                </>
              )}
            </div>
            <span
              className="flex min-h-[44px] shrink-0 items-center rounded-[var(--radius-md)] px-4 py-2.5 text-[13.5px] font-semibold opacity-60"
              style={{ background: "var(--copper)", color: "#1d1206" }}
            >
              Fire
            </span>
          </div>
        </div>
      </div>

      {/* Captions: the story, readable by everyone */}
      <ol className="flex min-w-0 flex-col lg:col-span-5" aria-label="What the demo shows">
        {DEMO_CAPTIONS.map((c, i) => {
          const active = i === activeCaption;
          const past = i < activeCaption;
          return (
            <li key={c.title} className="min-w-0 border-t border-[var(--border-subtle)] py-4 first:border-t-0 first:pt-0 lg:first:pt-0">
              <p className="flex min-w-0 items-baseline gap-3">
                <span
                  className="shrink-0 font-mono text-[12px] tnum"
                  style={{ color: active ? "var(--copper-bright)" : "var(--text-tertiary)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="min-w-0 text-balance text-[15px] font-semibold break-words"
                  style={{ color: active || past ? "var(--text-primary)" : "var(--text-tertiary)" }}
                >
                  {c.title}
                </span>
              </p>
              <p
                className="mt-1.5 pl-8 text-[14px] leading-[1.7] break-words sm:pl-9"
                style={{ color: active ? "var(--text-secondary)" : "var(--text-tertiary)" }}
              >
                {c.text}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
