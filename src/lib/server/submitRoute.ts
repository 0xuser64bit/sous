/**
 * Which chain a signed transaction belongs to.
 *
 * `needs_signature` carries a `submit` hint naming the route the sidecar
 * built for: `cookie-rpc`, `solana-rpc` (the far leg of a bridge), or
 * `candyshop`. The relay's direct fallback only speaks Cookie Chain, so it
 * must not be used for the others — a bridge's account-creation leg comes
 * back with `{ via: "solana-rpc" }` and a Solana `lastValidBlockHeight`
 * around 427,000,000 against Cookie Chain's ~25,900,000, so pushing those
 * bytes at the Cookie RPC would fail on a blockhash nobody can explain and
 * then mis-read the expiry check on the way out.
 *
 * Framework-free so the policy is unit-testable without booting Next.
 */

export const COOKIE_ROUTE = "cookie-rpc";

export type SubmitRoute = {
  /** Route named by the sidecar, defaulting to Cookie Chain. */
  via: string;
  /** True only when the direct Cookie RPC fallback is a valid substitute. */
  canFallBackDirect: boolean;
};

export function submitRouteOf(submit: unknown): SubmitRoute {
  if (!submit || typeof submit !== "object" || Array.isArray(submit)) {
    // No hint at all: every tool that omits one builds for Cookie Chain.
    return { via: COOKIE_ROUTE, canFallBackDirect: true };
  }
  const via = (submit as { via?: unknown }).via;
  if (typeof via !== "string" || !via) {
    return { via: COOKIE_ROUTE, canFallBackDirect: true };
  }
  return { via, canFallBackDirect: via === COOKIE_ROUTE };
}
