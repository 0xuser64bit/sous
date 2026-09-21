"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { callMcp } from "@/lib/mcp/client";
import { balanceRows, stakeRows } from "@/lib/mcp/shapes";
import { shortAddr } from "@/lib/utils/format";
import { addressUrl } from "@/lib/chain/explorer";
import { usePilotStore } from "@/lib/store/usePilotStore";
import { Section } from "@/components/layout/Section";
import { StandingOrders } from "./StandingOrders";
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
    queryFn: () => callMcp({ tool: "get_balance", wallet, args: { wallet } }),
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

  const balRows = bal.data ? balanceRows(bal.data) : null;
  const staking = stake.data ? stakeRows(stake.data) : null;

  return (
    <div className="flex min-w-0 flex-col">
      {/* Wallet shelf-mark */}
      <div className="flex min-w-0 items-center gap-2 px-3 pb-1 pt-4 sm:px-4">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: "var(--success)" }}
        />
        <a
          href={addressUrl(wallet)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[32px] min-w-0 flex-1 items-center truncate font-mono text-[12px] tnum transition-opacity hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
          title={wallet}
        >
          <span className="truncate">{shortAddr(wallet, 6)} ↗</span>
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
          ) : staking?.length ? (
            <DataRows rows={staking} />
          ) : (
            <DataRows rows={[]} />
          )}
          <StakeActions />
        </Section>
      </div>
      <StandingOrders />
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
      className="flex min-h-[36px] min-w-[36px] items-center justify-center font-mono text-[13px] transition-opacity hover:opacity-70 disabled:opacity-40"
      style={{ color: "var(--text-tertiary)" }}
      disabled={spinning}
    >
      <span aria-hidden className={spinning ? "animate-live inline-block" : "inline-block"}>
        ↻
      </span>
    </button>
  );
}

/**
 * Pantry stake/unstake quick-fire. Writes a paper ticket to the pass —
 * the wallet still signs there, so the pantry never moves money itself.
 */
function StakeActions() {
  const { publicKey } = useWallet();
  const push = usePilotStore((s) => s.push);
  const [amount, setAmount] = useState("");

  function write(kind: "stake" | "unstake") {
    if (!publicKey) {
      toast.error("Connect Nightly first");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter an amount first", { description: "e.g. 10" });
      return;
    }
    push({
      role: "assistant",
      text: "",
      quote: {
        orderKind: kind,
        amount: n,
        from: kind === "stake" ? "COOK" : "bCOOK",
        to: kind === "stake" ? "bCOOK" : "COOK",
        fireTool: kind,
        fireArgs: { amount: n },
        state: "proposed",
        note: "Written from the pantry — fire it at the pass.",
      },
    });
    toast.success("Ticket on the pass", { description: "Open Pass to fire it in Nightly." });
    setAmount("");
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor="stake-amount" className="sr-only">
        Amount to stake or unstake
      </label>
      <input
        id="stake-amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder="Amount"
        className="h-[44px] w-full min-w-0 flex-1 rounded-[var(--radius-md)] px-2.5 py-1.5 font-mono text-[12.5px] tnum outline-none transition-colors placeholder:text-[var(--text-tertiary)] min-[420px]:w-24 min-[420px]:flex-none sm:h-auto"
        style={{
          background: "var(--bg-inset)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      />
      <div className="flex w-full gap-2 min-[420px]:w-auto">
        <button
          onClick={() => write("stake")}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-md)] px-4 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-85 min-[420px]:flex-none sm:min-h-0 sm:px-3"
          style={{ background: "var(--copper)", color: "#1d1206" }}
        >
          Stake
        </button>
        <button
          onClick={() => write("unstake")}
          className="flex min-h-[44px] flex-1 items-center justify-center rounded-[var(--radius-md)] px-4 py-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-70 min-[420px]:flex-none sm:min-h-0 sm:px-3"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          Unstake
        </button>
      </div>
    </div>
  );
}
