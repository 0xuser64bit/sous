"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";
import { fmtCook, shortAddr } from "@/lib/utils/format";

function Skeleton() {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="h-3 w-20 rounded animate-skeleton" style={{ background: "var(--border)" }} />
      <div className="h-3 w-32 rounded animate-skeleton" style={{ background: "var(--border)" }} />
      <div className="h-3 w-24 rounded animate-skeleton" style={{ background: "var(--border)" }} />
    </div>
  );
}

/** Portfolio sidebar section. Compact, structured, not a JSON dump. */
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

  if (!wallet) {
    return (
      <div className="px-4 py-4">
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Connect wallet to see balances and staking info.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Wallet address */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--success)" }}
        />
        <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
          {shortAddr(wallet, 6)}
        </span>
      </div>

      {/* Balances */}
      <div className="px-4 py-3">
        <div
          className="mb-2 text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Balances
        </div>
        {bal.isPending ? (
          <Skeleton />
        ) : bal.data && typeof bal.data === "object" ? (
          <BalanceList data={bal.data as Record<string, unknown>} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            No balance data
          </p>
        )}
      </div>

      {/* Staking */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3">
        <div
          className="mb-2 text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          bCOOK Staking
        </div>
        {stake.isPending ? (
          <Skeleton />
        ) : stake.data && typeof stake.data === "object" ? (
          <StakeInfo data={stake.data as Record<string, unknown>} />
        ) : (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            No staking data
          </p>
        )}
      </div>
    </div>
  );
}

function BalanceList({ data }: { data: Record<string, unknown> }) {
  // Attempt to display structured data; fall back to key-value pairs
  const entries = Object.entries(data).slice(0, 10);
  if (entries.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        No balances found
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {entries.map(([key, val]) => (
        <div
          key={key}
          className="flex items-baseline justify-between text-xs"
        >
          <span className="truncate font-mono" style={{ color: "var(--text-secondary)" }}>
            {key}
          </span>
          <span className="ml-2 shrink-0 font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {typeof val === "number"
              ? fmtCook(val)
              : String(val).slice(0, 20)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StakeInfo({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).slice(0, 6);
  if (entries.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        No staking info
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {entries.map(([key, val]) => (
        <div
          key={key}
          className="flex items-baseline justify-between text-xs"
        >
          <span className="truncate" style={{ color: "var(--text-secondary)" }}>
            {key.replace(/_/g, " ")}
          </span>
          <span className="ml-2 shrink-0 font-mono tabular-nums" style={{ color: "var(--text-primary)" }}>
            {typeof val === "number"
              ? val.toLocaleString(undefined, { maximumFractionDigits: 4 })
              : String(val).slice(0, 20)}
          </span>
        </div>
      ))}
    </div>
  );
}
