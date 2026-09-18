import { WalletButton } from "@/components/wallet/WalletButton";
import { SousMark } from "@/components/brand/SousMark";
import { APP_NAME } from "@/lib/chain/config";

export function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
      <div className="flex items-center gap-2.5">
        <SousMark size={24} />
        <span className="text-sm font-medium tracking-tight">
          {APP_NAME}
        </span>
      </div>
      <WalletButton />
    </header>
  );
}
