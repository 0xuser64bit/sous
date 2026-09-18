"use client";

import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";
import { unwrapMcp, toRows } from "@/lib/mcp/shapes";
import { slotOf } from "@/lib/chain/slot";
import { Section } from "@/components/layout/Section";
import { DataRows, RowsSkeleton, RowsError, sidecarHint } from "@/components/layout/DataRows";

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

  const healthRows = healthPayload ? toRows(healthPayload, 4) : null;
  const poolRows = poolPayload ? toRows(poolPayload, 5) : null;

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
            {healthRows && <DataRows rows={healthRows.rows} />}
          </div>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <Section label="Pools">
          {pools.isPending ? (
            <RowsSkeleton lines={3} />
          ) : pools.isError ? (
            <RowsError message={sidecarHint(pools.error.message)} onRetry={() => void pools.refetch()} />
          ) : poolRows && poolRows.rows.length ? (
            <DataRows rows={poolRows.rows} more={poolRows.more} />
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
