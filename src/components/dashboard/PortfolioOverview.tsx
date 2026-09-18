"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";

/** Portfolio + staking snapshot. Reads only — no signature needed. */
export function PortfolioOverview() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();

  const bal = useQuery({
    queryKey: ["balance", wallet],
    queryFn: () => callMcp({ tool: "get_balance", wallet, args: {} }),
    enabled: Boolean(wallet),
  });
  const stake = useQuery({
    queryKey: ["stake_info"],
    queryFn: () => callMcp({ tool: "stake_info", args: {} }),
  });

  if (!wallet)
    return (
      <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/60">
        Connect Nightly to see balances, bCOOK staking APY, and positions.
      </div>
    );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 p-4">
        <div className="text-xs uppercase tracking-wide text-white/50">
          Balances
        </div>
        <pre className="mt-2 max-h-48 overflow-auto text-xs text-white/80">
          {bal.isPending
            ? "Loading…"
            : JSON.stringify(bal.data, null, 2)?.slice(0, 2000)}
        </pre>
      </div>
      <div className="rounded-2xl border border-white/10 p-4">
        <div className="text-xs uppercase tracking-wide text-white/50">
          bCOOK liquid staking
        </div>
        <pre className="mt-2 max-h-48 overflow-auto text-xs text-white/80">
          {stake.isPending
            ? "Loading…"
            : JSON.stringify(stake.data, null, 2)?.slice(0, 2000)}
        </pre>
      </div>
    </div>
  );
}
