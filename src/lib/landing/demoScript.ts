/**
 * Script for the landing-page demo theater: a canned, read-only swap flow.
 * Pure state machine — no timers, no DOM — so the sequence is unit-tested
 * and the component stays a thin renderer. Nothing here touches a wallet
 * or the network; every value is illustrative.
 */

export const DEMO_TEXT = "Quote 10 COOK \u2192 bCOOK";

export type DemoPhase =
  | "typing"
  | "quoting"
  | "ticket"
  | "signing"
  | "confirming"
  | "served"
  | "hold";

export const PHASE_ORDER: DemoPhase[] = [
  "typing",
  "quoting",
  "ticket",
  "signing",
  "confirming",
  "served",
  "hold",
];

/** Per-phase beat in ms. Typing is per character; the rest per phase. */
export const PHASE_MS: Record<DemoPhase, number> = {
  typing: 55,
  quoting: 1400,
  ticket: 1400,
  signing: 1500,
  confirming: 1600,
  served: 1400,
  hold: 2800,
};

export type DemoState = {
  phase: DemoPhase;
  /** Characters of DEMO_TEXT revealed so far (typing phase only). */
  typed: number;
};

export const DEMO_START: DemoState = { phase: "typing", typed: 0 };

/** Final resting frame for reduced-motion: everything already served. */
export const DEMO_FINAL: DemoState = { phase: "hold", typed: DEMO_TEXT.length };

export type DemoAction = { type: "tick" } | { type: "reset" };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") return DEMO_START;
  if (state.phase === "typing") {
    const typed = Math.min(state.typed + 1, DEMO_TEXT.length);
    return typed >= DEMO_TEXT.length
      ? { phase: "quoting", typed }
      : { phase: "typing", typed };
  }
  const next = PHASE_ORDER[PHASE_ORDER.indexOf(state.phase) + 1];
  // hold loops back to the top so the theater runs continuously.
  if (!next) return DEMO_START;
  return { phase: next, typed: state.typed };
}

export type DemoCaption = { title: string; text: string };

export const DEMO_CAPTIONS: DemoCaption[] = [
  {
    title: "Order in words",
    text: "Type it like you'd say it.",
  },
  {
    title: "Quoted on paper",
    text: "Venue, floor, both fees — before signing.",
  },
  {
    title: "Signed in Nightly",
    text: "One approval. Guard checks first.",
  },
  {
    title: "Served with receipt",
    text: "Seconds, fractions of a cent, receipt. Canned preview — pass is live.",
  },
];

/** Which caption is lit for each phase. */
export function captionFor(phase: DemoPhase): number {
  switch (phase) {
    case "typing":
    case "quoting":
      return 0;
    case "ticket":
      return 1;
    case "signing":
      return 2;
    case "confirming":
    case "served":
    case "hold":
      return 3;
  }
}

/** Expo-strip station index: -1 idle, 0 Quoted, 1 Signature, 2 Confirming, 3 Served. */
export function expoFor(phase: DemoPhase): number {
  switch (phase) {
    case "typing":
      return -1;
    case "quoting":
    case "ticket":
      return 0;
    case "signing":
      return 1;
    case "confirming":
      return 2;
    case "served":
    case "hold":
      return 3;
  }
}
