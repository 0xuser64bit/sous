"use client";

import { usePilotStore } from "@/lib/store/usePilotStore";
import { txUrl } from "@/lib/chain/explorer";
import { shortAddr } from "@/lib/utils/format";

const PHASE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  idle: { label: "Ready", color: "var(--text-tertiary)", bg: "transparent" },
  quoting: {
    label: "Quoting",
    color: "var(--amber-text)",
    bg: "var(--amber-muted)",
  },
  awaiting_signature: {
    label: "Sign in wallet",
    color: "var(--amber-text)",
    bg: "var(--amber-muted)",
  },
  sending: {
    label: "Sending",
    color: "var(--amber-text)",
    bg: "var(--amber-muted)",
  },
  confirming: {
    label: "Confirming",
    color: "var(--amber-text)",
    bg: "var(--amber-muted)",
  },
  confirmed: {
    label: "Confirmed",
    color: "var(--success)",
    bg: "var(--success-muted)",
  },
  failed: {
    label: "Failed",
    color: "var(--error)",
    bg: "var(--error-muted)",
  },
};

/**
 * Inline transaction status bar — sits below the chat, not as a separate card.
 * Only visible when there's something to show.
 */
export function TxStatusCard() {
  const { txPhase, lastSignature, lastError, resetTx } = usePilotStore();
  const phase = PHASE_CONFIG[txPhase] ?? PHASE_CONFIG.idle;

  if (txPhase === "idle" && !lastSignature && !lastError) return null;

  return (
    <div
      className="flex items-center gap-3 border-t border-[var(--border-subtle)] px-4 py-2 text-xs"
      style={{ background: phase.bg }}
    >
      {/* Phase dot */}
      <span
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          txPhase !== "idle" &&
          txPhase !== "confirmed" &&
          txPhase !== "failed"
            ? "animate-gentle-pulse"
            : ""
        }`}
        style={{ background: phase.color }}
      />

      {/* Label */}
      <span style={{ color: phase.color }}>{phase.label}</span>

      {/* Signature link */}
      {lastSignature && (
        <a
          href={txUrl(lastSignature)}
          target="_blank"
          rel="noreferrer"
          className="font-mono transition-opacity hover:opacity-70"
          style={{ color: "var(--amber-text)" }}
        >
          {shortAddr(lastSignature, 6)} ↗
        </a>
      )}

      {/* Error */}
      {lastError && (
        <span className="min-w-0 flex-1 truncate" style={{ color: "var(--error)" }}>
          {lastError}
        </span>
      )}

      {/* Reset */}
      {(txPhase === "confirmed" || txPhase === "failed") && (
        <button
          onClick={resetTx}
          className="ml-auto shrink-0 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-tertiary)" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
