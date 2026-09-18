import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { cancelLimitOrder } from "../tx/cancelOrder";

function mcpResult(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function signedV0Base64(): string {
  const payer = Keypair.generate();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  return Buffer.from(tx.serialize()).toString("base64");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cancelLimitOrder", () => {
  it("returns direct fills without touching the wallet", async () => {
    const fetchMock = vi.fn(async () => mcpResult({ result: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const signTransaction = vi.fn(async (tx: never) => tx);
    const out = await cancelLimitOrder({
      orderId: "abc",
      wallet: "11111111111111111111111111111111",
      signTransaction: signTransaction as never,
    });
    expect(out).toEqual({ note: "cancelled" });
    expect(signTransaction).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("signs and submits when the sidecar asks for a signature", async () => {
    const needsSig = {
      status: "needs_signature",
      tool: "cancel_limit_order",
      kind: "transaction",
      transactionBase64: signedV0Base64(),
    };
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/tx/submit")) {
        return mcpResult({ signature: "SIG123" });
      }
      return mcpResult({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ text: JSON.stringify(needsSig) }] },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const phases: string[] = [];
    const out = await cancelLimitOrder({
      orderId: "abc",
      wallet: "11111111111111111111111111111111",
      signTransaction: (async (tx: never) => tx) as never,
      onPhase: (p) => phases.push(p),
    });
    expect(out).toEqual({ signature: "SIG123", note: "cancelled on-chain" });
    expect(phases).toContain("awaiting_signature");
  });

  it("rejects malformed cancel payloads", async () => {
    const fetchMock = vi.fn(async () =>
      mcpResult({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [{ text: JSON.stringify({ status: "needs_signature", tool: "x", kind: "message" }) }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      cancelLimitOrder({
        orderId: "abc",
        signTransaction: (async (tx: never) => tx) as never,
      }),
    ).rejects.toThrow("Unexpected cancel payload");
  });
});
