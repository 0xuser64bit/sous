/**
 * Firing a ticket: the money path, start to receipt.
 *
 * quote → guard → wallet → relay, with the sidecar's bounded
 * `step: "intermediate"` continuation in the middle. It lived inside the
 * chat component, which meant the one piece of code that decides whether a
 * user's transaction is signed had no test that could reach it.
 *
 * No React, no store, no toasts: callers pass what they have and get back a
 * described outcome. Progress arrives through `onPhase`/`onNote` so the UI
 * can follow along without this module knowing what a UI is.
 */
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import { callMcp, isNeedsSignature, type NeedsSignature } from "@/lib/mcp/client";
import { guardSummary } from "@/lib/tx/guard";
import {
  signAndSubmitNeedsSignature,
  signMessageNeedsSignature,
  TxError,
} from "@/lib/tx/signAndSend";
import type { QuoteData, TxPhase } from "@/lib/store/usePilotStore";

export type SignTransaction = <T extends Transaction | VersionedTransaction>(
  tx: T,
) => Promise<T>;

export type FireDeps = {
  wallet?: string;
  signTransaction: SignTransaction;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
  onPhase?: (p: TxPhase) => void;
  /** A line to pin on the ticket while it is in flight. */
  onNote?: (note: string) => void;
  /** Every signature as it lands, including prerequisite legs. */
  onSignature?: (signature: string) => void;
};

export type FireOutcome =
  /** The sidecar filled it without asking for a signature. */
  | { kind: "filled" }
  /** Signed, submitted, and confirmed on-chain. */
  | { kind: "served"; signature: string; summary: unknown }
  /** Signed and submitted, but not confirmed in time. The bytes are out there. */
  | { kind: "pending"; signature: string; note: string }
  /** A `kind: "message"` proof, not a transaction. */
  | { kind: "proof"; signature: string };

/**
 * How many signatures one ticket may ask for. The sidecar chains
 * prerequisites (wrapping COOK, creating a far-side token account) through
 * `step: "intermediate"`; this bounds the chain so a misbehaving or
 * looping sidecar can never keep re-opening the wallet.
 */
export const MAX_SIGNING_STEPS = 3;

/** One quote → guard → sign → submit round. */
async function fireOnce(
  q: QuoteData,
  deps: FireDeps,
): Promise<{ done: true; outcome: FireOutcome } | { done: false }> {
  deps.onPhase?.("quoting");
  const res = await callMcp({ tool: q.fireTool, wallet: deps.wallet, args: q.fireArgs });

  if (!isNeedsSignature(res)) {
    deps.onPhase?.("idle");
    return { done: true, outcome: { kind: "filled" } };
  }
  const payload: NeedsSignature = res;

  if (payload.kind === "message") {
    if (!deps.signMessage) {
      throw new TxError("failed", "This wallet cannot sign messages.");
    }
    deps.onPhase?.("awaiting_signature");
    const text = payload.message ?? payload.next ?? q.fireTool;
    const signature = await signMessageNeedsSignature(text, deps.signMessage);
    deps.onPhase?.("idle");
    return { done: true, outcome: { kind: "proof", signature } };
  }

  // The sidecar re-quotes at fire time: this is the last point at which what
  // the user read and what the wallet will sign are compared.
  const check = guardSummary(payload.summary, q);
  if (!check.ok) {
    throw new TxError("failed", `Refused to sign — ${check.detail ?? "summary mismatch"}.`);
  }
  if (!check.checked) {
    // Never imply a comparison that did not happen. stake/unstake send no
    // summary; the sidecar's own simulation is the only check there.
    deps.onNote?.(
      "Sidecar sent no itemised summary for this tool — read the wallet prompt itself.",
    );
  }

  deps.onPhase?.("awaiting_signature");
  const { signature, confirmed, note } = await signAndSubmitNeedsSignature(
    payload,
    deps.signTransaction,
  );
  deps.onSignature?.(signature);

  if (!confirmed) {
    // Sent but unconfirmed. Claiming "Served" here would be a lie, and
    // dropping the signature would leave the user unable to check at all.
    deps.onPhase?.("idle");
    return {
      done: true,
      outcome: {
        kind: "pending",
        signature,
        note:
          note ??
          "Sent, but the chain had not confirmed it yet. Open the receipt on Cookiescan before re-firing.",
      },
    };
  }

  // A prerequisite leg confirmed. The sidecar's contract is to call the same
  // tool again only once it has landed, so this check sits after the
  // confirmation, not before it.
  if (payload.step === "intermediate") return { done: false };

  deps.onPhase?.("confirmed");
  return { done: true, outcome: { kind: "served", signature, summary: payload.summary } };
}

/**
 * Fire a ticket to completion, following at most MAX_SIGNING_STEPS
 * prerequisite signatures. Throws TxError on refusal, rejection, or
 * failure; the caller decides how to show it.
 */
export async function fireTicket(q: QuoteData, deps: FireDeps): Promise<FireOutcome> {
  for (let step = 0; step < MAX_SIGNING_STEPS; step++) {
    const round = await fireOnce(q, deps);
    if (round.done) return round.outcome;
    deps.onNote?.("First leg confirmed — firing the follow-up.");
  }
  throw new TxError("failed", "Too many signing steps — stopped rather than loop.");
}
