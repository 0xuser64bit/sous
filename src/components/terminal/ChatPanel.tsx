"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { callMcp, isNeedsSignature } from "@/lib/mcp/client";
import { usePilotStore } from "@/lib/store/usePilotStore";
import { signAndSubmitNeedsSignature } from "@/lib/tx/signAndSend";

/**
 * Minimal chat shell. Agent logic lives server-side (cookie-mcp).
 * This panel only: sends prompt -> displays quote/plan -> signs via Nightly if needed.
 */
export function ChatPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { messages, push, setPhase, setSignature, setError } = usePilotStore();
  const [input, setInput] = useState("Quote 10 COOK -> bCOOK");
  const [busy, setBusy] = useState(false);

  async function onSend() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    push({ role: "user", text: input });
    setPhase("quoting");
    try {
      // Step 1: read-only demo — chain health + echo.
      // Real agent loop (planner -> get_quote -> trade) lands in TASK 02.
      const health = await callMcp({
        tool: "chain_health",
        wallet: publicKey?.toBase58(),
      });
      if (isNeedsSignature(health)) {
        if (!publicKey || !signTransaction) {
          throw new Error("Connect Nightly to sign this action.");
        }
        setPhase("awaiting_signature");
        const sig = await signAndSubmitNeedsSignature(health, signTransaction);
        setSignature(sig);
        setPhase("confirmed");
        push({ role: "assistant", text: `Signed & confirmed: ${sig}` });
      } else {
        setPhase("idle");
        push({
          role: "assistant",
          text: `Chain health: ${JSON.stringify(health).slice(0, 500)}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setPhase("failed");
      push({ role: "system", text: `Error: ${msg}` });
    } finally {
      setBusy(false);
      setInput("");
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-amber-400 text-black"
                : m.role === "system"
                  ? "bg-red-500/15 text-red-200"
                  : "bg-white/10"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void onSend()}
          placeholder={
            publicKey ? "Ask Sous… (e.g. quote 10 COOK → bCOOK)" : "Connect Nightly to start cooking…"
          }
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-amber-400/60"
        />
        <button
          onClick={() => void onSend()}
          disabled={busy}
          className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
