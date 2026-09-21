import { describe, expect, it } from "vitest";
import { slotOf } from "../chain/slot";
import { classifyChain, statusDetail, statusLabel } from "../chain/status";

describe("slotOf", () => {
  it("reads slots through the MCP envelope", () => {
    expect(
      slotOf({ jsonrpc: "2.0", id: 1, result: { slot: 25907199 } }),
    ).toBe("25,907,199");
    expect(
      slotOf({
        result: { content: [{ text: '{"slot":42}' }] },
      }),
    ).toBe("42");
    expect(slotOf({ result: {} })).toBeNull();
    expect(slotOf(null)).toBeNull();
    expect(slotOf("slot 123456")).toBe("123456");
  });

  it("reads the real chain_health shape (nested slots)", () => {
    const live = {
      healthy: true,
      slots: { processed: 25909146, confirmed: 25909146, finalized: 25909114 },
      absoluteSlot: 25909114,
      blockHeight: 25463615,
    };
    expect(slotOf(live)).toBe("25,909,114");
    expect(slotOf({ slots: { finalized: 100 } })).toBe("100");
    expect(slotOf({ healthy: true })).toBeNull();
  });
});

describe("classifyChain", () => {
  it("reports live when the sidecar gave a slot", () => {
    expect(classifyChain({ slot: "26,350,580", sidecarFailed: false, rpcOk: null })).toEqual({
      state: "live",
      slot: "26,350,580",
    });
  });

  it("blames the sidecar, not the chain, when the RPC still answers", () => {
    // Every read goes through the sidecar, so its death used to read as
    // "offline" — pointing the user at Cookie Chain when the thing that was
    // down was the quoting service.
    const s = classifyChain({ slot: null, sidecarFailed: true, rpcOk: true });
    expect(s.state).toBe("sidecar-down");
    expect(statusLabel(s)).toBe("sidecar down");
    expect(statusDetail(s)).toMatch(/quoting service/i);
  });

  it("never hands a deployed visitor a shell command", () => {
    // NODE_ENV is "test" here, i.e. not "development", so these assert the
    // string a real visitor sees. The dev build still names the command.
    for (const s of [
      classifyChain({ slot: null, sidecarFailed: true, rpcOk: true }),
      classifyChain({ slot: null, sidecarFailed: true, rpcOk: false }),
      classifyChain({ slot: null, sidecarFailed: true, rpcOk: null }),
      classifyChain({ slot: "1", sidecarFailed: false, rpcOk: true }),
    ]) {
      expect(statusDetail(s)).not.toMatch(/npx|COOKIE_SIGNER|--http/);
    }
  });

  it("reports the chain down only when neither answers", () => {
    expect(classifyChain({ slot: null, sidecarFailed: true, rpcOk: false }).state).toBe("chain-down");
  });

  it("stays unknown while it has not heard back", () => {
    expect(classifyChain({ slot: null, sidecarFailed: true, rpcOk: null }).state).toBe("unknown");
    expect(classifyChain({ slot: null, sidecarFailed: false, rpcOk: null }).state).toBe("unknown");
  });
});
