import { Header } from "@/components/layout/Header";
import { ChatPanel } from "@/components/terminal/ChatPanel";
import { TxStatusCard } from "@/components/terminal/TxStatusCard";
import { PortfolioOverview } from "@/components/dashboard/PortfolioOverview";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-1 gap-0 lg:gap-px">
        {/* Context rail — compact, secondary */}
        <aside className="hidden w-72 shrink-0 flex-col gap-px overflow-y-auto border-r border-[var(--border-subtle)] lg:flex">
          <PortfolioOverview />
          <ActivityFeed />
        </aside>

        {/* Chat — the product */}
        <div className="flex min-w-0 flex-1 flex-col">
          <ChatPanel />
          <TxStatusCard />
        </div>
      </main>
    </div>
  );
}
