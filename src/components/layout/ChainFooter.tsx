import { COOKIE_RPC_URL, COOKIESCAN_BASE } from "@/lib/chain/config";

/** Host only — the full RPC URL is noise in a 10px footer. */
function rpcHost(): string {
  try {
    return new URL(COOKIE_RPC_URL).host;
  } catch {
    return COOKIE_RPC_URL;
  }
}

/**
 * The receipt line: which RPC this build talks to, and a way out to the
 * explorer. Shared by the landing page and the pass — they had separate
 * copies that were already one edit apart.
 *
 * `compact` hides it below sm, which is what the pass wants: mid-trade on a
 * phone it costs ~50px of feed height and nothing in it is actionable.
 */
export function ChainFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={compact ? "hidden shrink-0 sm:block" : ""}
      style={{
        borderTop: "1px solid var(--border-subtle)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3 font-mono text-[10.5px] sm:px-4"
        style={{ color: "var(--text-tertiary)" }}
      >
        <span className="min-w-0 truncate">
          rpc <span style={{ color: "var(--text-secondary)" }}>{rpcHost()}</span>
        </span>
        <a
          href={COOKIESCAN_BASE}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[32px] shrink-0 items-center transition-opacity hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
        >
          cookiescan ↗
        </a>
        <span className="w-full sm:ml-auto sm:w-auto sm:text-right">
          fired in Nightly · settled on Cookie Chain
        </span>
      </div>
    </footer>
  );
}
