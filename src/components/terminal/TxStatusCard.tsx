"use client";

import { usePilotStore } from "@/lib/store/usePilotStore";
import { txUrl } from "@/lib/chain/explorer";

/**
 * Bounty-required: transaction execution + confirmation handling
 * + error handling and user feedback. Single component owns that UX.
 */
export function TxStatusCard() {
  const { txPhase, lastSignature, lastError, resetTx } = usePilotStore();

  const label: Record<string, string> = {
    idle: "Idle — no transaction yet",
    quoting: "Quoting via aggregators…",
    awaiting_signature: "Waiting for Nightly signature…",
    sending: "Sending to Cookie Chain…",
    confirming: "Confirming (~1s finality)…",
    confirmed: "Confirmed ✅",
    failed: "Failed ❌",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="mb-1 font-semibold">Transaction status</div>
      <div className="text-white/70">{label[txPhase]}</div>
      {lastSignature && (
        <a
          href={txUrl(lastSignature)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block break-all font-mono text-xs text-amber-300 underline"
        >
          {lastSignature} ↗
        </a>
      )}
      {lastError && (
        <div className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-200">
          {lastError}
          <button
            onClick={resetTx}
            className="ml-2 underline hover:text-white"
          >
            reset
          </button>
        </div>
      )}
    </div>
  );
}
