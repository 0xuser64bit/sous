"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";
import { unwrapMcp, poolBoard, type DataRow, type PoolRow } from "@/lib/mcp/shapes";
import { pickKey, fmtNum } from "@/lib/utils/format";
import { statusDetail, statusLabel } from "@/lib/chain/status";
import { useChainStatus } from "@/components/layout/useChainStatus";
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

  // Two samples give one delta, and one delta makes the x-scale divide by
  // zero: the polyline came out as "NaN,3.0" and the browser rejected the
  // attribute. Wait for a second delta before drawing anything.
  if (hist.length < 3) {
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
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
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
 * Pool rows. The venue gets its own line because two pools can share a
 * pair, and a single truncating line would hide exactly the word that
 * tells them apart.
 */
function PoolBoard({ pools, more }: { pools: PoolRow[]; more: number }) {
  return (
    <div className="min-w-0">
      <ul>
        {pools.map((p) => (
          <li key={p.id} className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px]" style={{ color: "var(--text-secondary)" }} title={p.pair}>
                {p.pair}
              </span>
              {p.venue && (
                <span
                  className="block truncate font-mono text-[10.5px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--text-tertiary)" }}
                  title={p.venue}
                >
                  {p.venue}
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-[12.5px] tnum" style={{ color: "var(--text-primary)" }}>
              {p.tvl}
            </span>
          </li>
        ))}
      </ul>
      {more ? (
        <p className="pt-1 font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          +{more} more
        </p>
      ) : null}
    </div>
  );
}

/**
 * The market board — chain pulse and pool listings. Ambient information
 * for context; the pass is where decisions happen.
 */
export function ActivityFeed() {
  const { status, health: healthData, isPending: healthPending } = useChainStatus();
  const pools = useQuery({
    queryKey: ["pools"],
    queryFn: () => callMcp({ tool: "get_pools", args: {} }),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const healthPayload = healthData ? unwrapMcp(healthData) : null;
  const live = status.state === "live";
  const healthDetail = healthPayload ? healthRows(healthPayload) : [];
  const board = pools.data ? poolBoard(pools.data, 5) : null;

  return (
    <div className="flex min-w-0 flex-col">
      <Section label="Chain">
        {healthPending ? (
          <RowsSkeleton lines={2} />
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2 pb-1">
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${live ? "animate-live" : ""}`}
                style={{
                  background: live
                    ? "var(--success)"
                    : status.state === "unknown"
                      ? "var(--text-tertiary)"
                      : "var(--error)",
                }}
              />
              <span
                className="font-mono text-[12px] tnum"
                style={{ color: live ? "var(--text-primary)" : "var(--error)" }}
              >
                {live ? "Live" : statusLabel(status)}
              </span>
              {live && (
                <span className="ml-auto min-w-0 truncate font-mono text-[12px] tnum" style={{ color: "var(--text-tertiary)" }}>
                  {statusLabel(status)}
                </span>
              )}
            </div>
            {/* Name the fix, not just the symptom: a dead local process and a
                dead chain look identical from inside the rail. */}
            {!live && status.state !== "unknown" && (
              <p className="pb-1 text-[11.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                {statusDetail(status)}
              </p>
            )}
            {healthDetail.length > 0 && <DataRows rows={healthDetail} />}
            {/* Nothing will arrive while the chain read is down, so the
                "warming up" line would be a promise the app cannot keep. */}
            {live && (
              <div className="pt-2">
                <SlotSparkline slot={numSlot(status.slot)} />
              </div>
            )}
          </div>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <Section label="Pools">
          {pools.isPending ? (
            <RowsSkeleton lines={3} />
          ) : pools.isError ? (
            <RowsError message={sidecarHint(pools.error.message)} onRetry={() => void pools.refetch()} />
          ) : board && board.pools.length ? (
            <PoolBoard pools={board.pools} more={board.more} />
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
