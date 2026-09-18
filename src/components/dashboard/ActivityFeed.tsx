"use client";

import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";

const SKELETON_WIDTHS = ["70%", "85%", "60%", "75%", "90%"];

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded animate-skeleton"
          style={{
            background: "var(--border)",
            width: SKELETON_WIDTHS[i % SKELETON_WIDTHS.length],
          }}
        />
      ))}
    </div>
  );
}

/** Compact chain status + pool info for the context sidebar. */
export function ActivityFeed() {
  const health = useQuery({
    queryKey: ["chain_health"],
    queryFn: () => callMcp({ tool: "chain_health", args: {} }),
    refetchInterval: 10_000,
  });
  const pools = useQuery({
    queryKey: ["pools"],
    queryFn: () => callMcp({ tool: "get_pools", args: {} }),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col">
      {/* Chain status */}
      <div className="px-4 py-3">
        <div
          className="mb-2 text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Chain
        </div>
        {health.isPending ? (
          <Skeleton rows={2} />
        ) : health.data && typeof health.data === "object" ? (
          <ChainStatus data={health.data as Record<string, unknown>} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Offline
          </p>
        )}
      </div>

      {/* Pools */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3">
        <div
          className="mb-2 text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Pools
        </div>
        {pools.isPending ? (
          <Skeleton rows={3} />
        ) : pools.data && typeof pools.data === "object" ? (
          <PoolList data={pools.data as Record<string, unknown>} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            No pool data
          </p>
        )}
      </div>
    </div>
  );
}

function ChainStatus({ data }: { data: Record<string, unknown> }) {
  const slot = data.slot ?? data.result?.toString() ?? "—";
  const tps = (data as Record<string, unknown>).tps;
  const entries = Object.entries(data)
    .filter(([k]) => k !== "jsonrpc" && k !== "id")
    .slice(0, 5);

  return (
    <div className="space-y-1">
      {typeof slot !== "undefined" && (
        <div className="flex items-baseline justify-between text-xs">
          <span style={{ color: "var(--text-secondary)" }}>slot</span>
          <span className="font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {String(slot)}
          </span>
        </div>
      )}
      {typeof tps !== "undefined" && (
        <div className="flex items-baseline justify-between text-xs">
          <span style={{ color: "var(--text-secondary)" }}>tps</span>
          <span className="font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {String(tps)}
          </span>
        </div>
      )}
      {entries
        .filter(([k]) => k !== "slot" && k !== "tps")
        .map(([key, val]) => (
          <div
            key={key}
            className="flex items-baseline justify-between text-xs"
          >
            <span style={{ color: "var(--text-secondary)" }}>{key}</span>
            <span className="ml-2 truncate font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
              {typeof val === "object"
                ? JSON.stringify(val).slice(0, 30)
                : String(val).slice(0, 30)}
            </span>
          </div>
        ))}
    </div>
  );
}

function PoolList({ data }: { data: Record<string, unknown> }) {
  // data could be an array or object — handle both
  const items = Array.isArray(data)
    ? data.slice(0, 5)
    : Object.entries(data)
        .filter(([k]) => k !== "jsonrpc" && k !== "id")
        .slice(0, 5);

  if (!items.length) {
    return (
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        No pools found
      </p>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="truncate text-xs font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            {typeof item === "object"
              ? JSON.stringify(item).slice(0, 60)
              : String(item).slice(0, 60)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {(items as [string, unknown][]).map(([key, val]) => (
        <div key={key} className="flex items-baseline justify-between text-xs">
          <span style={{ color: "var(--text-secondary)" }}>{key}</span>
          <span className="ml-2 truncate font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {typeof val === "object"
              ? JSON.stringify(val).slice(0, 30)
              : String(val).slice(0, 30)}
          </span>
        </div>
      ))}
    </div>
  );
}
