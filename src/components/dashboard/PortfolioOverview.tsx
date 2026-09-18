"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { callMcp } from "@/lib/mcp/client";
import { unwrapMcp, toRows } from "@/lib/mcp/shapes";
import { shortAddr } from "@/lib/utils/format";
import { addressUrl } from "@/lib/chain/explorer";
import { Section } from "@/components/layout/Section";
import { DataRows, RowsSkeleton, RowsError, sidecarHint } from "@/components/layout/DataRows";

/**
 * The pantry — what the kitchen holds. Balances for this wallet,
 * bCOOK staking for the house. Reads only; firing happens at the pass.
 */
export function PortfolioOverview() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();

  const bal = useQuery({
    queryKey: ["balance", wallet],
    queryFn: () => callMcp({ tool: "get_balance", wallet, args: {} }),
    enabled: Boolean(wallet),
    retry: 1,
  });
  const stake = useQuery({
    queryKey: ["stake_info"],
    queryFn: () => callMcp({ tool: "stake_info", args: {} }),
    retry: 1,
    staleTime: 30_000,
  });

  if (!wallet) {
    return (
      <Section label="Pantry">
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Hang your wallet on the hook — connect Nightly to stock the
          pantry with balances and staking.
        </p>
      </Section>
    );
  }

  const balRows = bal.data ? toRows(unwrapMcp(bal.data), 8) : null;
  const stakeRows = stake.data ? toRows(unwrapMcp(stake.data), 6) : null;

  return (
    <div className="flex flex-col">
      {/* Wallet shelf-mark */}
      <div className="flex items-center gap-2 px-4 pb-1 pt-4">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--success)" }}
        />
        <a
          href={addressUrl(wallet)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[12px] tnum transition-opacity hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
          title={wallet}
        >
          {shortAddr(wallet, 6)} ↗
        </a>
      </div>

      <Section
        label="Balances"
        action={
          <RefreshButton onClick={() => void bal.refetch()} spinning={bal.isFetching} label="Refresh balances" />
        }
      >
        {bal.isPending ? (
          <RowsSkeleton lines={3} />
        ) : bal.isError ? (
          <RowsError message={sidecarHint(bal.error.message)} onRetry={() => void bal.refetch()} />
        ) : balRows ? (
          <DataRows rows={balRows.rows} more={balRows.more} />
        ) : (
          <DataRows rows={[]} />
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <Section
          label="bCOOK Staking"
          action={
            <RefreshButton onClick={() => void stake.refetch()} spinning={stake.isFetching} label="Refresh staking" />
          }
        >
          {stake.isPending ? (
            <RowsSkeleton lines={3} />
          ) : stake.isError ? (
            <RowsError message={sidecarHint(stake.error.message)} onRetry={() => void stake.refetch()} />
          ) : stakeRows ? (
            <DataRows rows={stakeRows.rows} more={stakeRows.more} />
          ) : (
            <DataRows rows={[]} />
          )}
        </Section>
      </div>
    </div>
  );
}

function RefreshButton({
  onClick,
  spinning,
  label,
}: {
  onClick: () => void;
  spinning: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="font-mono text-[11px] transition-opacity hover:opacity-70 disabled:opacity-40"
      style={{ color: "var(--text-tertiary)" }}
      disabled={spinning}
    >
      <span aria-hidden className={spinning ? "animate-live inline-block" : "inline-block"}>
        ↻
      </span>
    </button>
  );
}
