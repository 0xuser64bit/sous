"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddr } from "@/lib/utils/format";

/**
 * The hook by the pass door. Disconnected: one copper button.
 * Connected: live dot, address, copy, disconnect — all labeled.
 */
export function WalletButton() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [copied, setCopied] = useState(false);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="rounded-[var(--radius-md)] px-3.5 py-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-85"
        style={{ background: "var(--copper)", color: "#1d1206" }}
      >
        Connect
      </button>
    );
  }

  const addr = publicKey.toBase58();

  async function copy() {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — address is still visible in full via title */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span
        aria-label="Wallet connected"
        role="img"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--success)" }}
      />
      <span
        className="font-mono text-[12.5px] tnum"
        style={{ color: "var(--text-secondary)" }}
        title={addr}
      >
        {shortAddr(addr)}
      </span>
      <button
        onClick={() => void copy()}
        title="Copy full address"
        aria-live="polite"
        className="text-[11.5px] font-medium transition-opacity hover:opacity-70"
        style={{ color: "var(--text-tertiary)" }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span aria-hidden style={{ color: "var(--border-strong)" }}>·</span>
      <button
        onClick={() => void disconnect()}
        title="Disconnect wallet"
        className="text-[11.5px] font-medium transition-opacity hover:opacity-70"
        style={{ color: "var(--text-tertiary)" }}
      >
        Leave
      </button>
    </div>
  );
}
