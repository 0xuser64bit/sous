"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddr } from "@/lib/utils/format";

/**
 * Bounty-required: wallet connection + display connected address
 * + clear connect/disconnect + copy address.
 */
export function WalletButton() {
  const { publicKey, connected, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-300"
      >
        Connect Nightly
      </button>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
      <span
        className="h-2 w-2 rounded-full bg-emerald-400"
        title={wallet?.adapter.name ?? "connected"}
      />
      <span className="font-mono text-sm" title={addr}>
        {shortAddr(addr)}
      </span>
      <button
        className="text-xs text-white/60 hover:text-white"
        onClick={() => void navigator.clipboard.writeText(addr)}
      >
        Copy
      </button>
      <button
        className="text-xs text-white/60 hover:text-white"
        onClick={() => void disconnect()}
      >
        Disconnect
      </button>
    </div>
  );
}
