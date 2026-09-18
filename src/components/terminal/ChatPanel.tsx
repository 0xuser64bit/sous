"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { callMcp, isNeedsSignature } from "@/lib/mcp/client";
import { usePilotStore } from "@/lib/store/usePilotStore";
import { signAndSubmitNeedsSignature } from "@/lib/tx/signAndSend";

/**
 * The core product surface. Not a card — the workspace itself.
 * User types intent → Sous quotes → user signs → confirmed.
 */
export function ChatPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { messages, push, setPhase, setSignature, setError } = usePilotStore();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function onSend() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    push({ role: "user", text: input });
    setPhase("quoting");
    try {
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
      push({ role: "system", text: msg });
    } finally {
      setBusy(false);
      setInput("");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Connect a wallet and start cooking.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`animate-fade-in text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto max-w-[80%]"
                    : "mr-auto max-w-[85%]"
                }`}
              >
                {m.role === "user" ? (
                  <div
                    className="rounded-md px-3 py-2"
                    style={{
                      background: "var(--amber-muted)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {m.text}
                  </div>
                ) : m.role === "system" ? (
                  <div
                    className="rounded-md px-3 py-2 font-mono text-xs"
                    style={{
                      background: "var(--error-muted)",
                      color: "var(--error)",
                    }}
                  >
                    {m.text}
                  </div>
                ) : (
                  <div
                    className="py-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div
                className="animate-fade-in mr-auto text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                <span className="animate-gentle-pulse inline-block">
                  Cooking…
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void onSend()}
            placeholder={
              publicKey
                ? "Quote 10 COOK → bCOOK…"
                : "Connect wallet to start"
            }
            disabled={!publicKey || busy}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--amber)] disabled:opacity-40"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={() => void onSend()}
            disabled={busy || !input.trim()}
            className="rounded-md px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-30"
            style={{
              background: "var(--amber)",
              color: "var(--text-inverse)",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
