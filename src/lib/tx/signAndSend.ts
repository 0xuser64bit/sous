import type { NeedsSignature } from "@/lib/mcp/client";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { getConnection } from "@/lib/chain/connection";
import { usePilotStore } from "@/lib/store/usePilotStore";

/**
 * Signs `transactionBase64` from cookie-mcp (external-signer mode) with the
 * user's Nightly wallet, then submits via `/api/mcp` -> submit_signed_tx path.
 * v0: submit through wallet's own connection for simplest demo.
 * v1: route via server `submit_signed_tx` to preserve blockhash/submit route.
 */
export async function signAndSubmitNeedsSignature(
  payload: NeedsSignature,
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<T>,
): Promise<string> {
  if (payload.kind !== "transaction" || !payload.transactionBase64) {
    throw new Error("Unsupported signature payload (expected transaction).");
  }
  const store = usePilotStore.getState();
  store.setPhase("sending");

  const raw = Buffer.from(payload.transactionBase64, "base64");
  let tx: Transaction | VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(raw);
  } catch {
    tx = Transaction.from(raw);
  }
  const signed = await signTransaction(tx);
  const conn = getConnection();
  store.setPhase("confirming");
  const sig = await conn.sendRawTransaction(
    "serialize" in signed
      ? (signed as VersionedTransaction).serialize()
      : (signed as Transaction).serialize(),
  );
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
