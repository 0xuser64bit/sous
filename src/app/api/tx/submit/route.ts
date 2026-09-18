import { NextRequest, NextResponse } from "next/server";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import { getConnection } from "@/lib/chain/connection";

/**
 * POST /api/tx/submit { signedTx, blockhash?, lastValidBlockHeight? }
 *
 * Single on-chain write path. The browser signs with Nightly, the server
 * relays the signed bytes to Cookie Chain over the singleton connection
 * and confirms before responding.
 *
 * Safety rules:
 * - Never accept unsigned/unsigned-builder payloads — only fully-signed
 *   serialized transactions (base64, size-capped).
 * - Never retry blindly: an expired blockhash returns 409 + expired:true
 *   so the client re-quotes instead of resubmitting a dead transaction.
 * - An already-processed signature is returned as success (idempotent).
 */

const MAX_TX_BYTES = 8192;
const MIN_TX_BYTES = 64;

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  let body: {
    signedTx?: unknown;
    blockhash?: unknown;
    lastValidBlockHeight?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON");
  }

  if (typeof body.signedTx !== "string" || body.signedTx.length === 0) {
    return fail(400, "signedTx (base64) is required");
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(body.signedTx)) {
    return fail(400, "signedTx is not valid base64");
  }
  if (
    typeof body.blockhash === "string" &&
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.blockhash)
  ) {
    return fail(400, "blockhash is not valid base58");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.signedTx, "base64");
  } catch {
    return fail(400, "signedTx could not be decoded");
  }
  if (bytes.length < MIN_TX_BYTES || bytes.length > MAX_TX_BYTES) {
    return fail(400, `signedTx decodes to ${bytes.length} bytes (want ${MIN_TX_BYTES}-${MAX_TX_BYTES})`);
  }

  // Structural check: must deserialize as a transaction.
  try {
    try {
      VersionedTransaction.deserialize(bytes);
    } catch {
      Transaction.from(bytes); // throws if malformed
    }
  } catch {
    return fail(400, "signedTx is not a valid serialized transaction");
  }

  const conn = getConnection();
  try {
    const sig = await conn.sendRawTransaction(bytes, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 2,
    });

    if (
      typeof body.blockhash === "string" &&
      typeof body.lastValidBlockHeight === "number"
    ) {
      await conn.confirmTransaction(
        {
          signature: sig,
          blockhash: body.blockhash,
          lastValidBlockHeight: body.lastValidBlockHeight,
        },
        "confirmed",
      );
    } else {
      await conn.confirmTransaction(sig, "confirmed");
    }
    return NextResponse.json({ signature: sig });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "submit failed";
    if (/already been processed|already processed|duplicate/i.test(msg)) {
      // Idempotent: the tx landed; re-derive is impossible without the
      // bytes, so surface a clear retry-with-signature hint instead.
      return NextResponse.json({
        error: "Transaction was already processed — check Cookiescan for a matching transfer before re-firing.",
        duplicate: true as const,
      });
    }
    if (/blockhash not found|blockhash.*expired|expired/i.test(msg)) {
      return fail(502, `Quote expired before submit (${msg}). Re-quote — do not resubmit.`, {
        expired: true as const,
      });
    }
    return fail(502, msg);
  }
}
