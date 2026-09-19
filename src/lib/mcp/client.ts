/**
 * Typed client for our Next.js -> cookie-mcp proxy (`/api/mcp`).
 * Browser NEVER talks to cookie-mcp directly. It POSTs { tool, args }
 * with x-cookie-wallet header, and gets back either data or
 * { status: 'needs_signature', transactionBase64, ... }.
 */
import { unwrapMcp } from "./shapes";
import { fetchWithTimeout } from "@/lib/utils/fetch";

export type McpTool =
  | "chain_health"
  | "search_tokens"
  | "get_token_info"
  | "get_quote"
  | "get_balance"
  | "get_pools"
  | "stake_info"
  | "trade"
  | "transfer"
  | "stake"
  | "unstake"
  | "place_limit_order"
  | "get_limit_orders"
  | "cancel_limit_order"
  | "bridge"
  | "bridge_status"
  | "resolve_domain";

export type NeedsSignature = {
  status: "needs_signature";
  tool: string;
  kind: "transaction" | "message";
  transactionBase64?: string;
  /** UTF-8 message to sign when kind === "message". */
  message?: string;
  /** Route hint for submit_signed_tx ({ via: cookie-rpc | solana-rpc | candyshop }). */
  submit?: unknown;
  blockhash?: string;
  lastValidBlockHeight?: number;
  /** Names the action for submit_signed_tx. */
  what?: string;
  /** Intermediate-step hint: call the original tool again afterwards. */
  step?: string;
  summary?: Record<string, unknown>;
  next?: string;
};

export async function callMcp<T = unknown>(opts: {
  tool: McpTool;
  args?: Record<string, unknown>;
  wallet?: string;
  /** Override the 30s sidecar timeout for slow builders. */
  timeoutMs?: number;
}): Promise<T | NeedsSignature> {
  const res = await fetchWithTimeout(
    "/api/mcp",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opts.wallet ? { "x-cookie-wallet": opts.wallet } : {}),
      },
      body: JSON.stringify({ tool: opts.tool, args: opts.args ?? {} }),
    },
    opts.timeoutMs ?? 30_000,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MCP ${opts.tool} failed (${res.status}): ${text}`);
  }
  // Unwrap the JSON-RPC/content envelope here so every caller — and in
  // particular every isNeedsSignature check — sees the real payload.
  const json = await res.json();
  return unwrapMcp(json) as T | NeedsSignature;
}

export function isNeedsSignature(v: unknown): v is NeedsSignature {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { status?: string }).status === "needs_signature"
  );
}
