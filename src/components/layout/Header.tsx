"use client";

import { useQuery } from "@tanstack/react-query";
import { WalletButton } from "@/components/wallet/WalletButton";
import { SousMark } from "@/components/brand/SousMark";
import { callMcp } from "@/lib/mcp/client";
import { APP_TAGLINE } from "@/lib/chain/config";

function slotOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const slot = d.slot;
  if (typeof slot === "number" || typeof slot === "string") return String(slot);
  return null;
}

function ChainPulse() {
  const { data } = useQuery({
    queryKey: ["chain_health"],
    queryFn: () => callMcp({ tool: "chain_health", args: {} }),
    refetchInterval: 15_000,
    retry: 1,
    staleTime: 10_000,
  });
  const slot = slotOf(data);
  const live = slot !== null;

  return (
    <div
      className="hidden items-center gap-2 sm:flex"
      title={live ? `Cookie Chain slot ${slot}` : "Chain sidecar unreachable"}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "animate-live" : ""}`}
        style={{ background: live ? "var(--success)" : "var(--text-tertiary)" }}
      />
      <span
        className="font-mono text-[11px] tnum"
        style={{ color: "var(--text-tertiary)" }}
      >
        {live ? `slot ${slot}` : "offline"}
      </span>
    </div>
  );
}

export function Header() {
  return (
    <header
      className="sticky top-0 z-20 shrink-0"
      style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <SousMark size={26} />
          <div className="flex min-w-0 flex-col leading-none">
            <span className="font-display text-[17px] font-semibold">
              Sous
            </span>
            <span
              className="mt-1 hidden text-[9px] font-medium uppercase tracking-[0.16em] min-[400px]:block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {APP_TAGLINE}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ChainPulse />
          <span
            aria-hidden
            className="hidden h-4 w-px sm:block"
            style={{ background: "var(--border)" }}
          />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
