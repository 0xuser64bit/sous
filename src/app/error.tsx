"use client";

import { useEffect } from "react";
import { SousMark } from "@/components/brand/SousMark";

/**
 * Pass-level error boundary. A dropped ticket, not a blank room:
 * explain in kitchen voice, offer a reset, keep the brand.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Pass error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <SousMark size={44} />
      <h1 className="font-display text-balance text-[clamp(1.5rem,6vw,1.75rem)] font-semibold">
        Dropped the ticket.
      </h1>
      <p className="max-w-sm text-balance text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Something burnt on the pass
        {error.digest ? (
          <>
            {" "}(ticket <span className="font-mono text-[12px]">{error.digest}</span>)
          </>
        ) : (
          ""
        )}
        . Your wallet is untouched — nothing was signed.
      </p>
      <button
        onClick={reset}
        className="flex min-h-[48px] items-center justify-center rounded-[var(--radius-md)] px-6 py-2.5 text-[13.5px] font-semibold transition-opacity hover:opacity-85"
        style={{ background: "var(--copper)", color: "#1d1206" }}
      >
        Fire it again
      </button>
    </div>
  );
}
