import { describe, expect, it } from "vitest";
import { b64ToBytes, bytesToB64, TxError } from "../tx/signAndSend";

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
