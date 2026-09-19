import { describe, expect, it } from "vitest";
import {
  DEMO_START,
  DEMO_TEXT,
  PHASE_MS,
  PHASE_ORDER,
  captionFor,
  demoReducer,
  expoFor,
} from "../landing/demoScript";

describe("demo theater script", () => {
  it("types every character, then advances quoting → ticket → signing → confirming → served → hold", () => {
    let s = DEMO_START;
    for (let i = 0; i < DEMO_TEXT.length; i++) {
      s = demoReducer(s, { type: "tick" });
    }
    expect(s).toEqual({ phase: "quoting", typed: DEMO_TEXT.length });
    const rest = ["ticket", "signing", "confirming", "served", "hold"] as const;
    for (const phase of rest) {
      s = demoReducer(s, { type: "tick" });
      expect(s.phase).toBe(phase);
    }
  });

  it("loops hold back to the start", () => {
    const s = demoReducer({ phase: "hold", typed: DEMO_TEXT.length }, { type: "tick" });
    expect(s).toEqual(DEMO_START);
  });

  it("resets from anywhere", () => {
    expect(demoReducer({ phase: "confirming", typed: 5 }, { type: "reset" })).toEqual(DEMO_START);
  });

  it("covers every phase exactly once in order", () => {
    expect(PHASE_ORDER).toEqual([
      "typing",
      "quoting",
      "ticket",
      "signing",
      "confirming",
      "served",
      "hold",
    ]);
    for (const phase of PHASE_ORDER) {
      expect(PHASE_MS[phase]).toBeGreaterThan(0);
    }
  });

  it("lights captions and expo stations in story order", () => {
    expect(PHASE_ORDER.map(captionFor)).toEqual([0, 0, 1, 2, 3, 3, 3]);
    expect(PHASE_ORDER.map(expoFor)).toEqual([-1, 0, 0, 1, 2, 3, 3]);
  });
});
