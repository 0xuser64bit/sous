"use client";

import { WalletButton } from "@/components/wallet/WalletButton";
import { SousMark } from "@/components/brand/SousMark";
import { statusDetail, statusLabel } from "@/lib/chain/status";
import { useChainStatus } from "./useChainStatus";
import { APP_TAGLINE } from "@/lib/chain/config";

function ChainPulse() {
  const { status } = useChainStatus();
  const live = status.state === "live";

  return (
    <div
      className="hidden items-center gap-2 sm:flex"
      title={statusDetail(status)}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "animate-live" : ""}`}
        style={{
          background: live
            ? "var(--success)"
            : status.state === "unknown"
              ? "var(--text-tertiary)"
              : "var(--error)",
        }}
      />
      <span
        className="font-mono text-[11px] tnum"
        style={{ color: live ? "var(--text-tertiary)" : "var(--error)" }}
      >
        {statusLabel(status)}
      </span>
    </div>
  );
}

export function Header() {
  return (
    <header
      className="sticky top-0 z-20 shrink-0"
      style={{
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <SousMark size={26} />
          <div className="flex min-w-0 flex-col leading-none">
            <span className="font-display truncate text-[17px] font-semibold">
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

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
