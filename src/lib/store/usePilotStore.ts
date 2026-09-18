import { create } from "zustand";

export type TxPhase =
  | "idle"
  | "quoting"
  | "awaiting_signature"
  | "sending"
  | "confirming"
  | "confirmed"
  | "failed";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
  signature?: string;
};

type PilotState = {
  messages: ChatMsg[];
  txPhase: TxPhase;
  lastSignature: string | null;
  lastError: string | null;
  push: (m: Omit<ChatMsg, "id" | "ts">) => void;
  setPhase: (p: TxPhase) => void;
  setSignature: (s: string | null) => void;
  setError: (e: string | null) => void;
  resetTx: () => void;
};

export const usePilotStore = create<PilotState>((set) => ({
  messages: [
    {
      id: "welcome",
      role: "assistant",
      text: "Yes, Chef! I'm Sous, your sous-chef for Cookie Chain. Connect Nightly, then ask e.g. 'Quote 10 COOK -> bCOOK'.",
      ts: Date.now(),
    },
  ],
  txPhase: "idle",
  lastSignature: null,
  lastError: null,
  push: (m) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...m, id: `${Date.now()}-${Math.random()}`, ts: Date.now() },
      ].slice(-100),
    })),
  setPhase: (txPhase) => set({ txPhase }),
  setSignature: (lastSignature) => set({ lastSignature }),
  setError: (lastError) => set({ lastError }),
  resetTx: () =>
    set({ txPhase: "idle", lastSignature: null, lastError: null }),
}));
