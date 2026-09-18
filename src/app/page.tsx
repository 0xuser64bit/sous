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
    <footer style={{ borderTop: "1px solid var(--border-subtle)" }}>
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
    <div className="flex min-h-screen flex-col">
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
                role="tab"
                aria-selected={active}
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

      <main className="mx-auto grid w-full max-w-[1200px] flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Context rail */}
        <aside
          aria-label="Pantry and market"
          className={`${tab === "pass" ? "hidden" : "block"} min-w-0 lg:block`}
          style={{ borderRight: "1px solid var(--border-subtle)" }}
          role="tabpanel"
        >
          <div className={`${tab === "market" ? "hidden" : "block"} lg:block`}>
            <PortfolioOverview />
          </div>
          <div
            className={`${tab === "pantry" ? "hidden" : "block"} lg:block`}
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <ActivityFeed />
          </div>
        </aside>

        {/* The pass — the product */}
        <div
          className={`${tab !== "pass" ? "hidden" : "flex"} min-w-0 flex-col lg:flex`}
          role="tabpanel"
        >
          <ChatPanel />
          <TxPass />
        </div>
      </main>

      <Footer />
    </div>
  );
}
