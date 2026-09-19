import { NextRequest, NextResponse } from "next/server";
import { VersionedTransaction, Transaction, type Connection } from "@solana/web3.js";
import { getConnection } from "@/lib/chain/connection";
import { unwrapMcp } from "@/lib/mcp/shapes";
import { pickKey } from "@/lib/utils/format";

/**
 * POST /api/tx/submit { signedTx, submit?, blockhash?, lastValidBlockHeight?, what? }
 *
 * Single on-chain write path. The browser signs with Nightly; the server
 * relays the signed bytes — first via the sidecar's native
 * `submit_signed_tx` (it knows the per-route submit path: cookie-rpc,
 * solana-rpc, candyshop), falling back to direct Cookie RPC only when
 * the sidecar is unreachable.
 *
 * Safety rules:
 * - Never accept unsigned/unsigned-builder payloads — only fully-signed
 *   serialized transactions (base64, size-capped, structurally checked).
 * - Never retry blindly: an expired blockhash returns 409 + expired:true
 *   so the client re-quotes instead of resubmitting a dead transaction.
 * - An already-processed signature is returned as success (idempotent).
 */

const MCP_URL = process.env.MCP_HTTP_URL ?? "http://127.0.0.1:8787/mcp";
const MCP_SUBMIT_TIMEOUT_MS = 25_000;

const MAX_TX_BYTES = 8192;
const MIN_TX_BYTES = 64;

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

function sigOf(payload: unknown): string | null {
  if (typeof payload === "string" && payload.length >= 32) return payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const v = pickKey(payload as Record<string, unknown>, [
    "signature",
    "txSignature",
    "tx",
    "txid",
    "txHash",
    "txhash",
  ]);
  return typeof v === "string" && v.length >= 32 ? v : null;
}

/** Native path: let cookie-mcp submit on the route it chose. Null = transport failure (try direct). */
async function submitViaSidecar(args: {
  signedTx: string;
  submit?: unknown;
  blockhash?: string;
  lastValidBlockHeight?: number;
  what?: string;
}): Promise<{ signature: string } | { transportError: true } | { error: string; expired?: boolean }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), MCP_SUBMIT_TIMEOUT_MS);
  try {
    const upstream = await fetch(MCP_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `sous-submit-${Date.now().toString(36)}`,
        method: "tools/call",
        params: {
          name: "submit_signed_tx",
          arguments: {
            signedTransactionBase64: args.signedTx,
            ...(args.submit !== undefined ? { submit: args.submit } : {}),
            ...(args.blockhash ? { blockhash: args.blockhash } : {}),
            ...(typeof args.lastValidBlockHeight === "number"
              ? { lastValidBlockHeight: args.lastValidBlockHeight }
              : {}),
            ...(args.what ? { what: args.what } : {}),
          },
        },
      }),
    });
    const text = await upstream.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      return { error: "Sidecar returned non-JSON on submit." };
    }
    const payload = unwrapMcp(json);
    const isErr =
      (payload && typeof payload === "object" && (payload as Record<string, unknown>).isError === true) ||
      (payload && typeof payload === "object" && "error" in (payload as Record<string, unknown>));
    const sig = sigOf(payload);
    if (sig) return { signature: sig };
    if (isErr) {
      const msg =
        (payload as Record<string, unknown>).error instanceof Object
          ? JSON.stringify((payload as Record<string, unknown>).error).slice(0, 300)
          : String(
              (payload as Record<string, unknown>).error ??
                (payload as Record<string, unknown>).hint ??
                text.slice(0, 300),
            );
      if (/already been processed|already processed|duplicate/i.test(msg)) {
        return { error: "Transaction was already processed — check Cookiescan before re-firing." };
      }
      if (/blockhash not found|blockhash.*expired|expired/i.test(msg)) {
        return { error: `Quote expired before submit (${msg}). Re-quote — do not resubmit.`, expired: true };
      }
      return { error: msg };
    }
    return { error: "Sidecar submit returned no signature." };
  } catch {
    return { transportError: true as const };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Confirm by polling getSignatureStatuses over HTTP. cookie-mcp's own
 * submit path confirms server-side; this fallback deliberately avoids
 * `confirmTransaction`, which opens a websocket subscription — the WS
 * endpoint is not guaranteed, and a dead socket would hang the request.
 * Cookie Chain finalises in ~1s, so a 1s poll clears almost immediately.
 */
async function confirmByPolling(
  conn: Connection,
  sig: string,
  lastValidBlockHeight?: number,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const { value } = await conn.getSignatureStatuses([sig]);
    const st = value[0];
    if (st) {
      if (st.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(st.err).slice(0, 200)}`);
      }
      if (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized") return;
    } else if (typeof lastValidBlockHeight === "number") {
      // No status yet — if the chain has passed the quote's block window the
      // transaction can never land: report expiry rather than waiting it out.
      const height = await conn.getBlockHeight("confirmed");
      if (height > lastValidBlockHeight) {
        throw new Error("blockhash expired before confirmation");
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("confirmation timed out");
}

async function submitDirect(
  bytes: Buffer,
  lastValidBlockHeight?: number,
): Promise<string> {
  const conn = getConnection();
  const sig = await conn.sendRawTransaction(bytes, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 2,
  });
  await confirmByPolling(conn, sig, lastValidBlockHeight);
  return sig;
}

export async function POST(req: NextRequest) {
  let body: {
    signedTx?: unknown;
    submit?: unknown;
    blockhash?: unknown;
    lastValidBlockHeight?: unknown;
    what?: unknown;
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
    body.blockhash !== undefined &&
    (typeof body.blockhash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.blockhash))
  ) {
    return fail(400, "blockhash is not valid base58");
  }
  if (
    body.submit !== undefined &&
    (typeof body.submit !== "object" || body.submit === null || Array.isArray(body.submit))
  ) {
    return fail(400, "submit must be a JSON object (the `submit` from needs_signature)");
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

  const blockhash = typeof body.blockhash === "string" ? body.blockhash : undefined;
  const lastValidBlockHeight =
    typeof body.lastValidBlockHeight === "number" ? body.lastValidBlockHeight : undefined;
  const what = typeof body.what === "string" ? body.what : undefined;

  // 1) Native sidecar path (knows the per-route submitter).
  try {
    const via = await submitViaSidecar({
      signedTx: body.signedTx,
      submit: body.submit,
      blockhash,
      lastValidBlockHeight,
      what,
    });
    if ("signature" in via) return NextResponse.json({ signature: via.signature });
    if ("transportError" in via) {
      // 2) Sidecar unreachable — direct RPC fallback (same safety checks).
      try {
        const sig = await submitDirect(bytes, lastValidBlockHeight);
        return NextResponse.json({ signature: sig, via: "cookie-rpc-direct" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "submit failed";
        if (/already been processed|already processed|duplicate/i.test(msg)) {
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
    // Sidecar refused at the application level — do NOT fall back blindly.
    if (via.expired) return fail(502, via.error, { expired: true as const });
    return fail(502, via.error);
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : "submit failed");
  }
}
