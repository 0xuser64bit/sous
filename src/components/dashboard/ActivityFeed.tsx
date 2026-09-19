"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";
import { unwrapMcp, poolBoard, type DataRow } from "@/lib/mcp/shapes";
import { pickKey, fmtNum } from "@/lib/utils/format";
import { slotOf } from "@/lib/chain/slot";
import { Section } from "@/components/layout/Section";
import { DataRows, RowsSkeleton, RowsError, sidecarHint } from "@/components/layout/DataRows";

const HISTORY_N = 40;

function numSlot(s: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Curated chain-health rows — the raw shape is deeply nested, so pick the
 * few fields worth showing rather than dumping the object. */
function healthRows(payload: unknown): DataRow[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const o = payload as Record<string, unknown>;
  const rows: DataRow[] = [];
  const tps = pickKey(o, ["slotsPerSec", "slots_per_sec"]);
  if (typeof tps === "number") rows.push({ label: "throughput", value: `${tps.toFixed(2)} slot/s` });
  const validators = pickKey(o, ["validatorCount", "clusterNodeCount"]);
  const delinquent = pickKey(o, ["delinquentCount"]);
  if (validators !== undefined) {
    rows.push({
      label: "validators",
      value:
        typeof delinquent === "number" && delinquent > 0
          ? `${fmtNum(validators)} · ${fmtNum(delinquent)} delinquent`
          : fmtNum(validators),
    });
  }
  const epoch = pickKey(o, ["epoch"]);
  const progress = pickKey(o, ["epochProgressPct", "epoch_progress_pct"]);
  if (epoch !== undefined) {
    rows.push({
      label: "epoch",
      value: typeof progress === "number" ? `${fmtNum(epoch)} · ${progress.toFixed(0)}%` : fmtNum(epoch),
    });
  }
  const version = pickKey(o, ["version"]);
  if (typeof version === "string") rows.push({ label: "version", value: version });
  return rows;
}

/**
 * Chain throughput, honestly: slots per 15s poll, drawn from the same
 * live health query below. No DAS, no fake history — the line starts
 * empty and fills while you watch.
 */
function SlotSparkline({ slot }: { slot: number | null }) {
  // Append-only history, adjusted during render. This is React's endorsed
  // derived-state-from-props pattern (conditional setState in render, never
  // in an effect): the guard guarantees no render loop, and the line can
  // never wedge on a slow poll.
  const [prev, setPrev] = useState<number | null>(null);
  const [hist, setHist] = useState<number[]>([]);
  if (slot !== prev) {
    setPrev(slot);
    if (slot !== null && hist[hist.length - 1] !== slot) {
      setHist([...hist.slice(-(HISTORY_N - 1)), slot]);
    }
  }

  if (hist.length < 2) {
    return (
      <p className="font-mono text-[11px]" style={{ color: "var(--text-tertiary)" }}>
        warming up the line — watch a poll or two…
      </p>
    );
  }
  const deltas = hist.slice(1).map((s, i) => s - hist[i]);
  const max = Math.max(...deltas, 1);
  const min = Math.min(...deltas, 0);
  const span = Math.max(max - min, 1);
  const W = 220;
  const H = 36;
  const pts = deltas
    .map((d, i) => `${((i / (deltas.length - 1)) * W).toFixed(1)},${(H - 3 - ((d - min) / span) * (H - 6)).toFixed(1)}`)
    .join(" ");
  const last = deltas[deltas.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Chain throughput, latest ${last} slots per poll`}
        preserveAspectRatio="none"
        style={{ height: H }}
      >
        <polyline
          points={pts}
          fill="none"
          stroke="var(--copper-bright)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="flex justify-between pt-1 font-mono text-[10.5px] tnum" style={{ color: "var(--text-tertiary)" }}>
        <span>slots / 15s poll</span>
        <span style={{ color: "var(--text-secondary)" }}>now {last}</span>
      </figcaption>
    </figure>
  );
}

/**
 * The market board — chain pulse and pool listings. Ambient information
 * for context; the pass is where decisions happen.
 */
export function ActivityFeed() {
  const health = useQuery({
    queryKey: ["chain_health"],
    queryFn: () => callMcp({ tool: "chain_health", args: {} }),
    refetchInterval: 15_000,
    retry: 1,
    staleTime: 10_000,
  });
  const pools = useQuery({
    queryKey: ["pools"],
    queryFn: () => callMcp({ tool: "get_pools", args: {} }),
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 20_000,
  });

  const healthPayload = health.data ? unwrapMcp(health.data) : null;
  const poolPayload = pools.data ? unwrapMcp(pools.data) : null;

  const slot = health.data ? slotOf(health.data) : null;
  const live = slot !== null;

  const healthDetail = healthPayload ? healthRows(healthPayload) : [];
  const board = poolPayload ? poolBoard(poolPayload, 5) : null;

  return (
    <div className="flex flex-col">
      <Section label="Chain">
        {health.isPending ? (
          <RowsSkeleton lines={2} />
        ) : health.isError ? (
          <RowsError message={sidecarHint(health.error.message)} onRetry={() => void health.refetch()} />
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 pb-1">
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "animate-live" : ""}`}
                style={{ background: live ? "var(--success)" : "var(--text-tertiary)" }}
              />
              <span className="font-mono text-[12px] tnum" style={{ color: "var(--text-primary)" }}>
                {live ? "Live" : "Quiet"}
              </span>
              {slot && (
                <span className="ml-auto font-mono text-[12px] tnum" style={{ color: "var(--text-tertiary)" }}>
                  slot {slot}
                </span>
              )}
            </div>
            {healthDetail.length > 0 && <DataRows rows={healthDetail} />}
            <div className="pt-2">
              <SlotSparkline slot={numSlot(slot)} />
            </div>
          </div>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <Section label="Pools">
          {pools.isPending ? (
            <RowsSkeleton lines={3} />
          ) : pools.isError ? (
            <RowsError message={sidecarHint(pools.error.message)} onRetry={() => void pools.refetch()} />
          ) : board && board.rows.length ? (
            <DataRows rows={board.rows} more={board.more} />
          ) : (
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              No pools on the board.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
