"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { ChatPanel } from "@/components/terminal/ChatPanel";
import { TxPass } from "@/components/terminal/TxPass";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { COOKIE_RPC_URL, COOKIESCAN_BASE } from "@/lib/chain/config";

type Tab = "pass" | "pantry" | "market";

const TABS: { id: Tab; label: string }[] = [
  { id: "pass", label: "Pass" },
  { id: "pantry", label: "Pantry" },
  { id: "market", label: "Market" },
];

function rpcHost(): string {
  try {
    return new URL(COOKIE_RPC_URL).host;
  } catch {
    return COOKIE_RPC_URL;
  }
}

function Footer() {
  return (
    <footer className="shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 font-mono text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
        <span>
          rpc <span style={{ color: "var(--text-secondary)" }}>{rpcHost()}</span>
        </span>
        <a
          href={COOKIESCAN_BASE}
          target="_blank"
          rel="noreferrer"
          className="transition-opacity hover:opacity-70"
          style={{ color: "var(--text-secondary)" }}
        >
          cookiescan ↗
        </a>
        <span className="ml-auto">fired in Nightly · settled on Cookie Chain</span>
      </div>
    </footer>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("pass");

  return (
    // Viewport-locked: the pass fills the screen exactly. The feed and the
    // rail scroll internally, the dock never leaves — connecting a wallet
    // (or posting tickets) grows scrollable regions, never the page.
    <div className="flex h-screen flex-col overflow-hidden supports-[height:100dvh]:h-dvh">
      <Header />

      {/* Mobile tab rail — the sidebar becomes tabs under lg */}
      <nav
        aria-label="Sections"
        className="shrink-0 lg:hidden"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="mx-auto flex w-full max-w-[1200px] gap-1 px-4 py-2" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className="flex-1 rounded-[var(--radius-md)] px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                style={{
                  background: active ? "var(--bg-raised)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: `1px solid ${active ? "var(--border)" : "transparent"}`,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto grid w-full max-w-[1200px] min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Context rail — self-scrolling */}
        <aside
          aria-label="Pantry and market"
          className={`${tab === "pass" ? "hidden" : "block"} min-h-0 min-w-0 overflow-y-auto lg:block`}
          style={{ borderRight: "1px solid var(--border-subtle)" }}
        >
          <div
            id="panel-pantry"
            role="tabpanel"
            aria-labelledby="tab-pantry"
            className={`${tab === "market" ? "hidden" : "block"} lg:block`}
          >
            <PortfolioOverview />
          </div>
          <div
            id="panel-market"
            role="tabpanel"
            aria-labelledby="tab-market"
            className={`${tab === "pantry" ? "hidden" : "block"} lg:block`}
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <ActivityFeed />
          </div>
        </aside>

        {/* The pass — the product. min-h-0 keeps the feed, not the page, scrolling. */}
        <div
          id="panel-pass"
          className={`${tab !== "pass" ? "hidden" : "flex"} min-h-0 min-w-0 flex-col lg:flex`}
          role="tabpanel"
          aria-labelledby="tab-pass"
        >
          <ChatPanel />
          <TxPass />
        </div>
      </main>

      <Footer />
    </div>
  );
}
