"use client";

import { usePilotStore, type TxPhase } from "@/lib/store/usePilotStore";
import { txUrl } from "@/lib/chain/explorer";
import { shortAddr } from "@/lib/utils/format";

const STATIONS: { id: string; label: string; phases: TxPhase[] }[] = [
  { id: "quoted", label: "Quoted", phases: ["quoting"] },
  { id: "firing", label: "Signature", phases: ["awaiting_signature", "sending"] },
  { id: "sending", label: "Confirming", phases: ["confirming"] },
  { id: "served", label: "Served", phases: ["confirmed"] },
];

function stationIndex(phase: TxPhase): number {
  if (phase === "failed") return -1;
  const i = STATIONS.findIndex((s) => s.phases.includes(phase));
  return i;
}

/**
 * The expo strip. A fixed station under the pass showing exactly where
 * the current order sits between quote and served. Silent when idle —
 * an empty pass needs no announcements.
 */
export function TxPass() {
  const { txPhase, lastSignature, lastError, resetTx } = usePilotStore();

  if (txPhase === "idle" && !lastSignature && !lastError) return null;

  const failed = txPhase === "failed";
  const active = stationIndex(txPhase);

  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 px-3 py-2.5 sm:px-4"
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: failed ? "var(--error-dim)" : "var(--bg-inset)",
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 text-[11.5px]">
        {/* Compact station readout on phones: current step + count */}
        <div
          className="flex min-w-0 flex-1 items-center gap-2 min-[480px]:hidden"
          aria-label="Order progress"
        >
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${!failed && active >= 0 ? "animate-live" : ""}`}
            style={{
              background: failed
                ? "var(--error)"
                : active >= 0
                  ? "var(--copper-bright)"
                  : "var(--text-tertiary)",
            }}
          />
          <span
            className="min-w-0 truncate font-medium"
            style={{ color: failed ? "var(--error)" : "var(--text-primary)" }}
          >
            {failed
              ? (lastError ?? "Order failed")
              : active >= 0
                ? `${STATIONS[active].label} · ${active + 1}/4`
                : "Served · 4/4"}
          </span>
        </div>

        {/* Full station strip on sm+ */}
        <ol className="hidden min-w-0 flex-1 items-center gap-1.5 min-[480px]:flex" aria-label="Order progress">
          {STATIONS.map((s, i) => {
            const done = !failed && (i < active || txPhase === "confirmed");
            const current = !failed && i === active;
            return (
              <li key={s.id} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <span
                    aria-hidden
                    className="h-px w-3 shrink-0 sm:w-5"
                    style={{ background: done ? "var(--success)" : "var(--border-strong)" }}
                  />
                )}
                <span
                  className={`flex items-center gap-1.5 whitespace-nowrap ${current ? "animate-live" : ""}`}
                  style={{
                    color: failed
                      ? "var(--text-tertiary)"
                      : current
                        ? "var(--copper-bright)"
                        : done
                          ? "var(--success)"
                          : "var(--text-tertiary)",
                  }}
                >
                  <span aria-hidden className="font-mono text-[10px]">
                    {done ? "●" : current ? "◐" : "○"}
                  </span>
                  <span className={current || done ? "font-medium" : ""}>{s.label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {failed && (
          <span className="hidden min-w-0 flex-1 truncate font-mono text-[11px] min-[480px]:block" style={{ color: "var(--error)" }}>
            {lastError ?? "Order failed"}
          </span>
        )}

        {lastSignature && (
          <a
            href={txUrl(lastSignature)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[32px] shrink-0 items-center font-mono text-[11px] tnum transition-opacity hover:opacity-70"
            style={{ color: "var(--copper-bright)" }}
          >
            {shortAddr(lastSignature, 4)} ↗
          </a>
        )}

        {(txPhase === "confirmed" || failed) && (
          <button
            onClick={resetTx}
            className="flex min-h-[32px] shrink-0 items-center px-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-tertiary)" }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
