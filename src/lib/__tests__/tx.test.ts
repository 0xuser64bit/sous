import { describe, expect, it } from "vitest";
import { VersionedTransaction } from "@solana/web3.js";
import { b64ToBytes, bytesToB64, TxError } from "../tx/signAndSend";
import { NEEDS_SIGNATURE_TRADE } from "./fixtures/sidecar";

describe("tx codecs", () => {
  it("round-trips bytes through base64", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 16, 32]);
    expect(b64ToBytes(bytesToB64(bytes))).toEqual(bytes);
  });
  it("handles large payloads without stack overflow", () => {
    const bytes = new Uint8Array(8192).map((_, i) => i % 256);
    expect(b64ToBytes(bytesToB64(bytes))).toEqual(bytes);
  });
  it("rejects malformed base64", () => {
    expect(() => b64ToBytes("!!!")).toThrow(TxError);
    expect(() => b64ToBytes("abc")).toThrow(TxError); // bad length
    expect(() => b64ToBytes("")).toThrow(TxError);
  });
  it("TxError carries codes", () => {
    expect(new TxError("rejected", "no").code).toBe("rejected");
    expect(new TxError("expired", "old").code).toBe("expired");
  });
});

/**
 * The signing leg, against bytes a live cookie-mcp actually produced.
 * Everything here happens in the browser before and after the wallet call,
 * so it is testable without a wallet — and it was the only part of the
 * money path with no coverage at all.
 */
describe("real needs_signature payload", () => {
  const b64 = NEEDS_SIGNATURE_TRADE.transactionBase64;

  it("decodes the sidecar's base64 as-is", () => {
    // Padding and alphabet are the sidecar's choice, not ours; b64ToBytes
    // refuses unpadded input, so this pins that the two agree.
    expect(b64.length % 4).toBe(0);
    expect(() => b64ToBytes(b64)).not.toThrow();
  });

  it("deserializes as the v0 transaction it says it is", () => {
    const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
    expect(tx.message.version).toBe(0);
    expect(NEEDS_SIGNATURE_TRADE.version).toBe("v0");
  });

  it("re-serializes unsigned without verifying signatures", () => {
    // The wallet has not signed yet, so the signature slot is 64 zero bytes.
    // VersionedTransaction.serialize() must not object; if this ever throws,
    // every swap breaks between the wallet returning and the relay call.
    const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
    expect(tx.signatures[0].every((byte) => byte === 0)).toBe(true);
    expect(() => tx.serialize()).not.toThrow();
  });

  it("round-trips back to the exact bytes the sidecar sent", () => {
    const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
    expect(bytesToB64(tx.serialize())).toBe(b64);
  });

  it("carries what the guard and the relay each need", () => {
    expect(NEEDS_SIGNATURE_TRADE.submit).toEqual({ via: "cookie-rpc" });
    expect(NEEDS_SIGNATURE_TRADE.blockhash).toBeTruthy();
    expect(NEEDS_SIGNATURE_TRADE.lastValidBlockHeight).toBeGreaterThan(0);
    expect(NEEDS_SIGNATURE_TRADE.summary.output.minAmount).toBeTruthy();
  });
});
