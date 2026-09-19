"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { NightlyWalletAdapter, PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { COOKIE_RPC_URL } from "@/lib/chain/config";

import "@solana/wallet-adapter-react-ui/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The sidecar is a local process that can go down: fail fast, and
      // never storm it with refires on every window focus. Polling queries
      // carry their own refetchInterval; passive reads refetch on demand.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Nightly is REQUIRED by the bounty. We list Nightly first so it is
 * the default choice, while keeping other adapters as fallback.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new NightlyWalletAdapter(), new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={COOKIE_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
