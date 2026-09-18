import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import { callMcp, isNeedsSignature } from "@/lib/mcp/client";
import { signAndSubmitNeedsSignature, TxError } from "./signAndSend";

/**
 * Shared cancel-limit-order flow: ask the sidecar, sign only if it
 * answers needs_signature, report back. Used by the chat pass and by
 * the pantry's standing-orders board so both stay identical.
 */
export async function cancelLimitOrder(opts: {
  orderId: string;
  wallet?: string;
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<T>;
  onPhase?: (p: "quoting" | "awaiting_signature" | "confirming") => void;
}): Promise<{ signature?: string; note: string }> {
  opts.onPhase?.("quoting");
  const res = await callMcp({
    tool: "cancel_limit_order",
    wallet: opts.wallet,
    args: { orderId: opts.orderId },
  });
  if (!isNeedsSignature(res)) return { note: "cancelled" };
  if (res.kind !== "transaction" || !res.transactionBase64) {
    throw new TxError("failed", "Unexpected cancel payload from sidecar.");
  }
  opts.onPhase?.("awaiting_signature");
  const sig = await signAndSubmitNeedsSignature(res, opts.signTransaction);
  return { signature: sig, note: "cancelled on-chain" };
}
