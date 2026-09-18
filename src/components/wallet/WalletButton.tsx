"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddr } from "@/lib/utils/format";

/**
 * Wallet connection/display. Clean, compact, no candy colors.
 */
export function WalletButton() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
        style={{
          background: "var(--amber)",
          color: "var(--text-inverse)",
        }}
      >
        Connect
      </button>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--success)" }}
      />
      <span
        className="font-mono text-xs"
        style={{ color: "var(--text-secondary)" }}
        title={addr}
      >
        {shortAddr(addr)}
      </span>
      <button
        className="ml-1 text-[11px] transition-opacity hover:opacity-70"
        style={{ color: "var(--text-tertiary)" }}
        onClick={() => void navigator.clipboard.writeText(addr)}
        title="Copy address"
      >
        ⌘
      </button>
      <button
        className="text-[11px] transition-opacity hover:opacity-70"
        style={{ color: "var(--text-tertiary)" }}
        onClick={() => void disconnect()}
        title="Disconnect"
      >
        ×
      </button>
    </div>
  );
}
