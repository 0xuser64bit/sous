import { create } from "zustand";
import type { McpTool } from "@/lib/mcp/client";

export type TxPhase =
  | "idle"
  | "quoting"
  | "awaiting_signature"
  | "sending"
  | "confirming"
  | "confirmed"
  | "failed";

export type QuoteState = "proposed" | "firing" | "fired" | "dismissed" | "failed";

/** Every money move goes through a paper ticket, then the wallet. */
export type OrderKind =
  | "swap"
  | "transfer"
  | "limit"
  | "stake"
  | "unstake"
  | "bridge";

export type QuoteData = {
  orderKind: OrderKind;
  amount: number;
  from: string;
  to: string;
  /** Extra line on the ticket, e.g. limit price. */
  detailLabel?: string;
  detail?: string;
  /** Tool + args the ticket fires (used when no cached payload exists). */
  fireTool: McpTool;
  fireArgs: Record<string, unknown>;
  outAmount?: string;
  venue?: string;
  impact?: string;
  state: QuoteState;
  note?: string;
};

export type TableData = {
  title: string;
  subtitle?: string;
  rows: { label: string; value: string }[];
  more?: number;
};

export type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
  /** Ticket-rail number, assigned to user orders. */
  ticketNo?: number;
  /** Structured quote attached to an assistant message. */
  quote?: QuoteData;
  /** Ledger-style rows attached to an assistant message. */
  table?: TableData;
  signature?: string;
};

type PilotState = {
  messages: ChatMsg[];
  txPhase: TxPhase;
  lastSignature: string | null;
  lastError: string | null;
  ticketSeq: number;
  push: (m: Omit<ChatMsg, "id" | "ts">) => string;
  updateQuote: (id: string, patch: Partial<QuoteData>) => void;
  setPhase: (p: TxPhase) => void;
  setSignature: (s: string | null) => void;
  setError: (e: string | null) => void;
  resetTx: () => void;
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const usePilotStore = create<PilotState>((set) => ({
  messages: [
    {
      id: "welcome",
      role: "assistant",
      text: "Yes, Chef! I'm Sous. Tell me what to fire — a swap, a stake, your balances — and I'll quote it, then ask for your signature in Nightly. Nothing moves without your hand.",
      ts: Date.now(),
    },
  ],
  txPhase: "idle",
  lastSignature: null,
  lastError: null,
  ticketSeq: 1,
  push: (m) => {
    const id = makeId();
    set((s) => {
      const ticketNo =
        m.role === "user" && m.ticketNo === undefined ? s.ticketSeq : m.ticketNo;
      return {
        messages: [
          ...s.messages,
          { ...m, id, ts: Date.now(), ticketNo },
        ].slice(-100),
        ticketSeq: m.role === "user" && m.ticketNo === undefined ? s.ticketSeq + 1 : s.ticketSeq,
      };
    });
    return id;
  },
  updateQuote: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id && m.quote ? { ...m, quote: { ...m.quote, ...patch } } : m,
      ),
    })),
  setPhase: (txPhase) => set({ txPhase }),
  setSignature: (lastSignature) => set({ lastSignature }),
  setError: (lastError) => set({ lastError }),
  resetTx: () =>
    set({ txPhase: "idle", lastSignature: null, lastError: null }),
}));
