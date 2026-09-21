/**
 * What "offline" actually means.
 *
 * Every read in this app goes through the sidecar, so when `chain_health`
 * fails the pulse used to read "offline" — pointing the user at Cookie
 * Chain when the thing that was down was a local process. The two have
 * completely different fixes, and only one of them is the user's to make.
 *
 * `/api/health` talks to the RPC directly with no sidecar in the path, so
 * the pair of results tells them apart.
 */

export type ChainStatus =
  | { state: "live"; slot: string }
  /** Sidecar unreachable, chain answering: the app is broken, not the chain. */
  | { state: "sidecar-down" }
  /** Neither answered. */
  | { state: "chain-down" }
  /** Still loading, or not enough information to say. */
  | { state: "unknown" };

export function classifyChain(opts: {
  /** Slot from the sidecar's chain_health, or null when unreadable. */
  slot: string | null;
  /** True when the sidecar read failed outright. */
  sidecarFailed: boolean;
  /** Direct RPC probe: true ok, false failed, null not attempted yet. */
  rpcOk: boolean | null;
}): ChainStatus {
  if (opts.slot !== null) return { state: "live", slot: opts.slot };
  if (!opts.sidecarFailed) return { state: "unknown" };
  if (opts.rpcOk === true) return { state: "sidecar-down" };
  if (opts.rpcOk === false) return { state: "chain-down" };
  return { state: "unknown" };
}

/** Short label for the pulse. */
export function statusLabel(s: ChainStatus): string {
  switch (s.state) {
    case "live":
      return `slot ${s.slot}`;
    case "sidecar-down":
      return "sidecar down";
    case "chain-down":
      return "chain offline";
    case "unknown":
      return "checking…";
  }
}

/** Sentence for a tooltip or a rail, naming the fix when there is one. */
export function statusDetail(s: ChainStatus): string {
  switch (s.state) {
    case "live":
      return `Cookie Chain slot ${s.slot}`;
    case "sidecar-down":
      // Two audiences, one string. A visitor cannot start our sidecar, so
      // naming the command only confuses them; a developer running locally
      // wants exactly that command.
      return process.env.NODE_ENV === "development"
        ? "Cookie Chain is answering, but cookie-mcp is not. Start it: COOKIE_SIGNER=external npx -y cookie-mcp --http 8787"
        : "Cookie Chain is answering, but our quoting service is not. Reads and fills are down until it returns.";
    case "chain-down":
      return "Neither the sidecar nor the Cookie Chain RPC is answering.";
    case "unknown":
      return "Checking the chain…";
  }
}
