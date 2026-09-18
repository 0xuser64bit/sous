import { Header } from "@/components/layout/Header";
import { ChatPanel } from "@/components/terminal/ChatPanel";
import { TxStatusCard } from "@/components/terminal/TxStatusCard";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-[480px] flex-col gap-4">
          <ChatPanel />
          <TxStatusCard />
        </div>
        <div className="flex flex-col gap-4">
          <PortfolioOverview />
          <ActivityFeed />
        </div>
      </main>
      <footer className="border-t border-white/10 px-6 py-4 text-xs text-white/40">
        Sous v0 — your sous-chef for Cookie Chain. RPC: rpc.cookiescan.io ·
        Explorer: cookiescan.io · Swaps: Cookiebox + Candy Shop · AI:
        cookie-mcp (external-signer). Yes, Chef!
      </footer>
    </div>
  );
}
