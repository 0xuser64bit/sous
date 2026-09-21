import { describe, expect, it, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { submitDirect } from "@/app/api/tx/submit/route";

/**
 * One rule: once sendRawTransaction resolves, the bytes are on the network
 * and the signature is the only way the user can find out what happened to
 * them. Every path below that line must return it.
 *
 * Losing it is worse than any error message. "Submit failed" with no
 * signature reads as "nothing happened", and the natural response is to
 * fire again — turning a send that may well have landed into a second one.
 */

const SIG = "5".repeat(88);
const BYTES = Buffer.alloc(200);

// Loose on purpose: these fakes only need the handful of fields the code
// under test reads, not the whole RpcResponseAndContext shape.
function conn(over: Record<string, unknown>): Connection {
  return {
    sendRawTransaction: vi.fn(async () => SIG),
    getSignatureStatuses: vi.fn(async () => ({ value: [null] })),
    getBlockHeight: vi.fn(async () => 1),
    ...over,
  } as unknown as Connection;
}

describe("submitDirect keeps the signature", () => {
  it("returns it confirmed when the chain says so", async () => {
    const c = conn({
      getSignatureStatuses: vi.fn(async () => ({
        value: [{ err: null, confirmationStatus: "confirmed" }],
      })),
    });
    expect(await submitDirect(c, BYTES)).toEqual({ signature: SIG, confirmed: true });
  });

  it("returns it when the RPC falls over mid-poll", async () => {
    // The hiccup is in the confirm call, not the send. The transaction is
    // already out there; a 502 with no signature would strand the user.
    const c = conn({
      getSignatureStatuses: vi.fn(async () => {
        throw new Error("503 Service Unavailable");
      }),
    });
    const res = await submitDirect(c, BYTES);
    expect(res.signature).toBe(SIG);
    expect(res.confirmed).toBe(false);
    expect(res.note).toMatch(/503/);
  });

  it("returns it when the transaction failed on-chain", async () => {
    const c = conn({
      getSignatureStatuses: vi.fn(async () => ({
        value: [{ err: { InstructionError: [0, "Custom"] }, confirmationStatus: "confirmed" }],
      })),
    });
    const res = await submitDirect(c, BYTES);
    expect(res.signature).toBe(SIG);
    expect(res.confirmed).toBe(false);
    expect(res.note).toMatch(/failed on-chain/i);
  });

  it("returns it when the block window passed while waiting", async () => {
    // Expiry after sending is not the same as expiry before it: the
    // transaction may still have landed, so this must never read as
    // "nothing was sent".
    const c = conn({
      getSignatureStatuses: vi.fn(async () => ({ value: [null] })),
      getBlockHeight: vi.fn(async () => 999),
    });
    const res = await submitDirect(c, BYTES, 100);
    expect(res.signature).toBe(SIG);
    expect(res.confirmed).toBe(false);
    expect(res.note).toMatch(/expired/i);
  });

  it("still throws when the send itself never happened", async () => {
    // Before the point of no return there is no signature to protect, and
    // the caller needs the error to map duplicate/expired onto a 409.
    const c = conn({
      sendRawTransaction: vi.fn(async () => {
        throw new Error("blockhash not found");
      }),
    });
    await expect(submitDirect(c, BYTES)).rejects.toThrow(/blockhash not found/);
  });
});
