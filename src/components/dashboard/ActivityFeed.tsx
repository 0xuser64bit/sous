"use client";

import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";

/** Live chain + pools feed. Placeholder for DAS charts (TASK 04). */
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
    <div className="rounded-2xl border border-white/10 p-4 text-sm">
      <div className="font-semibold">Live activity</div>
      <div className="mt-2 text-xs text-white/60">
        Slot/TPS/avg fee refresh every 10s. Pools every 30s.
      </div>
      <pre className="mt-2 max-h-64 overflow-auto text-xs text-white/70">
        {health.isPending
          ? "Loading chain health…"
          : JSON.stringify(health.data, null, 2)?.slice(0, 1500)}
        {"\n--- pools ---\n"}
        {pools.isPending
          ? "Loading pools…"
          : JSON.stringify(pools.data, null, 2)?.slice(0, 1500)}
      </pre>
    </div>
  );
}
