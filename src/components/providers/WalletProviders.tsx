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
      refetchOnWindowFocus: false,

      // No automatic retry. React Query pauses a pending retry while the
      // document is unfocused, so with retry:1 a request that failed while
      // the tab was in the background left the query stuck on
      // status "pending" / fetchStatus "paused" — the rail sat on a loading
      // skeleton indefinitely, with no error and no retry button, and the
      // app looked hung rather than degraded. Every read here either polls
      // on its own interval or offers an explicit Retry, so one attempt
      // that turns straight into a visible error is both simpler and more
      // honest than a retry the user cannot see.
      retry: 0,

      // The default networkMode ("online") parks a query the same way when
      // the browser reports itself offline. Reads go to this app's own
      // origin and on to a sidecar that is usually localhost, so the
      // browser's opinion about internet connectivity says nothing about
      // whether the request can succeed.
      networkMode: "always",
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
