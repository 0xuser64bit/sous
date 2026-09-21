"use client";

import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";
import { slotOf } from "@/lib/chain/slot";
import { classifyChain, type ChainStatus } from "@/lib/chain/status";
import { fetchWithTimeout } from "@/lib/utils/fetch";

/**
 * Chain pulse, shared by the header and the market rail.
 *
 * Both already query `chain_health` under the same key, so React Query
 * serves one request for both. The direct RPC probe only runs when the
 * sidecar read has failed — in the happy path it costs nothing, and it is
 * the only way to tell a dead sidecar from a dead chain.
 */
export function useChainStatus(): { status: ChainStatus; health: unknown; isPending: boolean } {
  const health = useQuery({
    queryKey: ["chain_health"],
    queryFn: () => callMcp({ tool: "chain_health", args: {} }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const slot = health.data ? slotOf(health.data) : null;
  const sidecarFailed = health.isError || (health.isSuccess && slot === null);

  const rpc = useQuery({
    queryKey: ["rpc_health"],
    queryFn: async () => {
      const res = await fetchWithTimeout("/api/health", {}, 12_000);
      return res.ok;
    },
    enabled: sidecarFailed,
    refetchInterval: 30_000,
  });

  return {
    status: classifyChain({
      slot,
      sidecarFailed,
      rpcOk: rpc.data ?? (rpc.isError ? false : null),
    }),
    health: health.data,
    isPending: health.isPending,
  };
}
