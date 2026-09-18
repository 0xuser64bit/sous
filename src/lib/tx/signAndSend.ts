import type { NeedsSignature } from "@/lib/mcp/client";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { usePilotStore } from "@/lib/store/usePilotStore";

/** Typed failure so the UI can tell "declined" apart from "broken". */
export class TxError extends Error {
  readonly code: "rejected" | "expired" | "failed";
  constructor(code: TxError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Browser-safe base64 → bytes. `Buffer` is a Node API and must not be
 * assumed in client bundles — atob ships in every browser.
 */
export function b64ToBytes(b64: string): Uint8Array {
  if (!/^[A-Za-z0-9+/=]*$/.test(b64) || b64.length % 4 !== 0 || b64.length === 0) {
    throw new TxError("failed", "Signature payload is not valid base64.");
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** bytes → base64 without blowing the call stack on large payloads. */
export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function isRejection(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /reject|declined|denied|cancelled|canceled|dismissed|user.*(close|close)/i.test(m);
}

/**
 * Signs `transactionBase64` from cookie-mcp (external-signer mode) with the
 * user's Nightly wallet, then relays via POST /api/tx/submit which sends
 * and confirms on Cookie Chain.
 *
 * Throws TxError with code:
 * - "rejected" — user declined in the wallet. Nothing moved.
 * - "expired" — blockhash died before submit. Re-quote, do not resubmit.
 * - "failed" — anything else.
 */
export async function signAndSubmitNeedsSignature(
  payload: NeedsSignature,
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T,
  ) => Promise<T>,
): Promise<string> {
  if (payload.kind !== "transaction" || !payload.transactionBase64) {
    throw new TxError("failed", "Unsupported signature payload (expected transaction).");
  }
  const store = usePilotStore.getState();
  store.setPhase("sending");

  let raw: Uint8Array;
  try {
    raw = b64ToBytes(payload.transactionBase64);
  } catch (e) {
    throw e instanceof TxError ? e : new TxError("failed", "Bad transaction payload.");
  }

  let tx: Transaction | VersionedTransaction;
  try {
    try {
      tx = VersionedTransaction.deserialize(raw);
    } catch {
      // web3.js accepts a plain Uint8Array — no Node Buffer needed.
      tx = Transaction.from(raw);
    }
  } catch {
    throw new TxError("failed", "Payload is not a valid transaction.");
  }

  let signed: Transaction | VersionedTransaction;
  try {
    signed = await signTransaction(tx);
  } catch (e) {
    if (isRejection(e)) throw new TxError("rejected", "Signature declined — nothing moved, Chef.");
    throw new TxError("failed", e instanceof Error ? e.message : "Wallet signing failed.");
  }

  const serialized =
    "serialize" in signed && typeof signed.serialize === "function"
      ? signed.serialize()
      : (signed as Transaction).serialize();

  store.setPhase("confirming");
  let res: Response;
  try {
    res = await fetch("/api/tx/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        signedTx: bytesToB64(serialized),
        submit: payload.submit,
        blockhash: payload.blockhash,
        lastValidBlockHeight: payload.lastValidBlockHeight,
        what: payload.what,
      }),
    });
  } catch {
    throw new TxError("failed", "Submit relay unreachable — check your connection and retry.");
  }

  const json = (await res.json().catch(() => null)) as {
    signature?: string;
    error?: string;
    expired?: boolean;
  } | null;

  if (!res.ok || !json?.signature) {
    if (json?.expired) {
      throw new TxError(
        "expired",
        "Quote expired before submit. Re-fire for a fresh quote — the old one was not resubmitted.",
      );
    }
    throw new TxError("failed", json?.error ?? `Submit failed (${res.status}).`);
  }
  return json.signature;
}

/**
 * Message-signing path (domain ownership proofs, order auth).
 * Signs UTF-8 bytes and returns the base64 signature for the caller
 * to forward to whichever MCP tool requested the proof.
 */
export async function signMessageNeedsSignature(
  message: string,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  let sig: Uint8Array;
  try {
    sig = await signMessage(new TextEncoder().encode(message));
  } catch (e) {
    if (isRejection(e)) throw new TxError("rejected", "Signature declined — nothing moved, Chef.");
    throw new TxError("failed", e instanceof Error ? e.message : "Wallet signing failed.");
  }
  return bytesToB64(sig);
}
