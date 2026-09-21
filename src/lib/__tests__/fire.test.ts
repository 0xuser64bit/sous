import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { fireTicket, MAX_SIGNING_STEPS } from "../pass/fire";
import { TxError } from "../tx/signAndSend";
import type { QuoteData } from "../store/usePilotStore";
import { BCOOK_MINT, COOK_MINT, TRADE_SUMMARY } from "./fixtures/sidecar";

function signedV0Base64(): string {
  const payer = Keypair.generate();
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [],
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
}

function needsSignature(over: Record<string, unknown> = {}) {
  return {
    status: "needs_signature",
    tool: "trade",
    kind: "transaction",
    what: "trade",
    transactionBase64: signedV0Base64(),
    blockhash: "A9CXtqpby5MVaZXr3ZiFmWcJWXXdWSqcVEP596s8U27q",
    lastValidBlockHeight: 25905051,
    submit: { via: "cookie-rpc" },
    step: "final",
    summary: TRADE_SUMMARY,
    ...over,
  };
}

function mcpResponse(payload: unknown) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: "x",
      result: { content: [{ type: "text", text: JSON.stringify(payload) }] },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function submitResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** The ticket a user would be reading when TRADE_SUMMARY comes back. */
function swapTicket(over: Partial<QuoteData> = {}): QuoteData {
  return {
    orderKind: "swap",
    amount: 1,
    from: "bCOOK",
    to: "COOK",
    expectFrom: BCOOK_MINT,
    expectTo: COOK_MINT,
    quotedOut: 1.323123983,
    quotedMinOut: 1.256967783,
    slippageBps: 500,
    fireTool: "trade",
    fireArgs: { inputMint: BCOOK_MINT, outputMint: COOK_MINT, amount: 1 },
    state: "proposed",
    ...over,
  };
}

/**
 * Stub the two endpoints the fire path talks to. `mcp` is called once per
 * signing round, so pass one payload per round.
 */
function stubNetwork(opts: { rounds: unknown[]; submit?: () => Response }) {
  let round = 0;
  let submits = 0;
  const fetchMock = vi.fn(async (url: unknown) => {
    if (String(url).includes("/api/tx/submit")) {
      submits += 1;
      return opts.submit ? opts.submit() : submitResponse({ signature: `SIG${submits}` });
    }
    const payload = opts.rounds[Math.min(round, opts.rounds.length - 1)];
    round += 1;
    return mcpResponse(payload);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("fireTicket", () => {
  it("reports a direct fill when the sidecar needs no signature", async () => {
    const sign = vi.fn(async (tx: never) => tx);
    stubNetwork({ rounds: [{ ok: true, filled: true }] });
    const out = await fireTicket(swapTicket(), { signTransaction: sign as never });
    expect(out).toEqual({ kind: "filled" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("signs, submits, and reports served", async () => {
    stubNetwork({ rounds: [needsSignature()] });
    const phases: string[] = [];
    const out = await fireTicket(swapTicket(), {
      signTransaction: (async (tx: never) => tx) as never,
      onPhase: (p) => phases.push(p),
    });
    expect(out).toMatchObject({ kind: "served", signature: "SIG1" });
    expect(phases).toEqual(["quoting", "awaiting_signature", "confirmed"]);
  });

  it("never opens the wallet when the guard refuses", async () => {
    // The whole point of the guard: a fire-time re-quote that contradicts
    // the ticket must be stopped BEFORE the user is asked to approve it.
    const tampered = needsSignature({
      summary: { ...TRADE_SUMMARY, input: { ...TRADE_SUMMARY.input, amount: "99" } },
    });
    stubNetwork({ rounds: [tampered] });
    const sign = vi.fn(async (tx: never) => tx);
    await expect(
      fireTicket(swapTicket(), { signTransaction: sign as never }),
    ).rejects.toThrow(/Refused to sign/);
    expect(sign).not.toHaveBeenCalled();
  });

  it("refuses a fill whose price drifted past the ticket", async () => {
    const drifted = needsSignature({
      summary: {
        ...TRADE_SUMMARY,
        output: { ...TRADE_SUMMARY.output, expectedAmount: "0.9" },
      },
    });
    stubNetwork({ rounds: [drifted] });
    const sign = vi.fn(async (tx: never) => tx);
    await expect(
      fireTicket(swapTicket(), { signTransaction: sign as never }),
    ).rejects.toThrow(/price moved/);
    expect(sign).not.toHaveBeenCalled();
  });

  it("follows one intermediate leg and then completes", async () => {
    stubNetwork({
      rounds: [needsSignature({ step: "intermediate" }), needsSignature({ step: "final" })],
    });
    const sign = vi.fn(async (tx: never) => tx);
    const notes: string[] = [];
    const out = await fireTicket(swapTicket(), {
      signTransaction: sign as never,
      onNote: (n) => notes.push(n),
    });
    expect(out).toMatchObject({ kind: "served" });
    expect(sign).toHaveBeenCalledTimes(2);
    expect(notes).toContain("First leg confirmed — firing the follow-up.");
  });

  it("stops rather than loop when the sidecar keeps asking for more legs", async () => {
    // A sidecar stuck on `intermediate` would otherwise re-open the wallet
    // for as long as the user keeps approving.
    stubNetwork({ rounds: [needsSignature({ step: "intermediate" })] });
    const sign = vi.fn(async (tx: never) => tx);
    await expect(
      fireTicket(swapTicket(), { signTransaction: sign as never }),
    ).rejects.toThrow(/Too many signing steps/);
    expect(sign).toHaveBeenCalledTimes(MAX_SIGNING_STEPS);
  });

  it("returns the signature when the relay could not confirm", async () => {
    stubNetwork({
      rounds: [needsSignature()],
      submit: () =>
        submitResponse({ signature: "SIGPEND", pending: true, error: "not confirmed in 30s" }, 202),
    });
    const out = await fireTicket(swapTicket(), {
      signTransaction: (async (tx: never) => tx) as never,
    });
    expect(out).toEqual({
      kind: "pending",
      signature: "SIGPEND",
      note: "not confirmed in 30s",
    });
  });

  it("does not start the next leg on an unconfirmed prerequisite", async () => {
    // The sidecar's contract is to continue only once the prerequisite has
    // landed. Continuing on an unconfirmed one would sign against state
    // that may never exist.
    stubNetwork({
      rounds: [needsSignature({ step: "intermediate" }), needsSignature({ step: "final" })],
      submit: () => submitResponse({ signature: "SIGPEND", pending: true }, 202),
    });
    const sign = vi.fn(async (tx: never) => tx);
    const out = await fireTicket(swapTicket(), { signTransaction: sign as never });
    expect(out).toMatchObject({ kind: "pending" });
    expect(sign).toHaveBeenCalledTimes(1);
  });

  it("surfaces a declined signature as a rejection, not a failure", async () => {
    stubNetwork({ rounds: [needsSignature()] });
    const err = await fireTicket(swapTicket(), {
      signTransaction: (async () => {
        throw new Error("User rejected the request");
      }) as never,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TxError);
    expect((err as TxError).code).toBe("rejected");
  });

  it("signs a message proof without touching the submit relay", async () => {
    const fetchMock = stubNetwork({
      rounds: [{ status: "needs_signature", kind: "message", message: "prove it", tool: "x" }],
    });
    const out = await fireTicket(swapTicket(), {
      signTransaction: (async (tx: never) => tx) as never,
      signMessage: async () => new Uint8Array([1, 2, 3]),
    });
    expect(out).toMatchObject({ kind: "proof" });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/api/tx/submit"))).toBe(false);
  });
});
